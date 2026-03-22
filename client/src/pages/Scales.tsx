import { useState, useRef, useCallback, ElementType } from "react";
import { FullscreenLayout } from "@/components/FullscreenLayout";
import { playBell } from "@/lib/audio";
import { useTTS } from "@/hooks/use-tts";
import { Smile, Angry, Wind, AlertCircle, Sun, Zap, RotateCcw } from "lucide-react";

const DWELL_MS = 2500;

// Único gradiente pastel para las 3 franjas (verde menta → rojo suave)
const STRIP_GRADIENT = "linear-gradient(to right, #DDF5E0 0%, #F2D7D5 100%)";

interface StripDef {
  id: string;
  label: string;
  Icon0: ElementType;
  Icon10: ElementType;
  label0: string;
  label10: string;
  phrase: (v: number) => string;
}

const STRIPS: StripDef[] = [
  {
    id: "dolor",
    label: "DOLOR",
    Icon0: Smile, Icon10: Angry,
    label0: "Sin dolor", label10: "Dolor máximo",
    phrase: (v) => `Mi nivel de dolor es ${v} sobre diez.`,
  },
  {
    id: "respiracion",
    label: "RESPIRACIÓN",
    Icon0: Wind, Icon10: AlertCircle,
    label0: "Respiro bien", label10: "Me ahogo",
    phrase: (v) => `Mi nivel de falta de aire es ${v} sobre diez.`,
  },
  {
    id: "ansiedad",
    label: "ANSIEDAD",
    Icon0: Sun, Icon10: Zap,
    label0: "Tranquilo", label10: "Muy ansioso",
    phrase: (v) => `Mi nivel de ansiedad es ${v} sobre diez.`,
  },
];

// ── Franja de escala ──────────────────────────────────────────────────────────
// resetKey se gestiona vía prop `key` en el padre — React remonta al cambiar.
function GazeStrip({ strip }: { strip: StripDef }) {
  const { speak } = useTTS();
  const stripRef  = useRef<HTMLDivElement>(null);
  const timerRef  = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lineRef   = useRef<HTMLDivElement>(null);

  const [relX, setRelX]       = useState<number | null>(null);
  const [lockedX, setLockedX] = useState<number | null>(null);

  const computeX = useCallback((clientX: number) => {
    const rect = stripRef.current?.getBoundingClientRect();
    if (!rect) return null;
    return Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
  }, []);

  const onPointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    const x = computeX(e.clientX);
    if (x === null) return;
    setRelX(x);
    // Mueve la línea cursor directamente (sin re-render)
    if (lineRef.current) lineRef.current.style.left = `${x * 100}%`;

    // Reinicia el dwell
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      setLockedX(x);
      playBell();
      speak(strip.phrase(Math.round(x * 10)));
    }, DWELL_MS);
  }, [computeX, strip]);

  const onPointerLeave = useCallback(() => {
    if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
    setRelX(null);
    if (lineRef.current) lineRef.current.style.left = "-9999px";
  }, []);

  const displayX   = relX ?? lockedX;
  const displayVal = displayX !== null ? Math.round(displayX * 10) : null;
  const isLocked   = lockedX !== null && relX === null;

  return (
    <div
      ref={stripRef}
      data-gaze-target="true"
      onPointerMove={onPointerMove}
      onPointerLeave={onPointerLeave}
      style={{
        flex: 1,
        borderRadius: "18px",
        background: STRIP_GRADIENT,
        border: isLocked ? "3px solid #fbbf24" : "2px solid rgba(0,0,0,0.08)",
        boxShadow: isLocked ? "0 0 24px rgba(251,191,36,0.45), inset 0 0 0 1px rgba(251,191,36,0.2)" : "none",
        display: "flex",
        alignItems: "center",
        padding: "0 12px",
        position: "relative",
        cursor: "crosshair",
        overflow: "hidden",
        touchAction: "none",
        userSelect: "none",
        transition: "border-color 0.25s, box-shadow 0.25s",
        minHeight: 0,
      }}
    >
      {/* Línea cursor (movida directamente por JS) */}
      <div
        ref={lineRef}
        style={{
          position: "absolute",
          left: "-9999px",
          top: 0, bottom: 0,
          width: "2px",
          background: "rgba(51,51,51,0.35)",
          transform: "translateX(-50%)",
          pointerEvents: "none",
          zIndex: 2,
          transition: "none",
        }}
      />

      {/* Marcador bloqueado (posición fija) */}
      {isLocked && lockedX !== null && (
        <div style={{
          position: "absolute",
          left: `${lockedX * 100}%`,
          top: 0, bottom: 0,
          width: "3px",
          background: "#fbbf24",
          transform: "translateX(-50%)",
          pointerEvents: "none",
          zIndex: 3,
        }} />
      )}

      {/* Extremo izquierdo */}
      <div style={{ minWidth: 52, display: "flex", flexDirection: "column", alignItems: "center", gap: 3, flexShrink: 0, position: "relative", zIndex: 4 }}>
        <strip.Icon0 style={{ width: 28, height: 28, color: "#333333", strokeWidth: 1.8 }} />
        <span style={{ fontFamily: "'Lexend',sans-serif", fontSize: "0.52rem", fontWeight: 700, color: "#555", textTransform: "uppercase", textAlign: "center", lineHeight: 1.2 }}>
          {strip.label0}
        </span>
      </div>

      {/* Centro: etiqueta + valor */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", pointerEvents: "none", position: "relative", zIndex: 4 }}>
        <span style={{ fontFamily: "'Lexend',sans-serif", fontSize: "0.65rem", fontWeight: 800, color: "rgba(51,51,51,0.55)", textTransform: "uppercase", letterSpacing: "0.14em", marginBottom: 4 }}>
          {strip.label}
        </span>
        {displayVal !== null ? (
          <span style={{ fontFamily: "'Lexend',sans-serif", fontSize: "clamp(2rem,7vw,3.8rem)", fontWeight: 900, color: "#333333", lineHeight: 1 }}>
            {displayVal}
          </span>
        ) : (
          <span style={{ fontFamily: "'Lexend',sans-serif", fontSize: "0.78rem", color: "rgba(51,51,51,0.4)", fontWeight: 600 }}>
            ← mira aquí →
          </span>
        )}
        {isLocked && (
          <span style={{ fontFamily: "'Lexend',sans-serif", fontSize: "0.58rem", fontWeight: 700, color: "#7A5000", background: "rgba(251,191,36,0.25)", padding: "2px 10px", borderRadius: "10px", marginTop: 4, textTransform: "uppercase", letterSpacing: "0.1em" }}>
            ✓ fijado
          </span>
        )}
      </div>

      {/* Extremo derecho */}
      <div style={{ minWidth: 52, display: "flex", flexDirection: "column", alignItems: "center", gap: 3, flexShrink: 0, position: "relative", zIndex: 4 }}>
        <strip.Icon10 style={{ width: 28, height: 28, color: "#333333", strokeWidth: 1.8 }} />
        <span style={{ fontFamily: "'Lexend',sans-serif", fontSize: "0.52rem", fontWeight: 700, color: "#555", textTransform: "uppercase", textAlign: "center", lineHeight: 1.2 }}>
          {strip.label10}
        </span>
      </div>
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

        {/* Cabecera con botón reiniciar */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", flexShrink: 0 }}>
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
              fontFamily: "'Lexend',sans-serif",
              fontWeight: 700,
              fontSize: "0.72rem",
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              display: "flex",
              alignItems: "center",
              gap: "6px",
              transition: "background 0.2s",
            }}
          >
            <RotateCcw style={{ width: 13, height: 13 }} />
            Reiniciar escalas
          </button>
        </div>

        {/* 3 franjas de escala */}
        {STRIPS.map((strip) => (
          <GazeStrip key={`${strip.id}-${resetKey}`} strip={strip} />
        ))}
      </div>
    </FullscreenLayout>
  );
}
