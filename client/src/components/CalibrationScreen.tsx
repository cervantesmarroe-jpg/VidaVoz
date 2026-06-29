import { useEffect, useState, useRef, useCallback } from "react";
import { gazeTracker, useWebGazerStore } from "@/hooks/use-webgazer";
import { X } from "lucide-react";
import { saveDeviceCalibration } from "@/lib/deviceCalibration";

// ── Desactiva blink durante toda la calibración ───────────────────────────────
function useDisableBlink() {
  useEffect(() => {
    gazeTracker.setBlinkEnabled(false);
    return () => { gazeTracker.setBlinkEnabled(true); };
  }, []);
}

// ─── Secuencia de 9 puntos (fracción de pantalla) ────────────────────────────
// Los márgenes son 40px sobre una pantalla de referencia 360×764.
// Al multiplicar por innerWidth/Height se escalan a cualquier dispositivo.
const MH = 20 / 360;   // margen horizontal ~ 5.6 % — puntos cerca del borde para entrenar el extremo lateral
const MV = 40 / 764;   // margen vertical   ~  5.2 %

const POINTS = [
  { label: "Centro",           fx: 0.5,    fy: 0.5,    durationMs: 7000 },
  { label: "Arriba centro",    fx: 0.5,    fy: MV,     durationMs: 5000 },
  { label: "Abajo centro",     fx: 0.5,    fy: 1 - MV, durationMs: 5000 },
  { label: "Izquierda centro", fx: MH,     fy: 0.5,    durationMs: 5000 },
  { label: "Derecha centro",   fx: 1 - MH, fy: 0.5,    durationMs: 5000 },
  { label: "Esquina sup-izq",  fx: MH,     fy: MV,     durationMs: 6000 },
  { label: "Esquina sup-der",  fx: 1 - MH, fy: MV,     durationMs: 6000 },
  { label: "Esquina inf-izq",  fx: MH,     fy: 1 - MV, durationMs: 6000 },
  { label: "Esquina inf-der",  fx: 1 - MH, fy: 1 - MV, durationMs: 6000 },
] as const;

const N_SAMPLES      = 4;     // muestras por punto (distribuidas uniformemente)
const WARMUP_MS      = 500;   // descarta los primeros 500 ms (ojo en transición)
const TRANSITION_MS  = 200;   // pausa entre puntos (dot desaparece)
const SUCCESS_MS     = 1600;  // tiempo de pantalla "¡Listo!" antes de cerrar

// Calcula los N_SAMPLES instantes (ms) uniformemente distribuidos en [WARMUP_MS, durationMs]
function sampleTimes(durationMs: number): number[] {
  const active = durationMs - WARMUP_MS;
  return Array.from({ length: N_SAMPLES }, (_, i) =>
    WARMUP_MS + (active / (N_SAMPLES - 1)) * i
  );
}

// ── Anillo SVG de progreso alrededor del punto ────────────────────────────────
const DOT_R   = 9;    // radio del punto (18 px diámetro)
const RING_R  = 28;   // radio del anillo exterior
const RING_C  = 2 * Math.PI * RING_R;
const SVG_SZ  = (RING_R + 8) * 2;

function PointDot({
  warmup, progress,
}: {
  warmup: boolean;
  progress: number; // 0–1 durante la fase activa
}) {
  const offset = RING_C * (1 - Math.min(progress, 1));
  return (
    <svg
      width={SVG_SZ} height={SVG_SZ}
      style={{ overflow: "visible", pointerEvents: "none" }}
    >
      {/* Círculo sólido de 18 px */}
      <circle
        cx={SVG_SZ / 2} cy={SVG_SZ / 2} r={DOT_R}
        fill={warmup ? "#888888" : "#FFFFFF"}
        style={{ transition: "fill 0.12s" }}
      />
      {/* Anillo de progreso (solo visible en fase activa) */}
      {!warmup && (
        <>
          <circle
            cx={SVG_SZ / 2} cy={SVG_SZ / 2} r={RING_R}
            fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth={4}
          />
          <circle
            cx={SVG_SZ / 2} cy={SVG_SZ / 2} r={RING_R}
            fill="none" stroke="#FFFFFF" strokeWidth={4}
            strokeLinecap="round"
            strokeDasharray={RING_C}
            strokeDashoffset={offset}
            transform={`rotate(-90 ${SVG_SZ / 2} ${SVG_SZ / 2})`}
            style={{ transition: "stroke-dashoffset 0.04s linear" }}
          />
        </>
      )}
    </svg>
  );
}

// ── Indicador de verificación previa ─────────────────────────────────────────
function CheckRow({ ok, label }: { ok: boolean | null; label: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <div style={{
        width: 22, height: 22, borderRadius: "50%",
        background: ok === true ? "rgba(125,211,168,0.2)"
          : ok === false ? "rgba(248,113,113,0.2)" : "rgba(255,255,255,0.08)",
        border: `2px solid ${ok === true ? "#7DD3A8" : ok === false ? "#f87171" : "rgba(255,255,255,0.2)"}`,
        display: "flex", alignItems: "center", justifyContent: "center",
        flexShrink: 0, transition: "all 0.25s",
      }}>
        {ok === true && (
          <svg width={12} height={12} viewBox="0 0 12 12" fill="none">
            <polyline points="2,6 5,9 10,3" stroke="#7DD3A8" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
        {ok === false && (
          <svg width={10} height={10} viewBox="0 0 10 10" fill="none">
            <line x1="2" y1="2" x2="8" y2="8" stroke="#f87171" strokeWidth={2} strokeLinecap="round" />
            <line x1="8" y1="2" x2="2" y2="8" stroke="#f87171" strokeWidth={2} strokeLinecap="round" />
          </svg>
        )}
      </div>
      <span style={{ fontSize: ".82rem", color: ok ? "rgba(255,255,255,0.8)" : "rgba(255,255,255,0.4)", transition: "color 0.25s" }}>
        {label}
      </span>
    </div>
  );
}

// ─── CalibrationScreen ────────────────────────────────────────────────────────
type Phase = "checking" | "point" | "transition" | "computing" | "success" | "error";

interface CalibrationScreenProps {
  /** Llamado tras éxito (en lugar del flujo por defecto finishCalibration+startDetection) */
  onSuccess?: () => void;
  /** Llamado al cancelar (en lugar del flujo por defecto deactivate+stopCamera) */
  onCancel?: () => void;
}

export function CalibrationScreen({ onSuccess, onCancel }: CalibrationScreenProps = {}) {
  useDisableBlink();
  const { finishCalibration, deactivate } = useWebGazerStore();

  const [phase,           setPhase]           = useState<Phase>("checking");
  const [pointIdx,        setPointIdx]         = useState(0);
  const [warmup,          setWarmup]           = useState(true);   // gray dot
  const [ringProgress,    setRingProgress]     = useState(0);
  const [showInstruction, setShowInstruction]  = useState(true);
  const [errorMsg,        setErrorMsg]         = useState("");
  const [faceStatus, setFaceStatus] = useState<{
    detected: boolean; bothEyesOpen: boolean; noseX: number;
  }>({ detected: false, bothEyesOpen: false, noseX: 0.5 });

  // Timers y cleanup
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const ivsRef    = useRef<ReturnType<typeof setInterval>[]>([]);
  const clearAll  = useCallback(() => {
    timersRef.current.forEach(clearTimeout);
    ivsRef.current.forEach(clearInterval);
    timersRef.current = []; ivsRef.current = [];
  }, []);

  // ── Fase "checking": poll de estado de rostro cada 200 ms ────────────────
  useEffect(() => {
    if (phase !== "checking") return;
    gazeTracker.clearCalibration();
    const iv = setInterval(() => setFaceStatus(gazeTracker.getFaceStatus()), 200);
    ivsRef.current.push(iv);
    return clearAll;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  // ── Fase "point": ejecuta el punto actual ────────────────────────────────
  useEffect(() => {
    if (phase !== "point") return;

    const pt      = POINTS[pointIdx];
    const screenX = pt.fx * window.innerWidth;
    const screenY = pt.fy * window.innerHeight;

    setWarmup(true);
    setRingProgress(0);

    // Programar las N_SAMPLES muestras en sus instantes exactos
    const times = sampleTimes(pt.durationMs);
    times.forEach(t => {
      const h = setTimeout(() => {
        gazeTracker.recordCalibrationPoint(screenX, screenY);
      }, t);
      timersRef.current.push(h);
    });

    // Tras el warmup: punto blanco + arrancar anillo
    const whiteH = setTimeout(() => {
      setWarmup(false);
      // Ocultar instrucción cuando el primer punto pasa a activo
      if (pointIdx === 0) setShowInstruction(false);
    }, WARMUP_MS);
    timersRef.current.push(whiteH);

    // Anillo de progreso (solo en fase activa)
    const activeStart    = performance.now() + WARMUP_MS;
    const activeDuration = pt.durationMs - WARMUP_MS;
    const progressIv = setInterval(() => {
      const elapsed = performance.now() - activeStart;
      setRingProgress(Math.min(elapsed / activeDuration, 1));
    }, 40);
    ivsRef.current.push(progressIv);

    // Fin del punto
    const endH = setTimeout(() => {
      clearAll();
      setRingProgress(1);
      if (pointIdx + 1 >= POINTS.length) {
        setPhase("computing");
      } else {
        setPhase("transition");
      }
    }, pt.durationMs);
    timersRef.current.push(endH);

    return clearAll;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, pointIdx]);

  // ── Fase "transition": 200 ms de pausa → siguiente punto ─────────────────
  useEffect(() => {
    if (phase !== "transition") return;
    const h = setTimeout(() => {
      setPointIdx(p => p + 1);
      setPhase("point");
    }, TRANSITION_MS);
    return () => clearTimeout(h);
  }, [phase]);

  // ── Fase "computing": regresión + validación del modelo ──────────────────
  useEffect(() => {
    if (phase !== "computing") return;

    const model = gazeTracker.finalizeTraining();
    if (!model) {
      setErrorMsg("Calibración inválida — datos insuficientes. Repite el proceso.");
      setPhase("error");
      return;
    }

    const H = window.innerHeight;
    const W = window.innerWidth;
    const valid =
      model.betaX  < 0 &&
      model.betaY  < 0 &&
      model.alphaY > 0  &&
      model.alphaY < H  &&
      (model.betaX / W) < 0;   // sensitivityX < 0

    if (!valid) {
      console.warn("[VozUCI] Modelo inválido:", model);
      gazeTracker.clearCalibration();
      setErrorMsg("Calibración inválida — repite el proceso manteniendo la mirada fija en cada punto");
      setPhase("error");
      return;
    }

    console.log(
      "%c[VozUCI] Calibración 9 puntos ✓",
      "color:#7DD3A8;font-weight:900;font-size:13px",
      `αX=${model.alphaX.toFixed(1)} βX=${model.betaX.toFixed(1)}`,
      `αY=${model.alphaY.toFixed(1)} βY=${model.betaY.toFixed(1)}`,
    );
    saveDeviceCalibration(model, 'calibrationScreen');
    setPhase("success");
  }, [phase]);

  // ── Fase "success": activar tracking y cerrar ────────────────────────────
  useEffect(() => {
    if (phase !== "success") return;
    const h = setTimeout(() => {
      if (onSuccess) {
        // Flujo externo: el componente padre maneja el cierre
        onSuccess();
      } else {
        // Flujo por defecto (desde FullscreenLayout)
        finishCalibration();
        gazeTracker.startDetection();
      }
    }, SUCCESS_MS);
    return () => clearTimeout(h);
  }, [phase, finishCalibration, onSuccess]);

  // ── Cancelar ─────────────────────────────────────────────────────────────
  const handleCancel = useCallback(() => {
    clearAll();
    if (onCancel) {
      onCancel();
    } else {
      deactivate();
      gazeTracker.stopCamera();
    }
  }, [clearAll, deactivate, onCancel]);

  // ── Comenzar secuencia (desde checking) ──────────────────────────────────
  const handleStart = useCallback(() => {
    clearAll();
    setPointIdx(0);
    setShowInstruction(true);
    setPhase("point");
  }, [clearAll]);

  // ── Reintentar tras error ─────────────────────────────────────────────────
  const handleRetry = useCallback(() => {
    clearAll();
    gazeTracker.clearCalibration();
    setPointIdx(0);
    setErrorMsg("");
    setShowInstruction(true);
    setPhase("checking");
  }, [clearAll]);

  // ── Coordenadas del punto actual en pantalla ──────────────────────────────
  const pt     = POINTS[Math.min(pointIdx, POINTS.length - 1)];
  const dotX   = pt.fx * window.innerWidth;
  const dotY   = pt.fy * window.innerHeight;

  const W = window.innerWidth;
  const H = window.innerHeight;
  const resOk  = Math.abs(W - 360) <= 20 && Math.abs(H - 764) <= 50;
  const canStart = faceStatus.detected && faceStatus.bothEyesOpen;

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 9999,
        background: "#000000",
        fontFamily: "'Lexend', sans-serif",
        userSelect: "none", overflow: "hidden",
      }}
    >
      <style>{`
        @keyframes cs-pop {
          0%   { transform: scale(0.5); opacity: 0; }
          70%  { transform: scale(1.08); opacity: 1; }
          100% { transform: scale(1);   opacity: 1; }
        }
        @keyframes cs-fade { from { opacity: 0 } to { opacity: 1 } }
        @keyframes cs-slide { from { opacity:0; transform:translateY(10px) } to { opacity:1; transform:none } }
      `}</style>

      {/* ── Botón Cancelar ──────────────────────────────────────────────── */}
      <button
        onClick={handleCancel}
        data-testid="button-cancel-calibration"
        style={{
          position: "absolute", top: 18, right: 18, zIndex: 10,
          background: "rgba(255,255,255,0.07)",
          border: "1px solid rgba(255,255,255,0.14)",
          borderRadius: 10, color: "rgba(255,255,255,0.45)",
          padding: "7px 14px", cursor: "pointer",
          fontSize: "0.75rem", fontWeight: 700,
          display: "flex", alignItems: "center", gap: 6,
        }}
      >
        <X size={13} /> Cancelar
      </button>

      {/* ══════════════════════════════════════════════════════════════════
          FASE "checking" — validación previa al inicio
      ══════════════════════════════════════════════════════════════════ */}
      {phase === "checking" && (
        <div style={{
          position: "absolute", inset: 0,
          display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center",
          gap: 28, padding: "0 32px",
          animation: "cs-fade .4s ease both",
        }}>
          {/* Título */}
          <div style={{ textAlign: "center" }}>
            <p style={{ fontSize: "clamp(1.1rem,4vw,1.5rem)", fontWeight: 900, color: "#fff", margin: 0 }}>
              Calibración de mirada
            </p>
            <p style={{ fontSize: ".8rem", color: "rgba(255,255,255,0.35)", margin: "6px 0 0" }}>
              9 puntos · ~63 segundos
            </p>
          </div>

          {/* Checks */}
          <div style={{
            background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: 16, padding: "20px 24px",
            display: "flex", flexDirection: "column", gap: 16, width: "100%", maxWidth: 320,
          }}>
            <CheckRow ok={faceStatus.detected} label="Rostro detectado" />
            <CheckRow
              ok={faceStatus.detected ? faceStatus.bothEyesOpen : null}
              label="Ambos ojos visibles"
            />
            <CheckRow
              ok={resOk}
              label={`Pantalla ${W}×${H} px${!resOk ? " (recomendado 360×764)" : ""}`}
            />
          </div>

          {/* Instrucción cuidador */}
          <div style={{
            background: "rgba(125,211,168,0.08)",
            border: "1px solid rgba(125,211,168,0.25)",
            borderRadius: 12, padding: "14px 20px",
            textAlign: "center", maxWidth: 320,
          }}>
            <p style={{ fontSize: ".9rem", fontWeight: 800, color: "#7DD3A8", margin: "0 0 6px", letterSpacing: ".01em" }}>
              El cuidador toca cada punto
            </p>
            <p style={{ fontSize: ".8rem", color: "rgba(255,255,255,0.55)", margin: 0, lineHeight: 1.5 }}>
              mientras el paciente lo mira fijo
            </p>
          </div>

          {/* Instrucción posición */}
          <p style={{ fontSize: ".75rem", color: "rgba(255,255,255,0.28)", textAlign: "center", maxWidth: 280, lineHeight: 1.6, margin: 0 }}>
            Coloca al paciente frente a la cámara con el rostro bien iluminado.
          </p>

          {/* Botón Comenzar */}
          <button
            onClick={handleStart}
            disabled={!canStart}
            data-testid="button-start-calibration"
            style={{
              padding: "13px 36px", borderRadius: 14, border: "none",
              fontFamily: "'Lexend',sans-serif", fontWeight: 900,
              fontSize: ".95rem", letterSpacing: ".04em", cursor: canStart ? "pointer" : "not-allowed",
              background: canStart
                ? "linear-gradient(135deg, #7DD3A8 0%, #4db88a 100%)"
                : "rgba(255,255,255,0.08)",
              color: canStart ? "#0A2018" : "rgba(255,255,255,0.25)",
              boxShadow: canStart ? "0 0 24px rgba(125,211,168,0.5)" : "none",
              transition: "all 0.3s",
            }}
          >
            {faceStatus.detected ? "Comenzar calibración" : "Esperando cámara…"}
          </button>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════
          FASES "point" / "transition" — secuencia de puntos
      ══════════════════════════════════════════════════════════════════ */}
      {(phase === "point" || phase === "transition") && (
        <>
          {/* Instrucción superior (desaparece cuando activa el primer punto) */}
          {showInstruction && (
            <div style={{
              position: "absolute", top: "8%", left: 0, right: 0,
              display: "flex", flexDirection: "column", alignItems: "center", gap: 6,
              padding: "0 24px",
              animation: "cs-slide .5s ease both",
            }}>
              <p style={{
                fontSize: "clamp(.95rem,3.2vw,1.2rem)",
                fontWeight: 800,
                color: "#7DD3A8",
                margin: 0, letterSpacing: ".01em", textAlign: "center",
              }}>
                El cuidador toca el punto mientras el paciente lo mira
              </p>
              <p style={{
                fontSize: "clamp(.75rem,2.5vw,.9rem)",
                fontWeight: 500,
                color: "rgba(255,255,255,0.4)",
                margin: 0, textAlign: "center",
              }}>
                Mantén la mirada fija hasta que el punto desaparezca
              </p>
            </div>
          )}

          {/* Contador de puntos (discreto, esquina inferior) */}
          <p style={{
            position: "absolute", bottom: "6%", left: 0, right: 0,
            textAlign: "center",
            fontSize: ".68rem", color: "rgba(255,255,255,0.2)",
            letterSpacing: ".1em", fontWeight: 700,
          }}>
            {pointIdx + 1} / {POINTS.length}
          </p>

          {/* Punto posicionado absolutamente en sus coordenadas */}
          {phase === "point" && (
            <div style={{
              position: "absolute",
              left: dotX, top: dotY,
              transform: "translate(-50%, -50%)",
              animation: "cs-pop .22s cubic-bezier(.34,1.56,.64,1) both",
            }}>
              <PointDot warmup={warmup} progress={ringProgress} />
            </div>
          )}
        </>
      )}

      {/* ══════════════════════════════════════════════════════════════════
          FASE "computing" — calculando modelo
      ══════════════════════════════════════════════════════════════════ */}
      {phase === "computing" && (
        <div style={{
          position: "absolute", inset: 0,
          display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center", gap: 16,
          animation: "cs-fade .3s ease both",
        }}>
          <div style={{
            width: 48, height: 48, borderRadius: "50%",
            border: "4px solid rgba(125,211,168,0.3)",
            borderTopColor: "#7DD3A8",
            animation: "spin 0.8s linear infinite",
          }} />
          <p style={{ fontSize: ".85rem", color: "rgba(255,255,255,0.4)", margin: 0 }}>
            Calculando modelo…
          </p>
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════
          FASE "success" — calibración exitosa
      ══════════════════════════════════════════════════════════════════ */}
      {phase === "success" && (
        <div style={{
          position: "absolute", inset: 0,
          display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center", gap: 20,
          animation: "cs-pop .45s cubic-bezier(.34,1.56,.64,1) both",
        }}>
          <div style={{
            width: 88, height: 88, borderRadius: "50%",
            background: "radial-gradient(circle at 38% 38%, #a8e8c8 0%, #7DD3A8 60%, #4db88a 100%)",
            boxShadow: "0 0 48px rgba(125,211,168,0.7)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <svg width={42} height={42} viewBox="0 0 42 42" fill="none">
              <polyline points="7,22 17,32 35,11" stroke="#fff" strokeWidth={4.5} strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <p style={{ fontSize: "clamp(1.1rem,3vw,1.5rem)", fontWeight: 900, color: "#7DD3A8", letterSpacing: ".04em" }}>
            ¡Calibración completada!
          </p>
          <p style={{ fontSize: ".82rem", color: "rgba(255,255,255,0.35)" }}>
            Activando seguimiento de mirada…
          </p>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════
          FASE "error" — modelo inválido
      ══════════════════════════════════════════════════════════════════ */}
      {phase === "error" && (
        <div style={{
          position: "absolute", inset: 0,
          display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center",
          gap: 24, padding: "0 32px",
          animation: "cs-fade .3s ease both",
        }}>
          <div style={{
            width: 72, height: 72, borderRadius: "50%",
            background: "rgba(248,113,113,0.15)",
            border: "3px solid #f87171",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <svg width={32} height={32} viewBox="0 0 32 32" fill="none">
              <line x1="8" y1="8" x2="24" y2="24" stroke="#f87171" strokeWidth={3.5} strokeLinecap="round" />
              <line x1="24" y1="8" x2="8" y2="24" stroke="#f87171" strokeWidth={3.5} strokeLinecap="round" />
            </svg>
          </div>
          <p style={{
            fontSize: ".85rem", color: "rgba(255,255,255,0.6)",
            textAlign: "center", lineHeight: 1.7, margin: 0, maxWidth: 300,
          }}>
            {errorMsg}
          </p>
          <button
            onClick={handleRetry}
            data-testid="button-retry-calibration"
            style={{
              padding: "12px 32px", borderRadius: 12, border: "2px solid #f87171",
              background: "rgba(248,113,113,0.1)", color: "#f87171",
              fontFamily: "'Lexend',sans-serif", fontWeight: 800, fontSize: ".88rem",
              cursor: "pointer",
            }}
          >
            Repetir calibración
          </button>
        </div>
      )}
    </div>
  );
}
