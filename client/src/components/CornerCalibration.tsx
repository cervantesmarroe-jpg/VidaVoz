import { useEffect, useState } from "react";
import { gazeTracker } from "@/hooks/use-webgazer";

// ── Tiempos por punto ──────────────────────────────────────────────────────────
const DWELL_MS  = 2500; // ms totales mirando cada esquina
const SETTLE_MS =  600; // ms iniciales sin muestrear (la sácada llega al target)
const SAMPLE_HZ =   12; // Hz durante la fase de grabación

// Margen px desde cada borde (centro del anillo)
const MARGIN = 70;

// Orden TL → TR → BR → BL
const CORNERS = [
  { id: "tl", x: (_w: number) => MARGIN,      y: (_h: number) => MARGIN      },
  { id: "tr", x:  (w: number) => w - MARGIN,  y: (_h: number) => MARGIN      },
  { id: "br", x:  (w: number) => w - MARGIN,  y:  (h: number) => h - MARGIN  },
  { id: "bl", x: (_w: number) => MARGIN,      y:  (h: number) => h - MARGIN  },
] as const;

// SVG ring
const R    = 38;
const CIRC = +(2 * Math.PI * R).toFixed(2); // ≈ 238.76

interface Props {
  onDone: (success: boolean) => void;
}

export default function CornerCalibration({ onDone }: Props) {
  const [idx,      setIdx]      = useState(0);
  const [progress, setProgress] = useState(0);   // 0 → 1
  const [flash,    setFlash]    = useState(false);
  const [nDone,    setNDone]    = useState(0);    // esquinas ya completadas
  const [finished, setFinished] = useState(false);

  // Efecto principal: conduce UNA esquina completa (settle → record → flash)
  useEffect(() => {
    if (finished) return;

    const W   = window.innerWidth;
    const H   = window.innerHeight;
    const c   = CORNERS[idx];
    const scx = c.x(W);
    const scy = c.y(H);

    let rafId: number;
    const t0 = performance.now();

    const tick = () => {
      const prog = Math.min((performance.now() - t0) / DWELL_MS, 1);
      setProgress(prog);
      if (prog < 1) rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);

    const sampleIv = setInterval(() => {
      if (performance.now() - t0 >= SETTLE_MS) {
        gazeTracker.recordCalibrationPoint(scx, scy);
      }
    }, 1000 / SAMPLE_HZ);

    const dwellT = setTimeout(() => {
      cancelAnimationFrame(rafId);
      clearInterval(sampleIv);
      setProgress(1);
      setFlash(true);

      setTimeout(() => {
        setFlash(false);
        const next = idx + 1;
        if (next < CORNERS.length) {
          setNDone(next);
          setProgress(0);
          setIdx(next);
        } else {
          // Todos los puntos completados → calcular modelo
          const model = gazeTracker.finalizeTraining();
          setFinished(true);
          setNDone(CORNERS.length);
          setTimeout(() => onDone(model !== null), 700);
        }
      }, 380);
    }, DWELL_MS);

    return () => {
      cancelAnimationFrame(rafId);
      clearInterval(sampleIv);
      clearTimeout(dwellT);
    };
  }, [idx]); // eslint-disable-line react-hooks/exhaustive-deps

  const W = window.innerWidth;
  const H = window.innerHeight;

  const ringStroke = flash ? "#34d399" : "#fbbf24";
  const dotFill    = flash ? "#34d399" : "#fbbf24";
  const dotSize    = R * 2 + 10; // px del SVG

  return (
    <div
      data-testid="corner-calibration"
      style={{
        position: "fixed", inset: 0, zIndex: 9999,
        background: "rgba(8, 8, 12, 0.93)",
        fontFamily: "'Lexend', sans-serif",
        userSelect: "none",
        WebkitUserSelect: "none" as const,
        pointerEvents: "all",
      }}
    >
      {/* ── Texto instrucción (centro) ── */}
      <p style={{
        position: "absolute",
        top: "50%", left: "50%",
        transform: "translate(-50%, -50%)",
        color: "#fff",
        fontSize: "clamp(1rem, 2.6vw, 1.4rem)",
        fontWeight: 700,
        textAlign: "center",
        lineHeight: 1.6,
        margin: 0,
        pointerEvents: "none",
        maxWidth: "56vw",
      }}>
        {finished
          ? "✓ Calibración completada"
          : (
            <>
              Mire el punto amarillo<br />
              <span style={{ fontWeight: 400, opacity: 0.75, fontSize: "0.85em" }}>
                Espere a que el círculo se complete ({idx + 1} / {CORNERS.length})
              </span>
            </>
          )
        }
      </p>

      {/* ── Puntos completados (verde) ── */}
      {CORNERS.map((c, i) => {
        if (i >= nDone) return null;
        return (
          <div key={`ok-${c.id}`} style={{
            position: "absolute",
            left: c.x(W), top: c.y(H),
            transform: "translate(-50%, -50%)",
            width: 20, height: 20,
            borderRadius: "50%",
            background: "#34d399",
            boxShadow: "0 0 10px rgba(52,211,153,0.55)",
            pointerEvents: "none",
          }} />
        );
      })}

      {/* ── Puntos pendientes (gris tenue) ── */}
      {CORNERS.map((c, i) => {
        if (i <= idx || finished) return null;
        return (
          <div key={`pending-${c.id}`} style={{
            position: "absolute",
            left: c.x(W), top: c.y(H),
            transform: "translate(-50%, -50%)",
            width: 14, height: 14,
            borderRadius: "50%",
            background: "rgba(255,255,255,0.15)",
            border: "1.5px solid rgba(255,255,255,0.22)",
            pointerEvents: "none",
          }} />
        );
      })}

      {/* ── Punto activo con anillo de cuenta regresiva ── */}
      {!finished && (() => {
        const c  = CORNERS[idx];
        const px = c.x(W);
        const py = c.y(H);
        const dashOffset = +(CIRC * (1 - progress)).toFixed(2);
        return (
          <div style={{
            position: "absolute",
            left: px, top: py,
            transform: "translate(-50%, -50%)",
            pointerEvents: "none",
          }}>
            <svg width={dotSize} height={dotSize} viewBox={`0 0 ${dotSize} ${dotSize}`}>
              {/* Pista del anillo */}
              <circle
                cx={dotSize / 2} cy={dotSize / 2} r={R}
                fill="none"
                stroke="rgba(255,255,255,0.10)"
                strokeWidth="5"
              />
              {/* Progreso */}
              <circle
                cx={dotSize / 2} cy={dotSize / 2} r={R}
                fill="none"
                stroke={ringStroke}
                strokeWidth="5"
                strokeLinecap="round"
                strokeDasharray={CIRC}
                strokeDashoffset={dashOffset}
                transform={`rotate(-90 ${dotSize / 2} ${dotSize / 2})`}
                style={{ transition: "stroke 0.2s" }}
              />
              {/* Punto central */}
              <circle
                cx={dotSize / 2} cy={dotSize / 2} r={11}
                fill={dotFill}
                style={{ transition: "fill 0.2s" }}
              />
              {/* Número de esquina */}
              <text
                x={dotSize / 2} y={dotSize / 2 + 5}
                textAnchor="middle"
                fill="#111"
                fontSize="13"
                fontWeight="900"
                fontFamily="Lexend, sans-serif"
              >
                {idx + 1}
              </text>
            </svg>
          </div>
        );
      })()}
    </div>
  );
}
