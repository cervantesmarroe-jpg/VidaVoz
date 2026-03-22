import { useEffect, useState, useRef, useCallback } from "react";
import { gazeTracker } from "@/hooks/use-webgazer";
import { useWebGazerStore } from "@/hooks/use-webgazer";
import { CheckCircle, X } from "lucide-react";

// ── Posiciones de la rejilla 3×3 (relativas al viewport) ────────────────────
const GRID_POINTS = [
  { xr: 0.05, yr: 0.05, label: "Superior Izquierda" },
  { xr: 0.50, yr: 0.05, label: "Superior Centro"    },
  { xr: 0.95, yr: 0.05, label: "Superior Derecha"   },
  { xr: 0.05, yr: 0.50, label: "Centro Izquierda"   },
  { xr: 0.50, yr: 0.50, label: "Centro"              },
  { xr: 0.95, yr: 0.50, label: "Centro Derecha"      },
  { xr: 0.05, yr: 0.95, label: "Inferior Izquierda" },
  { xr: 0.50, yr: 0.95, label: "Inferior Centro"    },
  { xr: 0.95, yr: 0.95, label: "Inferior Derecha"   },
];

const POINT_MS     = 2500;   // duración de cada punto (ms)
const WARMUP_MS    = 600;    // retardo antes de capturar (ms)
const COLLECT_RATE = 30;     // intervalo de muestreo (ms) → ~33 fps
const CIRC_R       = 44;     // radio del arco SVG de progreso
const CIRCUMF      = 2 * Math.PI * CIRC_R;

type Phase = "intro" | "calibrating" | "result" | "validation";

interface CalibModel {
  alphaX: number; betaX: number;
  alphaY: number; betaY: number;
  calibrated: boolean;
}

// ── Arco SVG de progreso ─────────────────────────────────────────────────────
function ProgressArc({ progress }: { progress: number }) {
  const offset = CIRCUMF * (1 - Math.min(progress, 1));
  return (
    <svg
      width={CIRC_R * 2 + 16}
      height={CIRC_R * 2 + 16}
      style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%) rotate(-90deg)", pointerEvents: "none" }}
    >
      <circle
        cx={CIRC_R + 8} cy={CIRC_R + 8} r={CIRC_R}
        fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth={4}
      />
      <circle
        cx={CIRC_R + 8} cy={CIRC_R + 8} r={CIRC_R}
        fill="none" stroke="#fbbf24" strokeWidth={4}
        strokeLinecap="round"
        strokeDasharray={CIRCUMF}
        strokeDashoffset={offset}
        style={{ transition: "stroke-dashoffset 0.05s linear" }}
      />
    </svg>
  );
}

// ── Pantalla principal de calibración ────────────────────────────────────────
export function CalibrationScreen() {
  const { finishCalibration, deactivate } = useWebGazerStore();

  const [phase, setPhase]       = useState<Phase>("intro");
  const [currentPt, setCurrentPt] = useState(0);
  const [progress, setProgress] = useState(0);
  const [samples, setSamples]   = useState(0);
  const [model, setModel]       = useState<CalibModel | null>(null);
  const [countDown, setCountDown] = useState(3);

  const validCursorRef  = useRef<HTMLDivElement>(null);
  const donePtsRef      = useRef<Set<number>>(new Set());

  // ── Fase intro: cuenta atrás 3-2-1 ──────────────────────────────────────
  useEffect(() => {
    if (phase !== "intro") return;
    donePtsRef.current = new Set();
    setCurrentPt(0);
    setProgress(0);
    setSamples(0);
    setModel(null);
    gazeTracker.clearCalibration();

    const iv = setInterval(() => setCountDown((c) => {
      if (c <= 1) { clearInterval(iv); setPhase("calibrating"); return 3; }
      return c - 1;
    }), 1000);
    return () => clearInterval(iv);
  }, [phase]);

  // ── Fase calibrating: captura por punto ──────────────────────────────────
  useEffect(() => {
    if (phase !== "calibrating") return;

    // Si terminamos todos los puntos → calcular modelo
    if (currentPt >= GRID_POINTS.length) {
      gazeTracker.computeCalibration();
      const m = gazeTracker.getModel();
      if (m) {
        setModel(m);
        // Imprimir en consola
        const out = {
          version:  1,
          points:   GRID_POINTS.length,
          alphaX:   +m.alphaX.toFixed(4),
          betaX:    +m.betaX.toFixed(4),
          alphaY:   +m.alphaY.toFixed(4),
          betaY:    +m.betaY.toFixed(4),
          widthPx:  window.innerWidth,
          heightPx: window.innerHeight,
          calibrated: m.calibrated,
        };
        console.log("USER_CALIBRATION_MODEL =", JSON.stringify(out, null, 2));
      }
      setPhase("result");
      return;
    }

    const pt      = GRID_POINTS[currentPt];
    const screenX = pt.xr * window.innerWidth;
    const screenY = pt.yr * window.innerHeight;
    let   localSamples = 0;
    let   collecting   = false;
    setProgress(0);

    const startTime = Date.now();

    // Retardo de calentamiento
    const warmup = setTimeout(() => { collecting = true; }, WARMUP_MS);

    // Muestreo a ~33 fps
    const collector = setInterval(() => {
      if (!collecting) return;
      const ok = gazeTracker.recordCalibrationPoint(screenX, screenY);
      if (ok) { localSamples++; setSamples((s) => s + 1); }
    }, COLLECT_RATE);

    // Actualizar barra de progreso
    const progressIv = setInterval(() => {
      setProgress(Math.min((Date.now() - startTime) / POINT_MS, 1));
    }, 40);

    // Avanzar al siguiente punto
    const advance = setTimeout(() => {
      clearInterval(collector);
      clearInterval(progressIv);
      clearTimeout(warmup);
      donePtsRef.current = new Set(donePtsRef.current).add(currentPt);
      setCurrentPt((p) => p + 1);
    }, POINT_MS);

    return () => {
      clearInterval(collector);
      clearInterval(progressIv);
      clearTimeout(advance);
      clearTimeout(warmup);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, currentPt]);

  // ── Fase validation: cursor sigue la mirada ──────────────────────────────
  useEffect(() => {
    if (phase !== "validation") return;
    gazeTracker.startDetection();
    const onGaze = (x: number, y: number) => {
      if (validCursorRef.current) {
        validCursorRef.current.style.transform = `translate(${x - 28}px, ${y - 28}px)`;
      }
    };
    gazeTracker.addGazeListener(onGaze);
    return () => gazeTracker.removeGazeListener(onGaze);
  }, [phase]);

  const handleFinish = useCallback(() => {
    finishCalibration();
    gazeTracker.startDetection();
  }, [finishCalibration]);

  const handleCancel = useCallback(() => {
    deactivate();
    gazeTracker.stopCamera();
  }, [deactivate]);

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 9999,
      background: "#000", color: "#fff",
      fontFamily: "'Lexend', sans-serif",
      userSelect: "none",
    }}>
      <style>{`
        @keyframes pulse-dot {
          0%,100% { transform: scale(1);   box-shadow: 0 0 0 0 rgba(251,191,36,0.6); }
          50%      { transform: scale(1.35); box-shadow: 0 0 0 18px rgba(251,191,36,0); }
        }
        @keyframes fadeIn { from { opacity:0; transform:scale(0.8); } to { opacity:1; transform:scale(1); } }
      `}</style>

      {/* Botón cancelar */}
      <button
        onClick={handleCancel}
        style={{
          position: "absolute", top: 16, right: 16, zIndex: 10,
          background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.15)",
          borderRadius: 10, color: "rgba(255,255,255,0.55)", padding: "8px 14px",
          cursor: "pointer", fontSize: "0.75rem", fontWeight: 700,
          display: "flex", alignItems: "center", gap: 6,
          fontFamily: "'Lexend', sans-serif",
        }}
      >
        <X size={14} /> Cancelar
      </button>

      {/* ─── INTRO ───────────────────────────────────────────────────────── */}
      {phase === "intro" && (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", gap: 32, padding: 40 }}>
          <div style={{ fontSize: "clamp(1.4rem,3vw,2rem)", fontWeight: 900, color: "#fbbf24", letterSpacing: ".05em", textAlign: "center" }}>
            CALIBRACIÓN DE MIRADA
          </div>
          <div style={{ fontSize: "clamp(.9rem,2vw,1.2rem)", color: "rgba(255,255,255,0.7)", textAlign: "center", maxWidth: 560, lineHeight: 1.7 }}>
            Aparecerán <strong style={{ color: "#fff" }}>9 puntos dorados</strong> en pantalla.<br />
            Mira cada punto fijamente hasta que desaparezca.<br />
            No muevas la cabeza, solo los ojos.
          </div>
          <div style={{
            width: 110, height: 110, borderRadius: "50%",
            background: "rgba(251,191,36,0.15)", border: "3px solid #fbbf24",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: "3.5rem", fontWeight: 900, color: "#fbbf24",
          }}>
            {countDown}
          </div>
          <div style={{ fontSize: ".75rem", color: "rgba(255,255,255,0.4)", letterSpacing: ".12em", textTransform: "uppercase" }}>
            Comenzando…
          </div>
        </div>
      )}

      {/* ─── CALIBRATING ─────────────────────────────────────────────────── */}
      {phase === "calibrating" && currentPt < GRID_POINTS.length && (
        <>
          {/* Indicador superior */}
          <div style={{ position: "absolute", top: 18, left: 0, right: 0, textAlign: "center", fontSize: ".8rem", fontWeight: 700, color: "rgba(255,255,255,0.5)", letterSpacing: ".1em", textTransform: "uppercase" }}>
            Punto {currentPt + 1} de {GRID_POINTS.length} — {GRID_POINTS[currentPt].label}
          </div>
          <div style={{ position: "absolute", top: 42, left: 0, right: 0, textAlign: "center", fontSize: ".68rem", color: "rgba(255,255,255,0.3)" }}>
            {samples} muestras capturadas
          </div>

          {/* Todos los puntos de la rejilla */}
          {GRID_POINTS.map((pt, i) => {
            const px = pt.xr * window.innerWidth;
            const py = pt.yr * window.innerHeight;
            const isActive = i === currentPt;
            const isDone   = donePtsRef.current.has(i);
            return (
              <div key={i} style={{
                position: "absolute",
                left: px, top: py,
                transform: "translate(-50%,-50%)",
                zIndex: isActive ? 5 : 2,
              }}>
                {/* Arco de progreso (solo punto activo) */}
                {isActive && <ProgressArc progress={progress} />}

                {/* Punto */}
                <div style={{
                  width:  isActive ? 24 : isDone ? 12 : 10,
                  height: isActive ? 24 : isDone ? 12 : 10,
                  borderRadius: "50%",
                  background: isActive ? "#fbbf24" : isDone ? "rgba(251,191,36,0.35)" : "rgba(255,255,255,0.15)",
                  border: isActive ? "3px solid rgba(255,255,255,0.9)" : isDone ? "2px solid rgba(251,191,36,0.4)" : "1px solid rgba(255,255,255,0.2)",
                  transition: "all .2s",
                  animation: isActive ? "pulse-dot 0.9s ease-in-out infinite" : "none",
                }} />
              </div>
            );
          })}

          {/* Instrucción centrada */}
          <div style={{ position: "absolute", bottom: 28, left: 0, right: 0, textAlign: "center", fontSize: ".78rem", fontWeight: 600, color: "rgba(255,255,255,0.35)", letterSpacing: ".08em", textTransform: "uppercase" }}>
            Mira el punto dorado
          </div>
        </>
      )}

      {/* ─── RESULT ──────────────────────────────────────────────────────── */}
      {phase === "result" && (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", gap: 24, padding: 40 }}>
          <CheckCircle size={52} color="#4ade80" />
          <div style={{ fontSize: "clamp(1.3rem,3vw,1.8rem)", fontWeight: 900, color: "#4ade80" }}>
            Calibración completada
          </div>
          <div style={{ fontSize: ".8rem", color: "rgba(255,255,255,0.45)" }}>
            {samples} muestras totales · {GRID_POINTS.length} puntos
          </div>

          {/* Modelo */}
          {model && (
            <div style={{
              background: "#0d0d0d", borderRadius: 14, border: "1px solid rgba(255,255,255,0.1)",
              padding: "18px 28px", maxWidth: 420, width: "100%",
            }}>
              <div style={{ fontSize: ".65rem", fontWeight: 800, letterSpacing: ".15em", color: "#fbbf24", textTransform: "uppercase", marginBottom: 12 }}>
                USER_CALIBRATION_MODEL
              </div>
              <pre style={{ margin: 0, fontFamily: "monospace", fontSize: ".78rem", color: "#a3e635", lineHeight: 1.7 }}>{JSON.stringify({
                version:   1,
                points:    GRID_POINTS.length,
                alphaX:    +model.alphaX.toFixed(3),
                betaX:     +model.betaX.toFixed(3),
                alphaY:    +model.alphaY.toFixed(3),
                betaY:     +model.betaY.toFixed(3),
                widthPx:   window.innerWidth,
                heightPx:  window.innerHeight,
                calibrated: model.calibrated,
              }, null, 2)}</pre>
            </div>
          )}

          {/* Botones */}
          <div style={{ display: "flex", gap: 14, marginTop: 8 }}>
            <button onClick={() => setPhase("validation")} style={{
              background: "#1a3a1a", border: "2px solid #4ade80", borderRadius: 12,
              color: "#4ade80", padding: "12px 28px", cursor: "pointer",
              fontFamily: "'Lexend',sans-serif", fontWeight: 800, fontSize: ".85rem", letterSpacing: ".06em",
            }}>
              👁  Probar precisión
            </button>
            <button onClick={handleFinish} style={{
              background: "rgba(251,191,36,0.12)", border: "2px solid #fbbf24", borderRadius: 12,
              color: "#fbbf24", padding: "12px 28px", cursor: "pointer",
              fontFamily: "'Lexend',sans-serif", fontWeight: 800, fontSize: ".85rem", letterSpacing: ".06em",
            }}>
              ✓  Usar calibración
            </button>
          </div>
          <button onClick={() => setPhase("intro")} style={{
            background: "transparent", border: "none", color: "rgba(255,255,255,0.3)",
            cursor: "pointer", fontFamily: "'Lexend',sans-serif", fontWeight: 600, fontSize: ".72rem",
          }}>
            ↺ Repetir calibración
          </button>
        </div>
      )}

      {/* ─── VALIDATION ──────────────────────────────────────────────────── */}
      {phase === "validation" && (
        <>
          {/* Cursor de validación */}
          <div ref={validCursorRef} style={{
            position: "fixed", top: 0, left: 0,
            width: 56, height: 56, borderRadius: "50%",
            pointerEvents: "none", zIndex: 10,
            background: "rgba(74,222,128,0.15)",
            border: "3px solid #4ade80",
            boxShadow: "0 0 20px rgba(74,222,128,0.5)",
            transition: "transform 0.07s linear",
          }} />

          {/* Panel de instrucciones (esquina superior izquierda) */}
          <div style={{
            position: "absolute", top: 20, left: 20,
            background: "rgba(0,0,0,0.8)", border: "1px solid rgba(255,255,255,0.12)",
            borderRadius: 12, padding: "14px 20px",
          }}>
            <div style={{ fontSize: ".75rem", fontWeight: 800, color: "#4ade80", letterSpacing: ".1em", textTransform: "uppercase", marginBottom: 6 }}>
              Prueba de precisión
            </div>
            <div style={{ fontSize: ".7rem", color: "rgba(255,255,255,0.6)", lineHeight: 1.6 }}>
              Mueve la mirada por la pantalla.<br />El cursor verde debe seguir tus ojos.
            </div>
          </div>

          {/* Cruces de referencia en las 9 posiciones */}
          {GRID_POINTS.map((pt, i) => (
            <div key={i} style={{
              position: "absolute",
              left: pt.xr * window.innerWidth,
              top: pt.yr * window.innerHeight,
              transform: "translate(-50%,-50%)",
              width: 20, height: 20,
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <div style={{ position: "absolute", width: 20, height: 1, background: "rgba(255,255,255,0.2)" }} />
              <div style={{ position: "absolute", width: 1, height: 20, background: "rgba(255,255,255,0.2)" }} />
              <div style={{ width: 4, height: 4, borderRadius: "50%", background: "rgba(255,255,255,0.3)" }} />
            </div>
          ))}

          {/* Botones inferiores */}
          <div style={{ position: "absolute", bottom: 28, left: "50%", transform: "translateX(-50%)", display: "flex", gap: 14 }}>
            <button onClick={() => setPhase("result")} style={{
              background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.2)",
              borderRadius: 12, color: "rgba(255,255,255,0.7)", padding: "10px 22px",
              cursor: "pointer", fontFamily: "'Lexend',sans-serif", fontWeight: 700, fontSize: ".78rem",
            }}>
              ← Volver
            </button>
            <button onClick={handleFinish} style={{
              background: "#1a3a1a", border: "2px solid #4ade80", borderRadius: 12,
              color: "#4ade80", padding: "10px 28px", cursor: "pointer",
              fontFamily: "'Lexend',sans-serif", fontWeight: 800, fontSize: ".82rem",
            }}>
              ✓ Confirmar y activar mirada
            </button>
          </div>
        </>
      )}
    </div>
  );
}
