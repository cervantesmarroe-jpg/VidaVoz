import { useState, useRef, useCallback, useEffect, ReactNode } from "react";
import { FullscreenLayout } from "@/components/FullscreenLayout";
import { playBell } from "@/lib/audio";
import { useTTS } from "@/hooks/use-tts";
import { RotateCcw } from "lucide-react";

const DWELL_MS        = 2500;
const ACCORDION_DWELL = 1400; // ms para abrir/cerrar un panel del acordeón

// ─────────────────────────────────────────────────────────────────────────────
// DATOS
// ─────────────────────────────────────────────────────────────────────────────

const BORG_BLOCKS = [
  { value: 0,  label: "Nada",      face: "😌", bg: "#DDF5E0" },
  { value: 1,  label: "Muy leve",  face: "😊", bg: "#DFF2DF" },
  { value: 2,  label: "Leve",      face: "🙂", bg: "#E1EFDE" },
  { value: 3,  label: "Moderado",  face: "😐", bg: "#E3ECDD" },
  { value: 4,  label: "Algo duro", face: "😐", bg: "#E5E9DC" },
  { value: 5,  label: "Duro",      face: "😟", bg: "#E8E6DB" },
  { value: 6,  label: "Duro",      face: "😟", bg: "#EAE3D9" },
  { value: 7,  label: "Muy duro",  face: "😰", bg: "#ECE0D8" },
  { value: 8,  label: "Muy duro",  face: "😰", bg: "#EEDDD7" },
  { value: 9,  label: "Extremo",   face: "😱", bg: "#F0DAD6" },
  { value: 10, label: "Máximo",    face: "😱", bg: "#F2D7D5" },
] as const;

const ANXIETY_LEVELS = [
  { label: "Tranquilo",   face: "😌", bg: "#DDF5E0", tts: "Estoy tranquilo." },
  { label: "Inquieto",    face: "🙂", bg: "#E2EEDD", tts: "Me siento inquieto." },
  { label: "Ansioso",     face: "😟", bg: "#E8E6DB", tts: "Estoy ansioso." },
  { label: "Muy ansioso", face: "😰", bg: "#EDDFD8", tts: "Estoy muy ansioso." },
  { label: "Pánico",      face: "😱", bg: "#F2D7D5", tts: "Siento pánico." },
] as const;

// ─────────────────────────────────────────────────────────────────────────────
// HOOK: dwell con progreso RAF
// ─────────────────────────────────────────────────────────────────────────────
function useDwellWithProgress<T>(
  activeValue: T | null,
  dwell: number,
  onLock: (v: T) => void,
): number {
  const [progress, setProgress] = useState(0);
  const rafRef    = useRef<number | null>(null);
  const startRef  = useRef(0);
  const prevRef   = useRef<T | null>(null);
  const firedRef  = useRef(false);
  const onLockRef = useRef(onLock);
  onLockRef.current = onLock;

  useEffect(() => {
    if (rafRef.current !== null) { cancelAnimationFrame(rafRef.current); rafRef.current = null; }

    if (activeValue === null) {
      setProgress(0); prevRef.current = null; firedRef.current = false; return;
    }
    if (activeValue !== prevRef.current) {
      prevRef.current = activeValue; startRef.current = Date.now();
      firedRef.current = false; setProgress(0);
    }

    const captured = activeValue;
    const tick = () => {
      const pct = Math.min(1, (Date.now() - startRef.current) / dwell);
      setProgress(pct);
      if (pct < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else if (!firedRef.current) {
        firedRef.current = true; rafRef.current = null;
        onLockRef.current(captured);
      }
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current !== null) { cancelAnimationFrame(rafRef.current); rafRef.current = null; } };
  }, [activeValue, dwell]);

  return progress;
}

// ─────────────────────────────────────────────────────────────────────────────
// ACORDEÓN: header dwell target + contenido colapsable
// Contenido siempre montado (display:none cuando cerrado) para preservar estado.
// ─────────────────────────────────────────────────────────────────────────────
function AccordionPanel({
  title, isOpen, lockedBadge, onToggle, children,
}: {
  title: string;
  isOpen: boolean;
  lockedBadge?: string | null;
  onToggle: () => void;
  children: ReactNode;
}) {
  const rafRef      = useRef<number | null>(null);
  const startRef    = useRef(0);
  const [dwellPct, setDwellPct] = useState(0);
  const onToggleRef = useRef(onToggle);
  onToggleRef.current = onToggle;

  const cancelDwell = useCallback(() => {
    if (rafRef.current !== null) { cancelAnimationFrame(rafRef.current); rafRef.current = null; }
    setDwellPct(0);
  }, []);

  const startDwell = useCallback(() => {
    if (rafRef.current !== null) return;
    startRef.current = Date.now();
    const tick = () => {
      const pct = Math.min(1, (Date.now() - startRef.current) / ACCORDION_DWELL);
      setDwellPct(pct);
      if (pct < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        rafRef.current = null;
        setDwellPct(0);
        onToggleRef.current();
      }
    };
    rafRef.current = requestAnimationFrame(tick);
  }, []);

  useEffect(() => () => cancelDwell(), [cancelDwell]);

  return (
    <div style={{
      flex: isOpen ? "5 1 0" : "0 0 58px",
      display: "flex",
      flexDirection: "column",
      borderRadius: 14,
      overflow: "hidden",
      border: isOpen ? "2px solid #D4CAB8" : "1.5px solid #E0D8CB",
      background: "#FFFFFF",
      minHeight: 58,
      boxShadow: isOpen
        ? "0 2px 12px rgba(0,0,0,0.09)"
        : "0 1px 4px rgba(0,0,0,0.05)",
      transition: "border-color .2s, box-shadow .2s",
    }}>

      {/* ── Header: siempre visible, es el dwell target ─────────────────── */}
      <div
        className="gaze-target"
        data-gaze-target="true"
        onPointerEnter={startDwell}
        onPointerLeave={cancelDwell}
        onClick={() => onToggleRef.current()}
        style={{
          height: 58,
          flexShrink: 0,
          padding: "0 16px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 10,
          background: isOpen ? "#FDF2E2" : "#FFFFFF",
          cursor: "pointer",
          position: "relative",
          overflow: "hidden",
          userSelect: "none",
          touchAction: "none",
          transition: "background .2s",
        }}
      >
        {/* Título */}
        <span style={{
          fontFamily: "'Lexend',sans-serif",
          fontWeight: 900,
          fontSize: "clamp(.78rem,2vw,1rem)",
          color: "#333333",
          letterSpacing: ".14em",
          textTransform: "uppercase",
          flexShrink: 0,
        }}>
          {title}
        </span>

        {/* Valor bloqueado (badge dorado) */}
        {lockedBadge && (
          <span style={{
            background: "rgba(251,191,36,.25)",
            color: "#6B4500",
            fontSize: ".72rem",
            fontWeight: 800,
            padding: "2px 10px",
            borderRadius: 20,
            fontFamily: "'Lexend',sans-serif",
            whiteSpace: "nowrap",
          }}>
            ✓ {lockedBadge}
          </span>
        )}

        {/* Indicador abierto/cerrado */}
        <span style={{
          fontSize: "1.1rem",
          color: "#AAAAAA",
          marginLeft: "auto",
          flexShrink: 0,
          lineHeight: 1,
          transform: isOpen ? "rotate(180deg)" : "rotate(0deg)",
          transition: "transform .22s",
        }}>▾</span>

        {/* Barra de progreso dwell */}
        {dwellPct > 0 && (
          <div style={{
            position: "absolute", bottom: 0, left: 0,
            height: 3,
            width: `${dwellPct * 100}%`,
            background: "#fbbf24",
            borderRadius: "0 2px 0 0",
          }} />
        )}
      </div>

      {/* ── Contenido: siempre montado, oculto con display:none cuando cerrado */}
      <div style={{
        flex: 1,
        minHeight: 0,
        padding: "8px",
        display: isOpen ? "flex" : "none",
        flexDirection: "column",
      }}>
        {children}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ESCALA 1 — EVA (Dolor): gradiente continuo 0-10
// ─────────────────────────────────────────────────────────────────────────────
function EvaStrip({ onLocked }: { onLocked: (v: number | null) => void }) {
  const { speak }   = useTTS();
  const stripRef    = useRef<HTMLDivElement>(null);
  const innerRef    = useRef<HTMLDivElement>(null);
  const [hover,  setHover]  = useState<number | null>(null);
  const [locked, setLocked] = useState<number | null>(null);

  const onLock = useCallback((val: number) => {
    setLocked(val); onLocked(val);
    playBell();
    speak(`Mi nivel de dolor es ${val} sobre diez.`);
  }, [speak, onLocked]);

  const progress = useDwellWithProgress(hover, DWELL_MS, onLock);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    const rect = innerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x   = Math.max(0, Math.min(rect.width, e.clientX - rect.left));
    const val = Math.min(10, Math.floor(x / rect.width * 11));
    setHover(val);
  }, []);
  const onPointerLeave = useCallback(() => setHover(null), []);

  const active   = hover ?? locked;
  const isLocked = locked !== null && hover === null;

  return (
    <div
      ref={stripRef}
      data-gaze-target="true"
      onPointerLeave={onPointerLeave}
      style={{
        flex: 1, minHeight: 0, borderRadius: 16, cursor: "crosshair",
        touchAction: "none", userSelect: "none",
        background: "linear-gradient(to right, #DDF5E0 0%, #F2D7D5 100%)",
        border: isLocked ? "3px solid #fbbf24" : "1.5px solid #E0E0E0",
        boxShadow: isLocked ? "0 0 22px rgba(251,191,36,0.5)" : "0 1px 4px rgba(0,0,0,0.06)",
        display: "flex", flexDirection: "column",
        justifyContent: "space-between", padding: "6px 10px",
        boxSizing: "border-box", transition: "border-color .2s, box-shadow .2s",
      }}
    >
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        flexShrink: 0,
      }}>
        <span style={{ fontSize: "clamp(1rem,3vw,1.5rem)", lineHeight: 1 }}>😊</span>
        <span style={{
          fontFamily: "'Lexend',sans-serif", fontWeight: 900,
          fontSize: "clamp(.6rem,1.6vw,.85rem)", color: "#333",
          letterSpacing: ".15em", textTransform: "uppercase",
          textShadow: "0 1px 3px rgba(255,255,255,.65)",
        }}>
          DOLOR (EVA)
          {isLocked && (
            <span style={{ marginLeft: 8, fontSize: ".6rem", background: "rgba(251,191,36,.35)", color: "#6B4500", padding: "1px 8px", borderRadius: 8, fontWeight: 700 }}>
              ✓ {locked}/10
            </span>
          )}
        </span>
        <span style={{ fontSize: "clamp(1rem,3vw,1.5rem)", lineHeight: 1 }}>😭</span>
      </div>

      <div
        ref={innerRef}
        onPointerMove={onPointerMove}
        style={{
          flex: 1, minHeight: 0,
          display: "flex", alignItems: "center",
          justifyContent: "space-between",
          padding: "3px 0",
          gap: 2,
        }}
      >
        {Array.from({ length: 11 }, (_, i) => i).map((n) => {
          const isSel    = hover === n;
          const isThisLk = isLocked && locked === n;
          const dimmed   = isLocked && locked !== n;
          const szStr    = isThisLk
            ? "clamp(22px, 6.5vw, 42px)"
            : isSel
            ? "clamp(20px, 5.8vw, 36px)"
            : "clamp(16px, 4.5vw, 28px)";
          const ringPx    = isSel && !isThisLk ? 2 + progress * 4 : 0;
          const ringAlpha = isSel && !isThisLk ? 0.35 + progress * 0.45 : 0;
          return (
            <div key={n} style={{
              width: szStr, height: szStr,
              minWidth: 0, flexShrink: 1,
              borderRadius: "50%",
              position: "relative",
              background: isThisLk ? "#fbbf24" : isSel ? "rgba(0,0,0,.30)" : "rgba(0,0,0,.18)",
              opacity: dimmed ? 0.35 : 1,
              color: "#333", display: "flex", alignItems: "center", justifyContent: "center",
              fontFamily: "'Lexend',sans-serif",
              fontWeight: isSel || isThisLk ? 900 : 700,
              fontSize: isThisLk
                ? "clamp(.65rem,2.2vw,1.1rem)"
                : isSel
                ? "clamp(.6rem,1.9vw,1rem)"
                : "clamp(.5rem,1.5vw,.8rem)",
              border: isThisLk ? "2.5px solid #7A4500" : "none",
              boxShadow: isThisLk
                ? "0 0 12px rgba(251,191,36,.7)"
                : isSel && ringPx > 0
                ? `0 0 0 ${ringPx}px rgba(251,191,36,${ringAlpha}), 0 0 ${ringPx * 3}px rgba(251,191,36,${ringAlpha * 0.6})`
                : "none",
              textShadow: "0 1px 2px rgba(255,255,255,.6)",
              transition: "opacity .2s, background .14s",
            }}>
              {n}
            </div>
          );
        })}
      </div>

      {active === null && (
        <div style={{ textAlign: "center", fontFamily: "'Lexend',sans-serif", fontSize: ".56rem", fontWeight: 600, color: "rgba(51,51,51,.5)", textShadow: "0 1px 2px rgba(255,255,255,.5)", flexShrink: 0 }}>
          Mira un número · 2,5 s para fijar
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ESCALA 2 — BORG (Respiración)
// ─────────────────────────────────────────────────────────────────────────────
function BorgStrip({ onLocked }: { onLocked: (v: number | null) => void }) {
  const { speak }  = useTTS();
  const stripRef   = useRef<HTMLDivElement>(null);
  const [hover,  setHover]  = useState<number | null>(null);
  const [locked, setLocked] = useState<number | null>(null);

  const onLock = useCallback((idx: number) => {
    setLocked(idx); onLocked(idx);
    playBell();
    speak(`Mi nivel de esfuerzo es ${idx}, ${BORG_BLOCKS[idx].label}.`);
  }, [speak, onLocked]);

  const progress = useDwellWithProgress(hover, DWELL_MS, onLock);

  const onPointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    const rect = stripRef.current?.getBoundingClientRect();
    if (!rect) return;
    const idx = Math.max(0, Math.min(10, Math.floor((e.clientX - rect.left) / rect.width * 11)));
    setHover(idx);
  }, []);
  const onPointerLeave = useCallback(() => setHover(null), []);

  const isLocked = locked !== null && hover === null;

  return (
    <div
      ref={stripRef}
      data-gaze-target="true"
      onPointerMove={onPointerMove}
      onPointerLeave={onPointerLeave}
      style={{
        flex: 1, minHeight: 0, borderRadius: 16, cursor: "crosshair",
        touchAction: "none", userSelect: "none",
        border: isLocked ? "3px solid #fbbf24" : "1.5px solid #E0E0E0",
        boxShadow: isLocked ? "0 0 22px rgba(251,191,36,0.4)" : "0 1px 4px rgba(0,0,0,0.06)",
        display: "flex", flexDirection: "column",
        padding: "7px 8px", gap: 4, boxSizing: "border-box",
        background: "#FFFFFF",
        transition: "border-color .2s, box-shadow .2s",
      }}
    >
      <div style={{ textAlign: "center", fontFamily: "'Lexend',sans-serif", fontWeight: 900, fontSize: "clamp(.6rem,1.4vw,.82rem)", color: "#333333", letterSpacing: ".18em", textTransform: "uppercase", flexShrink: 0 }}>
        RESPIRACIÓN (BORG)
        {isLocked && (
          <span style={{ marginLeft: 10, fontSize: ".6rem", background: "rgba(251,191,36,.35)", color: "#6B4C00", padding: "1px 8px", borderRadius: 8, fontWeight: 700 }}>
            ✓ {locked} – {BORG_BLOCKS[locked!].label}
          </span>
        )}
      </div>

      <div style={{ flex: 1, minHeight: 0, display: "flex", gap: 2, borderRadius: 10, overflow: "hidden" }}>
        {BORG_BLOCKS.map((block, i) => {
          const isHov    = hover === i;
          const isThisLk = isLocked && locked === i;
          const dimmed   = isLocked && locked !== i;
          const fillDeg  = isHov && !isThisLk ? progress * 360 : 0;

          return (
            <div key={i} style={{
              flex: 1, minWidth: 0,
              position: "relative",
              background: block.bg,
              opacity: dimmed ? 0.38 : 1,
              border: isThisLk ? "3px solid #fbbf24" : isHov ? "2px solid rgba(0,0,0,.25)" : "1px solid transparent",
              borderRadius: 8,
              boxShadow: isThisLk ? "0 0 14px rgba(251,191,36,.7), inset 0 0 6px rgba(251,191,36,.3)" : "none",
              display: "flex", flexDirection: "column",
              alignItems: "center", justifyContent: "space-evenly",
              padding: "4px 1px",
              transition: "opacity .2s, border .12s, box-shadow .2s",
              boxSizing: "border-box",
              overflow: "hidden",
            }}>
              {isHov && !isThisLk && fillDeg > 0 && (
                <div style={{
                  position: "absolute", inset: 0,
                  background: `conic-gradient(from -90deg, rgba(251,191,36,0.52) ${fillDeg}deg, transparent ${fillDeg}deg)`,
                  pointerEvents: "none", zIndex: 2,
                  borderRadius: "inherit",
                }} />
              )}
              <span style={{
                fontFamily: "'Lexend',sans-serif", fontWeight: 900,
                fontSize: isHov || isThisLk ? "clamp(1rem,3vw,1.4rem)" : "clamp(.85rem,2.4vw,1.1rem)",
                color: "#333333", lineHeight: 1,
                transition: "font-size .18s",
                textShadow: "0 1px 3px rgba(255,255,255,.5)",
                position: "relative", zIndex: 3,
              }}>{block.value}</span>
              <span style={{
                fontSize: isHov || isThisLk ? "clamp(1.1rem,3.2vw,1.5rem)" : "clamp(.9rem,2.5vw,1.2rem)",
                lineHeight: 1, transition: "font-size .18s",
                position: "relative", zIndex: 3,
              }}>{block.face}</span>
              <span style={{
                fontFamily: "'Lexend',sans-serif", fontWeight: 700,
                fontSize: "clamp(.44rem,1.1vw,.62rem)",
                color: "#2A2A2A",
                textAlign: "center", lineHeight: 1.15,
                maxWidth: "100%",
                overflow: "hidden",
                display: "-webkit-box",
                WebkitLineClamp: 2,
                WebkitBoxOrient: "vertical",
                textShadow: "0 1px 2px rgba(255,255,255,.6)",
                position: "relative", zIndex: 3,
                padding: "0 1px",
              }}>{block.label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ESCALA 3 — ANSIEDAD
// ─────────────────────────────────────────────────────────────────────────────
function AnxietyStrip({ onLocked }: { onLocked: (v: number | null) => void }) {
  const { speak }  = useTTS();
  const stripRef   = useRef<HTMLDivElement>(null);
  const [hover,  setHover]  = useState<number | null>(null);
  const [locked, setLocked] = useState<number | null>(null);

  const onLock = useCallback((idx: number) => {
    setLocked(idx); onLocked(idx);
    playBell();
    speak(ANXIETY_LEVELS[idx].tts);
  }, [speak, onLocked]);

  const progress = useDwellWithProgress(hover, DWELL_MS, onLock);

  const onPointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    const rect = stripRef.current?.getBoundingClientRect();
    if (!rect) return;
    const idx = Math.max(0, Math.min(4, Math.floor((e.clientX - rect.left) / rect.width * 5)));
    setHover(idx);
  }, []);
  const onPointerLeave = useCallback(() => setHover(null), []);

  const isLocked = locked !== null && hover === null;

  return (
    <div
      ref={stripRef}
      data-gaze-target="true"
      onPointerMove={onPointerMove}
      onPointerLeave={onPointerLeave}
      style={{
        flex: 1, minHeight: 0, borderRadius: 16, cursor: "crosshair",
        touchAction: "none", userSelect: "none",
        border: isLocked ? "3px solid #fbbf24" : "1.5px solid #E0E0E0",
        boxShadow: isLocked ? "0 0 22px rgba(251,191,36,0.4)" : "0 1px 4px rgba(0,0,0,0.06)",
        display: "flex", flexDirection: "column",
        padding: "7px 8px", gap: 4, boxSizing: "border-box",
        background: "#FFFFFF",
        transition: "border-color .2s, box-shadow .2s",
      }}
    >
      <div style={{ textAlign: "center", fontFamily: "'Lexend',sans-serif", fontWeight: 900, fontSize: "clamp(.6rem,1.4vw,.82rem)", color: "#333333", letterSpacing: ".18em", textTransform: "uppercase", flexShrink: 0 }}>
        ANSIEDAD
        {isLocked && (
          <span style={{ marginLeft: 10, fontSize: ".6rem", background: "rgba(251,191,36,.35)", color: "#6B4C00", padding: "1px 8px", borderRadius: 8, fontWeight: 700 }}>
            ✓ {ANXIETY_LEVELS[locked!].label}
          </span>
        )}
      </div>

      <div style={{ flex: 1, minHeight: 0, display: "flex", gap: 2, borderRadius: 10, overflow: "hidden" }}>
        {ANXIETY_LEVELS.map((level, i) => {
          const isHov    = hover === i;
          const isThisLk = isLocked && locked === i;
          const dimmed   = isLocked && locked !== i;
          const fillDeg  = isHov && !isThisLk ? progress * 360 : 0;

          return (
            <div key={i} style={{
              flex: 1, minWidth: 0,
              position: "relative",
              background: level.bg,
              opacity: dimmed ? 0.38 : 1,
              border: isThisLk ? "3px solid #fbbf24" : isHov ? "2px solid rgba(0,0,0,.22)" : "1px solid transparent",
              borderRadius: 8,
              boxShadow: isThisLk ? "0 0 14px rgba(251,191,36,.7), inset 0 0 6px rgba(251,191,36,.3)" : "none",
              display: "flex", flexDirection: "column",
              alignItems: "center", justifyContent: "space-evenly",
              padding: "4px 6px",
              transition: "opacity .2s, border .12s, box-shadow .2s",
              boxSizing: "border-box",
              overflow: "hidden",
            }}>
              {isHov && !isThisLk && fillDeg > 0 && (
                <div style={{
                  position: "absolute", inset: 0,
                  background: `conic-gradient(from -90deg, rgba(251,191,36,0.52) ${fillDeg}deg, transparent ${fillDeg}deg)`,
                  pointerEvents: "none", zIndex: 2,
                  borderRadius: "inherit",
                }} />
              )}
              <span style={{
                fontSize: isHov || isThisLk ? "clamp(1.4rem,4.5vw,2rem)" : "clamp(1.1rem,3.5vw,1.6rem)",
                lineHeight: 1, transition: "font-size .18s",
                position: "relative", zIndex: 3,
              }}>{level.face}</span>
              <span style={{
                fontFamily: "'Lexend',sans-serif", fontWeight: 900,
                fontSize: isHov || isThisLk ? "clamp(.72rem,2vw,.98rem)" : "clamp(.62rem,1.7vw,.84rem)",
                color: "#2A2A2A",
                textAlign: "center", lineHeight: 1.2,
                textShadow: "0 1px 3px rgba(255,255,255,.5)",
                transition: "font-size .18s",
                position: "relative", zIndex: 3,
              }}>{level.label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PANEL DE PUNTUACIONES (siempre visible al fondo)
// ─────────────────────────────────────────────────────────────────────────────
interface ScoreSummaryProps {
  evaLocked:     number | null;
  borgLocked:    number | null;
  anxietyLocked: number | null;
}

function ScoreSummary({ evaLocked, borgLocked, anxietyLocked }: ScoreSummaryProps) {
  const items = [
    {
      key: "eva",
      label: "Dolor (EVA)",
      value: evaLocked !== null ? `${evaLocked} / 10` : null,
    },
    {
      key: "borg",
      label: "Esfuerzo (BORG)",
      value: borgLocked !== null ? `${borgLocked} — ${BORG_BLOCKS[borgLocked].label}` : null,
    },
    {
      key: "ansiedad",
      label: "Ansiedad",
      value: anxietyLocked !== null ? ANXIETY_LEVELS[anxietyLocked].label : null,
    },
  ];

  return (
    <div
      data-testid="score-summary"
      style={{
        flexShrink: 0,
        borderRadius: 14,
        background: "#FFFFFF",
        border: "1.5px solid #E0E0E0",
        boxShadow: "0 1px 6px rgba(0,0,0,0.06)",
        display: "flex",
        alignItems: "stretch",
        overflow: "hidden",
      }}
    >
      {items.map((item, idx) => (
        <div
          key={item.key}
          data-testid={`score-chip-${item.key}`}
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: "8px 6px",
            borderRight: idx < items.length - 1 ? "1px solid #E0E0E0" : "none",
            gap: 3,
          }}
        >
          <span style={{
            fontFamily: "'Lexend',sans-serif",
            fontSize: "clamp(.46rem,1.2vw,.62rem)",
            fontWeight: 700,
            letterSpacing: ".1em",
            textTransform: "uppercase",
            color: "#AAAAAA",
          }}>
            {item.label}
          </span>
          <span style={{
            fontFamily: "'Lexend',sans-serif",
            fontSize: "clamp(.68rem,1.8vw,.92rem)",
            fontWeight: 900,
            color: item.value !== null ? "#333333" : "#CCCCCC",
            textAlign: "center",
          }}>
            {item.value ?? "—"}
          </span>
        </div>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PÁGINA
// ─────────────────────────────────────────────────────────────────────────────
type ScaleKey = "eva" | "borg" | "anxiety";

export default function Scales() {
  const [resetKey,      setResetKey]      = useState(0);
  const [openScale,     setOpenScale]     = useState<ScaleKey | null>(null);
  const [evaLocked,     setEvaLocked]     = useState<number | null>(null);
  const [borgLocked,    setBorgLocked]    = useState<number | null>(null);
  const [anxietyLocked, setAnxietyLocked] = useState<number | null>(null);

  const handleReset = useCallback(() => {
    setResetKey((k) => k + 1);
    setEvaLocked(null);
    setBorgLocked(null);
    setAnxietyLocked(null);
    setOpenScale(null);
  }, []);

  const toggle = useCallback((key: ScaleKey) =>
    setOpenScale((prev) => (prev === key ? null : key)), []);

  const toggleEva     = useCallback(() => toggle("eva"),     [toggle]);
  const toggleBorg    = useCallback(() => toggle("borg"),    [toggle]);
  const toggleAnxiety = useCallback(() => toggle("anxiety"), [toggle]);

  const evaBadge     = evaLocked     !== null ? `${evaLocked}/10`                          : null;
  const borgBadge    = borgLocked    !== null ? `${borgLocked} ${BORG_BLOCKS[borgLocked].label}` : null;
  const anxietyBadge = anxietyLocked !== null ? ANXIETY_LEVELS[anxietyLocked].label          : null;

  return (
    <FullscreenLayout>
      <div style={{
        display: "flex", flexDirection: "column", height: "100%",
        padding: "10px", gap: "8px", boxSizing: "border-box", background: "#FDF2E2",
      }}>

        {/* Barra superior: reiniciar */}
        <div style={{ display: "flex", justifyContent: "flex-end", flexShrink: 0 }}>
          <button
            className="gaze-target"
            data-gaze-target="true"
            data-testid="button-scale-reset"
            onClick={handleReset}
            style={{
              background: "#FDF2E2", border: "1.5px solid #E0D8CB",
              borderRadius: 10, color: "#555555", padding: "5px 13px",
              cursor: "pointer", fontFamily: "'Lexend',sans-serif", fontWeight: 700,
              fontSize: ".7rem", letterSpacing: ".08em", textTransform: "uppercase",
              display: "flex", alignItems: "center", gap: 6,
              boxShadow: "0 1px 4px rgba(0,0,0,0.07)",
              position: "relative", overflow: "hidden",
            }}
          >
            <RotateCcw style={{ width: 12, height: 12 }} />
            Reiniciar escalas
          </button>
        </div>

        {/* Acordeón — EVA */}
        <AccordionPanel
          title="Dolor (EVA)"
          isOpen={openScale === "eva"}
          lockedBadge={evaBadge}
          onToggle={toggleEva}
        >
          <EvaStrip key={`eva-${resetKey}`} onLocked={setEvaLocked} />
        </AccordionPanel>

        {/* Acordeón — BORG */}
        <AccordionPanel
          title="Respiración (BORG)"
          isOpen={openScale === "borg"}
          lockedBadge={borgBadge}
          onToggle={toggleBorg}
        >
          <BorgStrip key={`borg-${resetKey}`} onLocked={setBorgLocked} />
        </AccordionPanel>

        {/* Acordeón — ANSIEDAD */}
        <AccordionPanel
          title="Ansiedad"
          isOpen={openScale === "anxiety"}
          lockedBadge={anxietyBadge}
          onToggle={toggleAnxiety}
        >
          <AnxietyStrip key={`ansiedad-${resetKey}`} onLocked={setAnxietyLocked} />
        </AccordionPanel>

        {/* Recuento de puntuaciones — siempre visible al fondo */}
        <ScoreSummary
          evaLocked={evaLocked}
          borgLocked={borgLocked}
          anxietyLocked={anxietyLocked}
        />
      </div>
    </FullscreenLayout>
  );
}
