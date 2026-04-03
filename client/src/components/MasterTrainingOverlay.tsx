import { useState, useEffect, useRef, useCallback } from "react";
import { gazeTracker } from "@/hooks/use-webgazer";
import { X, ClipboardCopy, CheckCheck, Dna, RotateCcw, ChevronRight } from "lucide-react";

// ── Constantes ────────────────────────────────────────────────────────────────
const MAX_SAMPLES    = 10;
const DWELL_MS       = 3000;
const COLLECT_MS     = 50;
const WARMUP_MS      = 400;
const R_RING         = 60;
const CIRCUMF        = 2 * Math.PI * R_RING;

interface ModelSnapshot {
  alphaX: number; betaX: number;
  alphaY: number; betaY: number;
}

type Phase = "idle" | "syncing" | "captured" | "done";

// ── Anillo SVG ────────────────────────────────────────────────────────────────
function SyncRing({ progress }: { progress: number }) {
  const offset = CIRCUMF * (1 - Math.min(progress, 1));
  const sz     = (R_RING + 12) * 2;
  return (
    <svg width={sz} height={sz}
      style={{ position:"absolute", top:"50%", left:"50%",
        transform:"translate(-50%,-50%) rotate(-90deg)", pointerEvents:"none" }}
    >
      <circle cx={sz/2} cy={sz/2} r={R_RING}
        fill="none" stroke="rgba(125,211,168,0.18)" strokeWidth={7} />
      <circle cx={sz/2} cy={sz/2} r={R_RING}
        fill="none" stroke="#7DD3A8" strokeWidth={7}
        strokeLinecap="round"
        strokeDasharray={CIRCUMF}
        strokeDashoffset={offset}
        style={{ transition:"stroke-dashoffset 0.06s linear" }}
      />
    </svg>
  );
}

// ── Indicador de muestra ──────────────────────────────────────────────────────
function SampleDots({ total, count }: { total: number; count: number }) {
  return (
    <div style={{ display:"flex", gap:6, flexWrap:"wrap", justifyContent:"center", maxWidth:260 }}>
      {Array.from({ length: total }).map((_, i) => (
        <div key={i} style={{
          width: 14, height: 14, borderRadius: "50%",
          background: i < count ? "#7DD3A8" : "rgba(255,255,255,0.12)",
          border: `2px solid ${i < count ? "#7DD3A8" : "rgba(255,255,255,0.2)"}`,
          transition: "background 0.25s, border-color 0.25s",
        }} />
      ))}
    </div>
  );
}

// ── MasterTrainingOverlay ─────────────────────────────────────────────────────
interface Props {
  onClose: () => void;
}

export function MasterTrainingOverlay({ onClose }: Props) {
  const [phase, setPhase]       = useState<Phase>("idle");
  const [samples, setSamples]   = useState<ModelSnapshot[]>([]);
  const [progress, setProgress] = useState(0);
  const [rawSamples, setRawSamples] = useState(0);  // muestras capturadas en la ronda
  const [copied, setCopied]     = useState(false);
  const [finalJson, setFinalJson] = useState<string>("");
  const [cameraReady, setCameraReady] = useState(false);

  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const ivs    = useRef<ReturnType<typeof setInterval>[]>([]);

  const clearAll = useCallback(() => {
    timers.current.forEach(clearTimeout);
    ivs.current.forEach(clearInterval);
    timers.current = []; ivs.current = [];
  }, []);

  // ── Iniciar cámara al montar ──────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      gazeTracker.clearCalibration();
      if (!gazeTracker.hasFaceModel) await gazeTracker.init();
      if (!gazeTracker.hasCamera)    await gazeTracker.startCamera();
      gazeTracker.startDetection();
      setCameraReady(true);
    })();
    return () => {
      clearAll();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Fase syncing: recoger muestras 3 s en el centro ──────────────────────
  useEffect(() => {
    if (phase !== "syncing" || !cameraReady) return;

    setProgress(0);
    setRawSamples(0);
    gazeTracker.clearCalibration();  // limpia datos anteriores de esta ronda

    const cx = window.innerWidth  / 2;
    const cy = window.innerHeight / 2;
    const t0 = Date.now();
    let collecting = false;

    const warmup = setTimeout(() => { collecting = true; }, WARMUP_MS);
    timers.current.push(warmup);

    const collector = setInterval(() => {
      if (!collecting) return;
      const ok = gazeTracker.recordCalibrationPoint(cx, cy);
      if (ok) setRawSamples(s => s + 1);
    }, COLLECT_MS);
    ivs.current.push(collector);

    const progressIv = setInterval(() => {
      setProgress(Math.min((Date.now() - t0) / DWELL_MS, 1));
    }, 40);
    ivs.current.push(progressIv);

    const done = setTimeout(() => {
      clearAll();
      const ok = gazeTracker.quickCenterCalibrate();
      if (ok) {
        setPhase("captured");
      } else {
        // Sin cara detectada → reintentar automáticamente
        setPhase("syncing");
      }
    }, DWELL_MS);
    timers.current.push(done);

    return clearAll;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, cameraReady]);

  // ── Guardar muestra ───────────────────────────────────────────────────────
  const handleSave = useCallback(() => {
    const m = gazeTracker.getModel();
    if (!m) return;
    const snap: ModelSnapshot = {
      alphaX: m.alphaX, betaX: m.betaX,
      alphaY: m.alphaY, betaY: m.betaY,
    };
    setSamples(prev => {
      const next = [...prev, snap];
      console.log(
        `%c[MasterTraining] Muestra ${next.length}/${MAX_SAMPLES} guardada`,
        'color:#7DD3A8;font-weight:800',
        snap,
      );
      return next;
    });
    // Siguiente ronda (o fin)
    setSamples(prev => {
      if (prev.length >= MAX_SAMPLES) {
        setPhase("done");
      } else {
        setPhase("idle");
      }
      return prev;
    });
  }, []);

  // ── Repetir ronda sin guardar ─────────────────────────────────────────────
  const handleRepeat = useCallback(() => {
    setPhase("syncing");
  }, []);

  // ── Iniciar siguiente muestra ─────────────────────────────────────────────
  const handleStart = useCallback(() => {
    if (samples.length >= MAX_SAMPLES) return;
    setPhase("syncing");
  }, [samples.length]);

  // ── Generar ADN Final ────────────────────────────────────────────────────
  const handleGenerate = useCallback(() => {
    if (samples.length === 0) return;
    const n = samples.length;
    const avg = (key: keyof ModelSnapshot) =>
      +(samples.reduce((s, m) => s + m[key], 0) / n).toFixed(4);

    const avgAlphaX = avg("alphaX");
    const avgBetaX  = avg("betaX");
    const avgAlphaY = avg("alphaY");
    const avgBetaY  = avg("betaY");

    const W = window.innerWidth;
    const H = window.innerHeight;

    const result = {
      _instruccion: "Copia este bloque y pégalo en gazeProfiles.ts para grabarlo de fábrica",
      profile: gazeTracker.currentProfile.id,
      generatedAt: new Date().toISOString(),
      samples: n,
      screen: { widthPx: W, heightPx: H, pixelRatio: window.devicePixelRatio },
      averageModel: {
        alphaX: avgAlphaX,
        betaX:  avgBetaX,
        alphaY: avgAlphaY,
        betaY:  avgBetaY,
      },
      derivedSensitivities: {
        sensitivityX: +(avgBetaX / W).toFixed(4),
        sensitivityY: +(-avgBetaY / H).toFixed(4),
        _nota: "Reemplaza los valores en GAZE_PROFILES['" +
          gazeTracker.currentProfile.id + "'].sensitivityX/Y",
      },
      allSamples: samples.map((s, i) => ({
        i: i + 1,
        alphaX: +s.alphaX.toFixed(3), betaX: +s.betaX.toFixed(3),
        alphaY: +s.alphaY.toFixed(3), betaY: +s.betaY.toFixed(3),
      })),
    };

    const json = JSON.stringify(result, null, 2);
    setFinalJson(json);
    console.groupCollapsed('%c[MasterTraining] ADN FINAL generado', 'color:#7DD3A8;font-weight:900;font-size:14px');
    console.log(json);
    console.groupEnd();
  }, [samples]);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(finalJson).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    });
  }, [finalJson]);

  const handleClose = useCallback(() => {
    clearAll();
    if (!gazeTracker.hasCamera) return;  // ya parada
    onClose();
  }, [clearAll, onClose]);

  const count = samples.length;
  const isFullyDone = phase === "done" && finalJson !== "";

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 10000,
      background: "#060B10",
      display: "flex", flexDirection: "column",
      alignItems: "center",
      fontFamily: "'Lexend', 'Inter', sans-serif",
      userSelect: "none", overflow: "hidden",
    }}>
      <style>{`
        @keyframes hb { 0%,100%{transform:scale(1)} 14%{transform:scale(1.2)} 28%{transform:scale(1)} 42%{transform:scale(1.12)} 70%{transform:scale(1)} }
        @keyframes popMT { 0%{transform:scale(0.4);opacity:0} 70%{transform:scale(1.08);opacity:1} 100%{transform:scale(1);opacity:1} }
        @keyframes fadeMT { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
        .mt-btn { transition: transform 0.12s, opacity 0.12s; cursor:pointer; border:none; }
        .mt-btn:active { transform: scale(0.94) !important; }
      `}</style>

      {/* ── Cabecera ─────────────────────────────────────────────────────── */}
      <div style={{
        width:"100%", display:"flex", alignItems:"center", justifyContent:"space-between",
        padding:"16px 20px 10px", borderBottom:"1px solid rgba(255,255,255,0.07)", flexShrink:0,
      }}>
        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
          <Dna size={20} color="#7DD3A8" />
          <span style={{ fontSize:"0.9rem", fontWeight:800, color:"#FFFFFF", letterSpacing:".04em" }}>
            Entrenamiento Maestro
          </span>
          <span style={{
            fontSize:"0.68rem", fontWeight:700, letterSpacing:".1em",
            textTransform:"uppercase",
            color: gazeTracker.currentProfile.id === "mobile" ? "#8BA7CC" : "#a78bfa",
            background: gazeTracker.currentProfile.id === "mobile" ? "rgba(139,167,204,0.12)" : "rgba(167,139,250,0.12)",
            border: `1px solid ${gazeTracker.currentProfile.id === "mobile" ? "rgba(139,167,204,0.3)" : "rgba(167,139,250,0.3)"}`,
            borderRadius:6, padding:"2px 8px",
          }}>
            {gazeTracker.currentProfile.label}
          </span>
        </div>
        <button className="mt-btn" onClick={handleClose} style={{
          background:"rgba(255,255,255,0.07)", border:"1px solid rgba(255,255,255,0.14)",
          borderRadius:8, color:"rgba(255,255,255,0.45)", padding:"6px 12px",
          display:"flex", alignItems:"center", gap:5, fontSize:"0.72rem", fontWeight:700,
        }}>
          <X size={12} /> Cerrar
        </button>
      </div>

      {/* ── Contador + dots ──────────────────────────────────────────────── */}
      <div style={{
        display:"flex", flexDirection:"column", alignItems:"center", gap:12,
        padding:"18px 0 10px", flexShrink:0,
      }}>
        <p style={{
          fontSize:"clamp(1rem,3.5vw,1.3rem)", fontWeight:900, color:"#FFFFFF",
          margin:0, letterSpacing:".04em",
        }}>
          Muestra{" "}
          <span style={{ color:"#7DD3A8" }}>{Math.min(count + (phase === "captured" ? 0 : 0), MAX_SAMPLES)}</span>
          {" "}de{" "}
          <span style={{ color:"rgba(255,255,255,0.5)" }}>{MAX_SAMPLES}</span>
        </p>
        <SampleDots total={MAX_SAMPLES} count={count} />
      </div>

      {/* ── Contenido central ────────────────────────────────────────────── */}
      <div style={{
        flex:1, display:"flex", flexDirection:"column",
        alignItems:"center", justifyContent:"center",
        padding:"0 24px", gap:28, width:"100%", maxWidth:460,
        overflow: isFullyDone ? "auto" : "hidden",
      }}>

        {/* IDLE: listo para siguiente muestra */}
        {phase === "idle" && (
          <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:24, animation:"fadeMT .35s ease both" }}>
            {count === 0 && (
              <p style={{ fontSize:".9rem", color:"rgba(255,255,255,0.45)", textAlign:"center", lineHeight:1.6, maxWidth:320 }}>
                Mira el círculo verde durante 3 segundos.<br />
                Repite desde distintas posiciones de cabeza para obtener un promedio robusto.
              </p>
            )}
            <button className="mt-btn" onClick={handleStart} style={{
              background:"#7DD3A8", color:"#0A2018",
              fontWeight:900, fontSize:"1rem", letterSpacing:".04em",
              padding:"14px 36px", borderRadius:16,
              boxShadow:"0 0 24px rgba(125,211,168,0.35)",
              display:"flex", alignItems:"center", gap:10,
            }}>
              <ChevronRight size={18} />
              {count === 0 ? "Iniciar muestra 1" : `Iniciar muestra ${count + 1}`}
            </button>
          </div>
        )}

        {/* SYNCING: círculo verde + anillo de progreso */}
        {phase === "syncing" && (
          <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:20, animation:"fadeMT .3s ease both" }}>
            <p style={{ fontSize:".85rem", color:"rgba(255,255,255,0.35)", letterSpacing:".06em", margin:0 }}>
              {rawSamples > 0 ? `${rawSamples} muestras capturadas` : "Mira el círculo…"}
            </p>
            <div style={{ position:"relative", display:"flex", alignItems:"center", justifyContent:"center" }}>
              <SyncRing progress={progress} />
              <div style={{
                position:"absolute", width:100, height:100, borderRadius:"50%",
                background:"radial-gradient(circle, rgba(125,211,168,0.1) 0%, transparent 70%)",
              }} />
              <div style={{
                width:52, height:52, borderRadius:"50%",
                background:"radial-gradient(circle at 38% 38%, #a8e8c8 0%, #7DD3A8 55%, #4db88a 100%)",
                boxShadow:"0 0 30px rgba(125,211,168,0.55)",
                animation:"hb 1.1s ease-in-out infinite",
                position:"relative", zIndex:2,
              }} />
            </div>
          </div>
        )}

        {/* CAPTURED: sync completado, elegir guardar o repetir */}
        {phase === "captured" && (
          <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:20, animation:"popMT .4s cubic-bezier(.34,1.56,.64,1) both" }}>
            {/* Icono check */}
            <div style={{
              width:70, height:70, borderRadius:"50%",
              background:"radial-gradient(circle at 38% 38%, #a8e8c8 0%, #7DD3A8 60%, #4db88a 100%)",
              boxShadow:"0 0 32px rgba(125,211,168,0.6)",
              display:"flex", alignItems:"center", justifyContent:"center",
            }}>
              <svg width={32} height={32} viewBox="0 0 32 32" fill="none">
                <polyline points="6,16 13,23 26,9" stroke="#fff" strokeWidth={3.5} strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>

            <p style={{ fontSize:".85rem", color:"rgba(255,255,255,0.5)", margin:0 }}>
              Muestra {count + 1} lista — ¿guardar o repetir?
            </p>

            <div style={{ display:"flex", gap:12 }}>
              {/* Repetir */}
              <button className="mt-btn" onClick={handleRepeat} style={{
                background:"rgba(255,255,255,0.06)", border:"1.5px solid rgba(255,255,255,0.18)",
                borderRadius:12, color:"rgba(255,255,255,0.6)",
                padding:"11px 22px", fontFamily:"'Lexend',sans-serif", fontWeight:700, fontSize:".82rem",
                display:"flex", alignItems:"center", gap:7,
              }}>
                <RotateCcw size={14} /> Repetir
              </button>

              {/* Guardar muestra */}
              <button className="mt-btn" onClick={handleSave} style={{
                background:"rgba(125,211,168,0.18)", border:"2px solid #7DD3A8",
                borderRadius:12, color:"#7DD3A8",
                padding:"11px 26px", fontFamily:"'Lexend',sans-serif", fontWeight:900, fontSize:".88rem",
                display:"flex", alignItems:"center", gap:7,
              }}>
                <CheckCheck size={15} />
                {count + 1 === MAX_SAMPLES ? "Guardar muestra final" : `Guardar muestra ${count + 1}`}
              </button>
            </div>
          </div>
        )}

        {/* DONE: 10 muestras guardadas */}
        {phase === "done" && !finalJson && (
          <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:24, animation:"fadeMT .4s ease both" }}>
            <p style={{ fontSize:".9rem", color:"rgba(255,255,255,0.55)", textAlign:"center", lineHeight:1.7 }}>
              ¡{MAX_SAMPLES} muestras completadas!<br />
              Pulsa el botón para calcular los coeficientes promedio.
            </p>
            <button className="mt-btn" onClick={handleGenerate} style={{
              background:"linear-gradient(135deg, #7DD3A8 0%, #4db88a 100%)",
              border:"none", borderRadius:16,
              color:"#0A2018", fontFamily:"'Lexend',sans-serif", fontWeight:900,
              fontSize:"clamp(.9rem,3vw,1.1rem)", letterSpacing:".05em",
              padding:"16px 36px",
              boxShadow:"0 0 36px rgba(125,211,168,0.55), 0 4px 20px rgba(0,0,0,0.4)",
              display:"flex", alignItems:"center", gap:12,
              animation:"hb 1.6s ease-in-out infinite",
            }}>
              <Dna size={22} />
              GENERAR ADN FINAL
            </button>
          </div>
        )}

        {/* DONE + JSON generado */}
        {phase === "done" && finalJson && (
          <div style={{ display:"flex", flexDirection:"column", gap:16, width:"100%", animation:"fadeMT .4s ease both" }}>
            {/* Instrucción */}
            <p style={{
              fontSize:".78rem", color:"rgba(255,255,255,0.45)", textAlign:"center",
              lineHeight:1.6, margin:0,
              background:"rgba(125,211,168,0.08)", border:"1px solid rgba(125,211,168,0.2)",
              borderRadius:10, padding:"10px 14px",
            }}>
              Copia este código y pégalo en el archivo de configuración
              <span style={{ color:"#7DD3A8", fontWeight:800 }}> gazeProfiles.ts </span>
              para grabarlo de fábrica.
            </p>

            {/* JSON */}
            <div style={{
              background:"#0D1520", border:"1px solid rgba(125,211,168,0.2)",
              borderRadius:12, padding:"14px 16px", overflow:"auto", maxHeight:"42vh",
              position:"relative",
            }}>
              <pre style={{
                margin:0, fontFamily:"'Courier New',monospace", fontSize:".72rem",
                color:"#a3e635", lineHeight:1.75, whiteSpace:"pre-wrap", wordBreak:"break-all",
              }}>
                {finalJson}
              </pre>
            </div>

            {/* Botones */}
            <div style={{ display:"flex", gap:10, justifyContent:"center" }}>
              <button className="mt-btn" onClick={handleCopy} style={{
                background: copied ? "rgba(125,211,168,0.18)" : "rgba(255,255,255,0.08)",
                border: `1.5px solid ${copied ? "#7DD3A8" : "rgba(255,255,255,0.2)"}`,
                borderRadius:12, color: copied ? "#7DD3A8" : "rgba(255,255,255,0.65)",
                padding:"10px 22px", fontFamily:"'Lexend',sans-serif", fontWeight:800, fontSize:".82rem",
                display:"flex", alignItems:"center", gap:8,
              }}>
                {copied ? <CheckCheck size={15} /> : <ClipboardCopy size={15} />}
                {copied ? "¡Copiado!" : "Copiar JSON"}
              </button>

              <button className="mt-btn" onClick={() => { setSamples([]); setFinalJson(""); setPhase("idle"); }} style={{
                background:"transparent", border:"1.5px solid rgba(255,255,255,0.15)",
                borderRadius:12, color:"rgba(255,255,255,0.35)",
                padding:"10px 18px", fontFamily:"'Lexend',sans-serif", fontWeight:700, fontSize:".75rem",
                display:"flex", alignItems:"center", gap:7,
              }}>
                <RotateCcw size={13} /> Nueva sesión
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
