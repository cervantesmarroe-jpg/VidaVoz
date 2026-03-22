import { useState, useRef, useCallback } from "react";
import { FullscreenLayout } from "@/components/FullscreenLayout";
import { playBell } from "@/lib/audio";
import { useTTS } from "@/hooks/use-tts";
import { RotateCcw } from "lucide-react";

const DWELL_MS = 2500;

// Gradiente de alta saturación: verde esmeralda → rojo vivo
const STRIP_GRADIENT = "linear-gradient(to right, #28A745 0%, #DC3545 100%)";

interface StripDef {
  id: string;
  label: string;
  phrase: (v: number) => string;
}

const STRIPS: StripDef[] = [
  {
    id: "dolor",
    label: "DOLOR",
    phrase: (v) => `Mi nivel de dolor es ${v} sobre diez.`,
  },
  {
    id: "respiracion",
    label: "RESPIRACIÓN",
    phrase: (v) => `Mi nivel de falta de aire es ${v} sobre diez.`,
  },
  {
    id: "ansiedad",
    label: "ANSIEDAD",
    phrase: (v) => `Mi nivel de ansiedad es ${v} sobre diez.`,
  },
];

// ── Franja interactiva ────────────────────────────────────────────────────────
function GazeStrip({ strip }: { strip: StripDef }) {
  const { speak }   = useTTS();
  const stripRef    = useRef<HTMLDivElement>(null);
  const timerRef    = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastValRef  = useRef<number | null>(null);

  // Valor 1-10 bajo el puntero; null si fuera de la franja
  const [hoverVal, setHoverVal]   = useState<number | null>(null);
  // Valor bloqueado tras 2.5s de dwell
  const [lockedVal, setLockedVal] = useState<number | null>(null);

  const xToVal = useCallback((clientX: number): number | null => {
    const rect = stripRef.current?.getBoundingClientRect();
    if (!rect) return null;
    const relX = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    return Math.max(1, Math.min(10, Math.round(relX * 9) + 1));
  }, []);

  const onPointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    const val = xToVal(e.clientX);
    if (val === null) return;
    setHoverVal(val);

    // Solo reinicia el dwell si el valor cambió
    if (val !== lastValRef.current) {
      lastValRef.current = val;
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        timerRef.current = null;
        setLockedVal(val);
        playBell();
        speak(strip.phrase(val));
      }, DWELL_MS);
    }
  }, [xToVal, strip, speak]);

  const onPointerLeave = useCallback(() => {
    if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
    lastValRef.current = null;
    setHoverVal(null);
  }, []);

  // Valor a mostrar: hover tiene prioridad; si no, el bloqueado
  const activeVal = hoverVal ?? lockedVal;
  const isLocked  = lockedVal !== null && hoverVal === null;

  return (
    <div
      ref={stripRef}
      data-gaze-target="true"
      onPointerMove={onPointerMove}
      onPointerLeave={onPointerLeave}
      style={{
        flex: 1,
        borderRadius: "16px",
        background: STRIP_GRADIENT,
        border: isLocked ? "3px solid #fbbf24" : "2px solid rgba(0,0,0,0.12)",
        boxShadow: isLocked ? "0 0 22px rgba(251,191,36,0.5)" : "none",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: "8px 14px",
        cursor: "crosshair",
        touchAction: "none",
        userSelect: "none",
        overflow: "hidden",
        transition: "border-color 0.2s, box-shadow 0.2s",
        minHeight: 0,
        boxSizing: "border-box",
        position: "relative",
      }}
    >
      {/* Etiqueta de la escala */}
      <div style={{
        textAlign: "center",
        fontFamily: "'Lexend', sans-serif",
        fontWeight: 900,
        fontSize: "clamp(0.65rem, 1.5vw, 0.9rem)",
        color: "#333333",
        letterSpacing: "0.18em",
        textTransform: "uppercase",
        textShadow: "0 1px 3px rgba(255,255,255,0.6)",
        flexShrink: 0,
      }}>
        {strip.label}
        {isLocked && (
          <span style={{
            marginLeft: 10,
            fontSize: "0.6rem",
            background: "rgba(251,191,36,0.35)",
            color: "#6B4500",
            padding: "1px 8px",
            borderRadius: "8px",
            fontWeight: 700,
          }}>
            ✓ {lockedVal}
          </span>
        )}
      </div>

      {/* Fila: cara feliz + números 1-10 + cara llorando */}
      <div style={{
        display: "flex",
        alignItems: "center",
        flex: 1,
        minHeight: 0,
        gap: "6px",
        padding: "4px 0",
      }}>
        {/* Cara izquierda (muy feliz) */}
        <span
          aria-label="Sin molestia"
          style={{
            fontSize: "clamp(1.4rem, 4vw, 2rem)",
            flexShrink: 0,
            lineHeight: 1,
            filter: "drop-shadow(0 1px 2px rgba(0,0,0,0.25))",
          }}
        >
          😊
        </span>

        {/* Números 1-10 */}
        <div style={{
          flex: 1,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          height: "100%",
        }}>
          {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => {
            const isActive  = activeVal === n;
            const isThisLocked = isLocked && lockedVal === n;
            const size = isThisLocked ? 48 : isActive ? 42 : 28;
            return (
              <div
                key={n}
                style={{
                  width: size,
                  height: size,
                  borderRadius: "50%",
                  flexShrink: 0,
                  background: isThisLocked
                    ? "#fbbf24"
                    : isActive
                    ? "rgba(0,0,0,0.32)"
                    : "rgba(0,0,0,0.14)",
                  color: isThisLocked ? "#7A4500" : "#333333",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontFamily: "'Lexend', sans-serif",
                  fontWeight: isActive || isThisLocked ? 900 : 700,
                  fontSize: isThisLocked
                    ? "clamp(1rem,3vw,1.3rem)"
                    : isActive
                    ? "clamp(0.9rem,2.5vw,1.15rem)"
                    : "clamp(0.65rem,1.8vw,0.85rem)",
                  border: isThisLocked ? "3px solid #7A4500" : "none",
                  boxShadow: isThisLocked ? "0 0 14px rgba(251,191,36,0.7)" : "none",
                  transition: "width 0.2s, height 0.2s, font-size 0.2s, background 0.15s",
                  textShadow: "0 1px 3px rgba(255,255,255,0.55)",
                }}
              >
                {n}
              </div>
            );
          })}
        </div>

        {/* Cara derecha (llorando/pánico) */}
        <span
          aria-label="Máximo malestar"
          style={{
            fontSize: "clamp(1.4rem, 4vw, 2rem)",
            flexShrink: 0,
            lineHeight: 1,
            filter: "drop-shadow(0 1px 2px rgba(0,0,0,0.25))",
          }}
        >
          😭
        </span>
      </div>

      {/* Instrucción si sin valor */}
      {activeVal === null && (
        <div style={{
          textAlign: "center",
          fontFamily: "'Lexend', sans-serif",
          fontSize: "0.6rem",
          fontWeight: 600,
          color: "rgba(51,51,51,0.55)",
          textShadow: "0 1px 2px rgba(255,255,255,0.5)",
          flexShrink: 0,
        }}>
          Mira un número · 2,5 s para fijar
        </div>
      )}
    </div>
  );
}

// ── Página ────────────────────────────────────────────────────────────────────
export default function Scales() {
  const [resetKey, setResetKey] = useState(0);

  return (
    <FullscreenLayout>
      <div style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        padding: "10px",
        gap: "10px",
        boxSizing: "border-box",
        background: "#111",
      }}>
        {/* Botón reiniciar */}
        <div style={{ display: "flex", justifyContent: "flex-end", flexShrink: 0 }}>
          <button
            data-gaze-target="true"
            data-testid="button-scale-reset"
            onClick={() => setResetKey((k) => k + 1)}
            style={{
              background: "rgba(255,255,255,0.1)",
              border: "1px solid rgba(255,255,255,0.2)",
              borderRadius: "10px",
              color: "rgba(255,255,255,0.7)",
              padding: "6px 14px",
              cursor: "pointer",
              fontFamily: "'Lexend', sans-serif",
              fontWeight: 700,
              fontSize: "0.7rem",
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              display: "flex",
              alignItems: "center",
              gap: "6px",
            }}
          >
            <RotateCcw style={{ width: 12, height: 12 }} />
            Reiniciar escalas
          </button>
        </div>

        {/* 3 franjas */}
        {STRIPS.map((strip) => (
          <GazeStrip key={`${strip.id}-${resetKey}`} strip={strip} />
        ))}
      </div>
    </FullscreenLayout>
  );
}
