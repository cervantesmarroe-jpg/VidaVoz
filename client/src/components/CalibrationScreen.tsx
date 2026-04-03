import { useEffect, useState, useRef, useCallback } from "react";
import { gazeTracker, useWebGazerStore } from "@/hooks/use-webgazer";
import { X } from "lucide-react";

// Desactiva el blink-click durante toda la pantalla de calibración
function useDisableBlink() {
  useEffect(() => {
    gazeTracker.setBlinkEnabled(false);
    return () => { gazeTracker.setBlinkEnabled(true); };
  }, []);
}

// ── Constantes ───────────────────────────────────────────────────────────────
const DWELL_TOTAL_MS  = 3000;   // duración del foco central
const COLLECT_RATE_MS = 50;     // muestreo cada 50 ms → 20 fps
const WARMUP_MS       = 400;    // retardo antes de capturar (parpadeo de adaptación)
const SUCCESS_SHOW_MS = 1400;   // tiempo que se ve el estado "listo" antes de cerrar

// Radios del anillo SVG de progreso
const R_OUTER = 72;             // radio del anillo exterior
const CIRCUMF  = 2 * Math.PI * R_OUTER;

type Phase = "syncing" | "success";

// ── Anillo SVG de progreso ────────────────────────────────────────────────────
function SyncRing({ progress }: { progress: number }) {
  const offset = CIRCUMF * (1 - Math.min(progress, 1));
  const size   = (R_OUTER + 12) * 2;
  return (
    <svg
      width={size} height={size}
      style={{
        position: "absolute",
        top: "50%", left: "50%",
        transform: "translate(-50%,-50%) rotate(-90deg)",
        pointerEvents: "none",
      }}
    >
      {/* Pista de fondo */}
      <circle
        cx={size / 2} cy={size / 2} r={R_OUTER}
        fill="none"
        stroke="rgba(125,211,168,0.18)"
        strokeWidth={7}
      />
      {/* Arco de progreso */}
      <circle
        cx={size / 2} cy={size / 2} r={R_OUTER}
        fill="none"
        stroke="#7DD3A8"
        strokeWidth={7}
        strokeLinecap="round"
        strokeDasharray={CIRCUMF}
        strokeDashoffset={offset}
        style={{ transition: "stroke-dashoffset 0.06s linear" }}
      />
    </svg>
  );
}

// ── Pantalla de Sincronización Rápida ─────────────────────────────────────────
export function CalibrationScreen() {
  useDisableBlink();
  const { finishCalibration, deactivate } = useWebGazerStore();

  const [phase, setPhase]       = useState<Phase>("syncing");
  const [progress, setProgress] = useState(0);
  const [samples, setSamples]   = useState(0);

  // Para cancelar los timers al desmontar
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const ivsRef    = useRef<ReturnType<typeof setInterval>[]>([]);

  const clearAll = useCallback(() => {
    timersRef.current.forEach(clearTimeout);
    ivsRef.current.forEach(clearInterval);
    timersRef.current = [];
    ivsRef.current    = [];
  }, []);

  // ── Fase syncing: recoger muestras del punto central ──────────────────────
  useEffect(() => {
    if (phase !== "syncing") return;
    setProgress(0);
    setSamples(0);
    gazeTracker.clearCalibration();

    const centerX = window.innerWidth  / 2;
    const centerY = window.innerHeight / 2;

    const startTime = Date.now();

    // Retardo de calentamiento → ignorar primeras muestras
    let collecting = false;
    const warmup = setTimeout(() => { collecting = true; }, WARMUP_MS);
    timersRef.current.push(warmup);

    // Muestreo
    const collector = setInterval(() => {
      if (!collecting) return;
      const ok = gazeTracker.recordCalibrationPoint(centerX, centerY);
      if (ok) setSamples(s => s + 1);
    }, COLLECT_RATE_MS);
    ivsRef.current.push(collector);

    // Progreso visual
    const progressIv = setInterval(() => {
      const p = Math.min((Date.now() - startTime) / DWELL_TOTAL_MS, 1);
      setProgress(p);
    }, 40);
    ivsRef.current.push(progressIv);

    // Fin del dwell
    const done = setTimeout(() => {
      clearAll();
      const ok = gazeTracker.quickCenterCalibrate();
      if (ok) {
        setPhase("success");
      } else {
        // Sin cara detectada → reintentar
        setPhase("syncing");
      }
    }, DWELL_TOTAL_MS);
    timersRef.current.push(done);

    return clearAll;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  // ── Fase success: activar tracking y cerrar ───────────────────────────────
  useEffect(() => {
    if (phase !== "success") return;
    const t = setTimeout(() => {
      finishCalibration();
      gazeTracker.startDetection();
    }, SUCCESS_SHOW_MS);
    return () => clearTimeout(t);
  }, [phase, finishCalibration]);

  const handleCancel = useCallback(() => {
    clearAll();
    deactivate();
    gazeTracker.stopCamera();
  }, [clearAll, deactivate]);

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 9999,
        background: "#000000",
        display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center",
        fontFamily: "'Lexend', sans-serif",
        userSelect: "none",
        overflow: "hidden",
      }}
    >
      <style>{`
        @keyframes heartbeat {
          0%,100% { transform: scale(1);     opacity: 1; }
          14%      { transform: scale(1.18);  opacity: 0.95; }
          28%      { transform: scale(1);     opacity: 1; }
          42%      { transform: scale(1.10);  opacity: 0.95; }
          70%      { transform: scale(1);     opacity: 1; }
        }
        @keyframes popIn {
          0%   { transform: scale(0.4); opacity: 0; }
          70%  { transform: scale(1.08); opacity: 1; }
          100% { transform: scale(1);   opacity: 1; }
        }
        @keyframes fadeSlideUp {
          from { opacity: 0; transform: translateY(12px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      {/* Botón cancelar (esquina superior derecha) */}
      <button
        onClick={handleCancel}
        data-testid="button-cancel-calibration"
        style={{
          position: "absolute", top: 20, right: 20,
          background: "rgba(255,255,255,0.07)",
          border: "1px solid rgba(255,255,255,0.14)",
          borderRadius: 10, color: "rgba(255,255,255,0.45)",
          padding: "8px 14px", cursor: "pointer",
          fontSize: "0.75rem", fontWeight: 700,
          display: "flex", alignItems: "center", gap: 6,
        }}
      >
        <X size={13} /> Cancelar
      </button>

      {/* ── Estado: SINCRONIZANDO ─────────────────────────────────────────── */}
      {phase === "syncing" && (
        <>
          {/* Texto superior */}
          <p style={{
            position: "absolute", top: "18%", left: 0, right: 0,
            textAlign: "center",
            fontSize: "clamp(1rem,3.5vw,1.35rem)",
            fontWeight: 600,
            color: "rgba(255,255,255,0.55)",
            letterSpacing: ".04em",
            animation: "fadeSlideUp .5s ease both",
          }}>
            Sincronización Rápida
          </p>

          {/* Instrucción */}
          <p style={{
            position: "absolute", top: "calc(18% + 3rem)", left: 0, right: 0,
            textAlign: "center",
            fontSize: "clamp(.8rem,2.5vw,1rem)",
            color: "rgba(255,255,255,0.28)",
            animation: "fadeSlideUp .6s ease .1s both",
          }}>
            Mira el círculo verde
          </p>

          {/* Círculo central con anillo de progreso */}
          <div style={{ position: "relative", display: "flex", alignItems: "center", justifyContent: "center" }}>
            {/* Anillo SVG */}
            <SyncRing progress={progress} />

            {/* Halo exterior */}
            <div style={{
              position: "absolute",
              width: 110, height: 110,
              borderRadius: "50%",
              background: "radial-gradient(circle, rgba(125,211,168,0.15) 0%, transparent 70%)",
            }} />

            {/* Círculo interior con latido */}
            <div style={{
              width:  60, height: 60,
              borderRadius: "50%",
              background: "radial-gradient(circle at 38% 38%, #a8e8c8 0%, #7DD3A8 55%, #4db88a 100%)",
              boxShadow: "0 0 32px rgba(125,211,168,0.55), 0 0 8px rgba(125,211,168,0.3)",
              animation: "heartbeat 1.1s ease-in-out infinite",
              position: "relative", zIndex: 2,
            }} />
          </div>

          {/* Contador de muestras (debug discreto) */}
          {samples > 0 && (
            <p style={{
              position: "absolute", bottom: "22%",
              fontSize: ".68rem", color: "rgba(125,211,168,0.35)",
              letterSpacing: ".08em",
            }}>
              {samples} muestras
            </p>
          )}
        </>
      )}

      {/* ── Estado: LISTO ────────────────────────────────────────────────── */}
      {phase === "success" && (
        <div style={{
          display: "flex", flexDirection: "column",
          alignItems: "center", gap: 20,
          animation: "popIn .45s cubic-bezier(.34,1.56,.64,1) both",
        }}>
          {/* Círculo con check */}
          <div style={{
            width: 96, height: 96, borderRadius: "50%",
            background: "radial-gradient(circle at 38% 38%, #a8e8c8 0%, #7DD3A8 60%, #4db88a 100%)",
            boxShadow: "0 0 48px rgba(125,211,168,0.7)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <svg width={46} height={46} viewBox="0 0 46 46" fill="none">
              <polyline
                points="9,24 19,34 37,13"
                stroke="#fff" strokeWidth={4.5}
                strokeLinecap="round" strokeLinejoin="round"
              />
            </svg>
          </div>

          <p style={{
            fontSize: "clamp(1.1rem,3vw,1.5rem)",
            fontWeight: 800,
            color: "#7DD3A8",
            letterSpacing: ".04em",
            textAlign: "center",
          }}>
            ¡Listo!
          </p>

          <p style={{
            fontSize: ".85rem",
            color: "rgba(255,255,255,0.4)",
            textAlign: "center",
          }}>
            Activando seguimiento de mirada…
          </p>
        </div>
      )}
    </div>
  );
}
