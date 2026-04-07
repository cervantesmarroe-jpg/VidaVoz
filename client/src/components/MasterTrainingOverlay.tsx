import { useState, useEffect, useRef, useCallback } from "react";
import { gazeTracker } from "@/hooks/use-webgazer";
import { X, ClipboardCopy, CheckCheck, Dna, RotateCcw, ChevronRight } from "lucide-react";

// ── Constantes ────────────────────────────────────────────────────────────────
const DWELL_MS     = 3000;
const COLLECT_MS   = 50;
const WARMUP_MS    = 500;
const R_RING       = 52;
const CIRCUMF      = 2 * Math.PI * R_RING;
const ROUNDS       = 4;  // 9 posiciones × 4 vueltas = 36 muestras totales

// Márgenes iguales a los de la CalibrationScreen (40 px sobre 360×764)
const MH = 40 / 360;
const MV = 40 / 764;

// ── 9 Posiciones (fracción de pantalla) — mismo orden que CalibrationScreen ──
const POSITIONS = [
  { key: "cx", label: "Centro",            fx: 0.5,    fy: 0.5    },
  { key: "tc", label: "Arriba-Centro",     fx: 0.5,    fy: MV     },
  { key: "bc", label: "Abajo-Centro",      fx: 0.5,    fy: 1 - MV },
  { key: "lc", label: "Izquierda-Centro",  fx: MH,     fy: 0.5    },
  { key: "rc", label: "Derecha-Centro",    fx: 1 - MH, fy: 0.5    },
  { key: "tl", label: "Arriba-Izquierda",  fx: MH,     fy: MV     },
  { key: "tr", label: "Arriba-Derecha",    fx: 1 - MH, fy: MV     },
  { key: "bl", label: "Abajo-Izquierda",   fx: MH,     fy: 1 - MV },
  { key: "br", label: "Abajo-Derecha",     fx: 1 - MH, fy: 1 - MV },
] as const;

const TOTAL_STEPS = POSITIONS.length * ROUNDS; // 36

// Schedule: Round 1 all positions, then Round 2 all positions, etc.
const SCHEDULE = Array.from({ length: ROUNDS }, (_, r) =>
  POSITIONS.map((_, p) => ({ posIdx: p, round: r }))
).flat();

type Phase = "idle" | "syncing" | "captured" | "done";

// ── Anillo SVG de progreso ────────────────────────────────────────────────────
function SyncRing({ progress, r = R_RING }: { progress: number; r?: number }) {
  const circ   = 2 * Math.PI * r;
  const offset = circ * (1 - Math.min(progress, 1));
  const sz     = (r + 14) * 2;
  return (
    <svg width={sz} height={sz}
      style={{ position: "absolute", top: "50%", left: "50%",
        transform: "translate(-50%,-50%) rotate(-90deg)", pointerEvents: "none" }}
    >
      <circle cx={sz/2} cy={sz/2} r={r}
        fill="none" stroke="rgba(125,211,168,0.18)" strokeWidth={6} />
      <circle cx={sz/2} cy={sz/2} r={r}
        fill="none" stroke="#7DD3A8" strokeWidth={6}
        strokeLinecap="round"
        strokeDasharray={circ}
        strokeDashoffset={offset}
        style={{ transition: "stroke-dashoffset 0.06s linear" }}
      />
    </svg>
  );
}

// ── Mini mapa de 9 posiciones (cuadrícula 3×3) ───────────────────────────────
// Índices POSITIONS: 0=C, 1=T, 2=B, 3=L, 4=R, 5=TL, 6=TR, 7=BL, 8=BR
function PositionMap({ done, current }: { done: number[]; current: number }) {
  const cells = [
    { posIdx: 5, gridCol: 1, gridRow: 1 },  // TL
    { posIdx: 1, gridCol: 2, gridRow: 1 },  // T
    { posIdx: 6, gridCol: 3, gridRow: 1 },  // TR
    { posIdx: 3, gridCol: 1, gridRow: 2 },  // L
    { posIdx: 0, gridCol: 2, gridRow: 2 },  // C
    { posIdx: 4, gridCol: 3, gridRow: 2 },  // R
    { posIdx: 7, gridCol: 1, gridRow: 3 },  // BL
    { posIdx: 2, gridCol: 2, gridRow: 3 },  // B
    { posIdx: 8, gridCol: 3, gridRow: 3 },  // BR
  ];
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(3,16px)", gridTemplateRows: "repeat(3,16px)", gap: 3 }}>
      {cells.map(({ posIdx, gridCol, gridRow }) => {
        const doneCount = done.filter(d => d === posIdx).length;
        const isCurrent = posIdx === current;
        return (
          <div key={posIdx} style={{
            gridColumn: gridCol, gridRow,
            width: 16, height: 16, borderRadius: "50%",
            background: isCurrent
              ? "#7DD3A8"
              : doneCount >= ROUNDS ? "rgba(125,211,168,0.6)"
              : doneCount > 0       ? `rgba(125,211,168,${0.1 + doneCount * 0.1})`
              : "rgba(255,255,255,0.07)",
            border: `1.5px solid ${isCurrent ? "#7DD3A8" : doneCount > 0 ? "rgba(125,211,168,0.5)" : "rgba(255,255,255,0.12)"}`,
            boxShadow: isCurrent ? "0 0 8px rgba(125,211,168,0.7)" : "none",
            transition: "all 0.25s",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: "7px", fontWeight: 900,
            color: isCurrent ? "#0A2018" : doneCount > 0 ? "#7DD3A8" : "rgba(255,255,255,0.15)",
          }}>
            {doneCount > 0 && !isCurrent ? doneCount : ""}
          </div>
        );
      })}
    </div>
  );
}

// ── MasterTrainingOverlay ─────────────────────────────────────────────────────
interface Props { onClose: () => void; }

export function MasterTrainingOverlay({ onClose }: Props) {
  const [phase, setPhase]         = useState<Phase>("idle");
  const [step, setStep]           = useState(0);          // 0–9
  const [savedSteps, setSavedSteps] = useState<number[]>([]); // posIdx de cada guardado
  const [progress, setProgress]   = useState(0);
  const [rawCount, setRawCount]   = useState(0);
  const [cameraReady, setCameraReady] = useState(false);
  const [finalJson, setFinalJson] = useState<string>("");
  const [copied, setCopied]       = useState(false);

  const dataLenBefore = useRef(0);   // training data length antes de cada ronda
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const ivs    = useRef<ReturnType<typeof setInterval>[]>([]);

  const clearTimers = useCallback(() => {
    timers.current.forEach(clearTimeout);
    ivs.current.forEach(clearInterval);
    timers.current = []; ivs.current = [];
  }, []);

  // Datos del step actual
  const currentSched  = SCHEDULE[step] ?? SCHEDULE[0];
  const currentPos    = POSITIONS[currentSched.posIdx];
  const currentRound  = currentSched.round + 1;   // 1-based para UI

  // Posición en píxeles (para el círculo)
  const posX = currentPos.fx * window.innerWidth;
  const posY = currentPos.fy * window.innerHeight;

  // ── Init cámara + desactivar blink durante entrenamiento ─────────────────
  useEffect(() => {
    gazeTracker.setBlinkEnabled(false);   // seguridad: ningún parpadeo accidental activa botones
    (async () => {
      gazeTracker.clearCalibration();
      if (!gazeTracker.hasFaceModel) await gazeTracker.init();
      if (!gazeTracker.hasCamera)    await gazeTracker.startCamera();
      gazeTracker.startDetection();
      setCameraReady(true);
    })();
    return () => {
      clearTimers();
      gazeTracker.setBlinkEnabled(true);  // reactivar al salir
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Fase syncing ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (phase !== "syncing" || !cameraReady) return;

    setProgress(0);
    setRawCount(0);
    dataLenBefore.current = gazeTracker.getTrainingDataLength();

    const t0 = Date.now();
    let collecting = false;

    const wup = setTimeout(() => { collecting = true; }, WARMUP_MS);
    timers.current.push(wup);

    const collector = setInterval(() => {
      if (!collecting) return;
      const ok = gazeTracker.recordCalibrationPoint(posX, posY);
      if (ok) setRawCount(n => n + 1);
    }, COLLECT_MS);
    ivs.current.push(collector);

    const progressIv = setInterval(() => {
      setProgress(Math.min((Date.now() - t0) / DWELL_MS, 1));
    }, 40);
    ivs.current.push(progressIv);

    const done = setTimeout(() => {
      clearTimers();
      const pts = gazeTracker.getTrainingDataLength() - dataLenBefore.current;
      if (pts >= 3) {
        setPhase("captured");
      } else {
        // Cara no detectada → repetir automáticamente
        gazeTracker.trimTrainingData(dataLenBefore.current);
        setPhase("syncing");
      }
    }, DWELL_MS);
    timers.current.push(done);

    return clearTimers;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, cameraReady, step]);

  // ── Guardar muestra ───────────────────────────────────────────────────────
  const handleSave = useCallback(() => {
    const posIdx = SCHEDULE[step].posIdx;
    setSavedSteps(prev => [...prev, posIdx]);
    const nextStep = step + 1;
    if (nextStep >= TOTAL_STEPS) {
      setPhase("done");
    } else {
      setStep(nextStep);
      setPhase("idle");
    }
  }, [step]);

  // ── Repetir ronda sin guardar ─────────────────────────────────────────────
  const handleRepeat = useCallback(() => {
    gazeTracker.trimTrainingData(dataLenBefore.current);
    setPhase("syncing");
  }, []);

  // ── Iniciar siguiente muestra ─────────────────────────────────────────────
  const handleStart = useCallback(() => {
    setPhase("syncing");
  }, []);

  // ── Generar ADN Final ─────────────────────────────────────────────────────
  const handleGenerate = useCallback(() => {
    const result = gazeTracker.finalizeTraining();
    if (!result) {
      // Puede ser por < 30 muestras O por datos degenerados (varianza≈0).
      // En ambos casos mostramos un error accionable en vez de un JSON silenciosamente roto.
      setFinalJson(JSON.stringify({
        ERROR: 'No se pudo generar un modelo válido.',
        CAUSAS_POSIBLES: [
          'Los blendshapes de MediaPipe no están devolviendo datos de mirada (eyeLookOutLeft, eyeLookInLeft, eyeLookUpLeft, eyeLookDownLeft).',
          'Los ojos no se movieron lo suficiente entre posiciones — el modelo de regresión necesita varianza en la señal ocular.',
          'Menos de 30 muestras brutas capturadas.',
        ],
        ACCION: 'Abre la consola del navegador y busca [finalizeTraining] para ver las métricas de varianza.',
      }, null, 2));
      return;
    }
    const W = window.innerWidth;
    const H = window.innerHeight;
    const json = JSON.stringify({
      _instruccion: "Copia este bloque y pégalo en gazeProfiles.ts para grabarlo de fábrica",
      profile:      gazeTracker.currentProfile.id,
      generatedAt:  new Date().toISOString(),
      positions:    9,
      rounds:       ROUNDS,
      totalPoints:  TOTAL_STEPS,
      screen:       { widthPx: W, heightPx: H, pixelRatio: window.devicePixelRatio },
      model: {
        alphaX: +result.alphaX.toFixed(4),
        betaX:  +result.betaX.toFixed(4),
        alphaY: +result.alphaY.toFixed(4),
        betaY:  +result.betaY.toFixed(4),
      },
      derivedSensitivities: {
        sensitivityX: result.sensitivityX,
        sensitivityY: result.sensitivityY,
        _nota: `Reemplaza los valores en GAZE_PROFILES['${gazeTracker.currentProfile.id}'].sensitivityX/Y`,
      },
    }, null, 2);
    setFinalJson(json);
    console.groupCollapsed("%c[MasterTraining] ADN multi-punto generado", "color:#7DD3A8;font-weight:900;font-size:14px");
    console.log(json);
    console.groupEnd();
  }, []);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(finalJson).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    });
  }, [finalJson]);

  const handleReset = useCallback(() => {
    gazeTracker.clearCalibration();
    setSavedSteps([]);
    setStep(0);
    setFinalJson("");
    setPhase("idle");
  }, []);

  const isFullyDone = phase === "done";
  const stepLabel   = `Vuelta ${currentRound} · ${currentPos.label}`;
  const stepCounter = `Muestra ${step + 1} de ${TOTAL_STEPS}`;

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 10000,
      background: "#060B10",
      display: "flex", flexDirection: "column",
      fontFamily: "'Lexend','Inter',sans-serif",
      userSelect: "none", overflow: "hidden",
    }}>
      <style>{`
        @keyframes hbMT  { 0%,100%{transform:scale(1)} 14%{transform:scale(1.22)} 28%{transform:scale(1)} 42%{transform:scale(1.12)} 70%{transform:scale(1)} }
        @keyframes popMT { 0%{transform:scale(0.4);opacity:0} 70%{transform:scale(1.08);opacity:1} 100%{transform:scale(1);opacity:1} }
        @keyframes fadeMT{ from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
        .mt-btn { transition:transform .12s,opacity .12s;cursor:pointer;border:none; }
        .mt-btn:active { transform:scale(0.93) !important; }
      `}</style>

      {/* ── Cabecera ──────────────────────────────────────────────────────── */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "14px 18px 10px",
        borderBottom: "1px solid rgba(255,255,255,0.07)", flexShrink: 0,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Dna size={18} color="#7DD3A8" />
          <span style={{ fontSize: ".88rem", fontWeight: 800, color: "#fff", letterSpacing: ".04em" }}>
            Entrenamiento Maestro
          </span>
          <span style={{
            fontSize: ".65rem", fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase",
            color: "#8BA7CC", background: "rgba(139,167,204,0.12)",
            border: "1px solid rgba(139,167,204,0.3)", borderRadius: 6, padding: "2px 8px",
          }}>
            {gazeTracker.currentProfile.label}
          </span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {/* Mini mapa de posiciones */}
          <PositionMap done={savedSteps} current={currentSched.posIdx} />

          <button className="mt-btn" onClick={() => { clearTimers(); onClose(); }} style={{
            background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.14)",
            borderRadius: 8, color: "rgba(255,255,255,0.4)",
            padding: "6px 12px", display: "flex", alignItems: "center", gap: 5,
            fontSize: ".7rem", fontWeight: 700,
          }}>
            <X size={11} /> Cerrar
          </button>
        </div>
      </div>

      {/* ── Contador de pasos ──────────────────────────────────────────────── */}
      {!isFullyDone && (
        <div style={{
          display: "flex", flexDirection: "column", alignItems: "center",
          gap: 6, padding: "12px 0 6px", flexShrink: 0,
        }}>
          <p style={{ margin: 0, fontSize: "clamp(.9rem,3vw,1.15rem)", fontWeight: 900, color: "#fff", letterSpacing: ".03em" }}>
            <span style={{ color: "#7DD3A8" }}>{stepCounter}</span>
            {" — "}
            <span style={{ color: "rgba(255,255,255,0.6)", fontWeight: 700 }}>{stepLabel}</span>
          </p>
          {/* Barras de vuelta — compactas para caber en móvil con 30 pasos */}
          <div style={{ display: "flex", gap: 2, flexWrap: "nowrap", maxWidth: "min(94vw, 380px)" }}>
            {Array.from({ length: TOTAL_STEPS }).map((_, i) => {
              const done = i < savedSteps.length;
              const cur  = i === step && phase === "syncing";
              const isSep = i > 0 && i % POSITIONS.length === 0;
              return (
                <div key={i} style={{
                  width: isSep ? 4 : 8,
                  height: 6, borderRadius: 3, flexShrink: 0,
                  marginLeft: isSep ? 4 : 0,
                  background: done ? "#7DD3A8"
                    : cur  ? "rgba(125,211,168,0.45)"
                    : "rgba(255,255,255,0.1)",
                  transition: "background .25s",
                }} />
              );
            })}
          </div>
          <p style={{ margin: 0, fontSize: ".72rem", color: "rgba(255,255,255,0.3)", letterSpacing: ".06em" }}>
            9 puntos × {ROUNDS} vueltas = {TOTAL_STEPS} muestras
          </p>
        </div>
      )}

      {/* ── Área principal — posición libre para los 4 puntos extremos ─────── */}
      <div style={{ flex: 1, position: "relative" }}>

        {/* IDLE / CAPTURED: instrucciones en el centro */}
        {(phase === "idle" || phase === "captured") && (
          <div style={{
            position: "absolute", inset: 0,
            display: "flex", flexDirection: "column",
            alignItems: "center", justifyContent: "center",
            gap: 20, padding: "0 24px",
            animation: "fadeMT .35s ease both",
          }}>
            {phase === "idle" && step === 0 && (
              <p style={{ fontSize: ".85rem", color: "rgba(255,255,255,0.4)", textAlign: "center", lineHeight: 1.7, maxWidth: 320, margin: 0 }}>
                El círculo verde aparecerá en <strong style={{ color: "rgba(255,255,255,0.7)" }}>9 posiciones</strong> distintas, {ROUNDS} veces cada una.<br />
                Mantén la mirada fija en él durante 3 segundos.
              </p>
            )}

            {phase === "captured" && (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16, animation: "popMT .4s cubic-bezier(.34,1.56,.64,1) both" }}>
                <div style={{
                  width: 60, height: 60, borderRadius: "50%",
                  background: "radial-gradient(circle at 38% 38%, #a8e8c8 0%, #7DD3A8 60%, #4db88a 100%)",
                  boxShadow: "0 0 28px rgba(125,211,168,0.6)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  <svg width={28} height={28} viewBox="0 0 28 28" fill="none">
                    <polyline points="5,14 11,20 23,8" stroke="#fff" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
                <p style={{ fontSize: ".82rem", color: "rgba(255,255,255,0.5)", margin: 0 }}>
                  {rawCount} puntos capturados en <strong style={{ color: "#7DD3A8" }}>{currentPos.label}</strong>
                </p>
                <div style={{ display: "flex", gap: 10 }}>
                  <button className="mt-btn" onClick={handleRepeat} style={{
                    background: "rgba(255,255,255,0.06)", border: "1.5px solid rgba(255,255,255,0.18)",
                    borderRadius: 12, color: "rgba(255,255,255,0.6)",
                    padding: "10px 20px", fontFamily: "'Lexend',sans-serif", fontWeight: 700, fontSize: ".8rem",
                    display: "flex", alignItems: "center", gap: 7,
                  }}>
                    <RotateCcw size={13} /> Repetir
                  </button>
                  <button className="mt-btn" onClick={handleSave} style={{
                    background: "rgba(125,211,168,0.18)", border: "2px solid #7DD3A8",
                    borderRadius: 12, color: "#7DD3A8",
                    padding: "10px 24px", fontFamily: "'Lexend',sans-serif", fontWeight: 900, fontSize: ".85rem",
                    display: "flex", alignItems: "center", gap: 7,
                  }}>
                    <CheckCheck size={14} />
                    {step + 1 === TOTAL_STEPS ? "Guardar última muestra" : "Guardar muestra"}
                  </button>
                </div>
              </div>
            )}

            {phase === "idle" && (
              <button className="mt-btn" onClick={handleStart} style={{
                background: "#7DD3A8", color: "#0A2018",
                fontWeight: 900, fontSize: ".95rem", letterSpacing: ".04em",
                padding: "13px 32px", borderRadius: 14,
                boxShadow: "0 0 22px rgba(125,211,168,0.4)",
                display: "flex", alignItems: "center", gap: 10,
              }}>
                <ChevronRight size={17} />
                {step === 0 ? `Comenzar — ${currentPos.label}` : `Continuar — ${currentPos.label}`}
              </button>
            )}
          </div>
        )}

        {/* DONE sin JSON: 30 muestras completadas */}
        {phase === "done" && !finalJson && (
          <div style={{
            position: "absolute", inset: 0,
            display: "flex", flexDirection: "column",
            alignItems: "center", justifyContent: "center",
            gap: 24, padding: "0 24px",
            animation: "fadeMT .4s ease both",
          }}>
            <p style={{ fontSize: ".9rem", color: "rgba(255,255,255,0.55)", textAlign: "center", lineHeight: 1.7, margin: 0 }}>
              ¡{TOTAL_STEPS} muestras completadas en 9 posiciones!<br />
              La regresión usará todos los puntos para calcular el modelo exacto.
            </p>
            <button className="mt-btn" onClick={handleGenerate} style={{
              background: "linear-gradient(135deg, #7DD3A8 0%, #4db88a 100%)",
              border: "none", borderRadius: 16,
              color: "#0A2018", fontFamily: "'Lexend',sans-serif", fontWeight: 900,
              fontSize: "clamp(.9rem,3vw,1.1rem)", letterSpacing: ".05em",
              padding: "15px 34px",
              boxShadow: "0 0 34px rgba(125,211,168,0.55), 0 4px 18px rgba(0,0,0,0.4)",
              display: "flex", alignItems: "center", gap: 11,
              animation: "hbMT 1.6s ease-in-out infinite",
            }}>
              <Dna size={21} /> GENERAR ADN FINAL
            </button>
          </div>
        )}

        {/* DONE con JSON */}
        {phase === "done" && finalJson && (
          <div style={{
            position: "absolute", inset: 0, overflow: "auto",
            display: "flex", flexDirection: "column",
            gap: 14, padding: "16px 20px",
            animation: "fadeMT .4s ease both",
          }}>
            <p style={{
              fontSize: ".77rem", color: "rgba(255,255,255,0.45)", textAlign: "center",
              lineHeight: 1.6, margin: 0,
              background: "rgba(125,211,168,0.08)", border: "1px solid rgba(125,211,168,0.2)",
              borderRadius: 10, padding: "10px 14px",
            }}>
              Copia este código y pégalo en{" "}
              <span style={{ color: "#7DD3A8", fontWeight: 800 }}>gazeProfiles.ts</span>{" "}
              para grabarlo de fábrica.
            </p>
            <div style={{
              background: "#0D1520", border: "1px solid rgba(125,211,168,0.2)",
              borderRadius: 12, padding: "14px 16px", flex: 1, overflow: "auto",
            }}>
              <pre style={{
                margin: 0, fontFamily: "'Courier New',monospace", fontSize: ".71rem",
                color: "#a3e635", lineHeight: 1.75, whiteSpace: "pre-wrap", wordBreak: "break-all",
              }}>
                {finalJson}
              </pre>
            </div>
            <div style={{ display: "flex", gap: 10, justifyContent: "center", flexShrink: 0 }}>
              <button className="mt-btn" onClick={handleCopy} style={{
                background: copied ? "rgba(125,211,168,0.18)" : "rgba(255,255,255,0.08)",
                border: `1.5px solid ${copied ? "#7DD3A8" : "rgba(255,255,255,0.2)"}`,
                borderRadius: 12, color: copied ? "#7DD3A8" : "rgba(255,255,255,0.65)",
                padding: "10px 22px", fontFamily: "'Lexend',sans-serif", fontWeight: 800, fontSize: ".82rem",
                display: "flex", alignItems: "center", gap: 8,
              }}>
                {copied ? <CheckCheck size={14} /> : <ClipboardCopy size={14} />}
                {copied ? "¡Copiado!" : "Copiar JSON"}
              </button>
              <button className="mt-btn" onClick={handleReset} style={{
                background: "transparent", border: "1.5px solid rgba(255,255,255,0.15)",
                borderRadius: 12, color: "rgba(255,255,255,0.35)",
                padding: "10px 18px", fontFamily: "'Lexend',sans-serif", fontWeight: 700, fontSize: ".75rem",
                display: "flex", alignItems: "center", gap: 7,
              }}>
                <RotateCcw size={12} /> Nueva sesión
              </button>
            </div>
          </div>
        )}

        {/* ── Círculo sincronizador (posición libre en pantalla) ────────── */}
        {phase === "syncing" && (
          <div style={{
            position: "absolute",
            left: posX, top: posY,
            transform: "translate(-50%, -50%)",
            display: "flex", flexDirection: "column", alignItems: "center", gap: 10,
          }}>
            {/* Etiqueta de posición */}
            <div style={{
              fontSize: ".68rem", fontWeight: 800, letterSpacing: ".07em", textTransform: "uppercase",
              color: "rgba(125,211,168,0.7)",
              background: "rgba(6,11,16,0.75)", borderRadius: 6, padding: "3px 10px",
              marginBottom: 8, whiteSpace: "nowrap",
            }}>
              {currentPos.label}
            </div>

            {/* Círculo + anillo */}
            <div style={{ position: "relative", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <SyncRing progress={progress} />
              <div style={{
                width: 44, height: 44, borderRadius: "50%",
                background: "radial-gradient(circle at 38% 38%, #a8e8c8 0%, #7DD3A8 55%, #4db88a 100%)",
                boxShadow: "0 0 28px rgba(125,211,168,0.6)",
                animation: "hbMT 1.1s ease-in-out infinite",
                position: "relative", zIndex: 2,
              }} />
            </div>

            {/* Puntos capturados */}
            <div style={{ fontSize: ".65rem", color: "rgba(255,255,255,0.28)", marginTop: 6 }}>
              {rawCount > 0 ? `${rawCount} puntos` : "Mira aquí…"}
            </div>
          </div>
        )}

        {/* Instrucción flotante durante syncing */}
        {phase === "syncing" && (
          <div style={{
            position: "absolute", bottom: 32, left: 0, right: 0,
            display: "flex", justifyContent: "center",
          }}>
            <div style={{
              fontSize: ".78rem", fontWeight: 700, color: "rgba(255,255,255,0.35)",
              background: "rgba(6,11,16,0.7)", borderRadius: 10, padding: "8px 18px",
              letterSpacing: ".04em",
            }}>
              Mantén la mirada fija en el círculo verde
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
