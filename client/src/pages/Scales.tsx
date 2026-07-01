import { useState, useRef, useCallback, useEffect, ReactNode } from "react";
import { FullscreenLayout } from "@/components/FullscreenLayout";
import { playBell } from "@/lib/audio";
import { useTTS } from "@/hooks/use-tts";
import { RotateCcw } from "lucide-react";
import { DWELL_MS } from "@/lib/dwell";

// ─────────────────────────────────────────────────────────────────────────────
// DATOS — 5 niveles por escala, progresión verde → rojo
// ─────────────────────────────────────────────────────────────────────────────

type ScaleLevel = {
  label:  string;
  icon:   string;
  bg:     string;
  accent: string;
  tts:    string;
};

const BG     = ["#D5F5E3", "#E8F5E9", "#FFF9C4", "#FFEDD5", "#FEE2E2"];
const ACCENT = ["#145A30", "#276934", "#856404", "#9A3412", "#991B1B"];

const PAIN_LEVELS: ScaleLevel[] = [
  { label: "Sin dolor",          icon: "😊", bg: BG[0], accent: ACCENT[0], tts: "Sin dolor. No siento ningún dolor en este momento." },
  { label: "Poco dolor",         icon: "🙂", bg: BG[1], accent: ACCENT[1], tts: "Poco dolor. Siento un dolor leve." },
  { label: "Dolor moderado",     icon: "😐", bg: BG[2], accent: ACCENT[2], tts: "Dolor moderado. Me duele bastante." },
  { label: "Dolor fuerte",       icon: "😣", bg: BG[3], accent: ACCENT[3], tts: "Dolor fuerte. Tengo mucho dolor, necesito atención." },
  { label: "Dolor insoportable", icon: "😭", bg: BG[4], accent: ACCENT[4], tts: "Dolor insoportable. El dolor es insoportable, necesito ayuda urgente." },
];

const BREATHING_LEVELS: ScaleLevel[] = [
  { label: "Respiro bien",      icon: "💨", bg: BG[0], accent: ACCENT[0], tts: "Respiro bien. No tengo dificultad para respirar." },
  { label: "Algo de fatiga",    icon: "😮", bg: BG[1], accent: ACCENT[1], tts: "Algo de fatiga al respirar. Noto algo de esfuerzo." },
  { label: "Fatiga moderada",   icon: "😤", bg: BG[2], accent: ACCENT[2], tts: "Fatiga moderada. Me cuesta respirar moderadamente." },
  { label: "Mucha fatiga",      icon: "😰", bg: BG[3], accent: ACCENT[3], tts: "Mucha fatiga. Me cuesta mucho respirar, necesito atención." },
  { label: "No puedo respirar", icon: "😱", bg: BG[4], accent: ACCENT[4], tts: "No puedo respirar. Necesito ayuda urgente." },
];

const ANXIETY_LEVELS: ScaleLevel[] = [
  { label: "Muy tranquilo", icon: "😌", bg: BG[0], accent: ACCENT[0], tts: "Estoy muy tranquilo. Me siento bien." },
  { label: "Algo inquieto", icon: "🙂", bg: BG[1], accent: ACCENT[1], tts: "Estoy algo inquieto. Noto cierta inquietud." },
  { label: "Nervioso",      icon: "😟", bg: BG[2], accent: ACCENT[2], tts: "Estoy nervioso. Siento bastante nerviosismo." },
  { label: "Muy ansioso",   icon: "😰", bg: BG[3], accent: ACCENT[3], tts: "Estoy muy ansioso. La ansiedad es muy intensa." },
  { label: "Pánico",        icon: "😱", bg: BG[4], accent: ACCENT[4], tts: "Siento pánico. Necesito ayuda, estoy en pánico." },
];

// ─────────────────────────────────────────────────────────────────────────────
// HOOK: progreso visual de dwell con RAF (no dispara — activación vía onClick)
// ─────────────────────────────────────────────────────────────────────────────

function useDwellProgress(activeIdx: number | null, dwell: number): number {
  const [progress, setProgress] = useState(0);
  const rafRef    = useRef<number | null>(null);
  const startRef  = useRef(0);
  const prevRef   = useRef<number | null>(null);

  useEffect(() => {
    if (rafRef.current !== null) { cancelAnimationFrame(rafRef.current); rafRef.current = null; }
    if (activeIdx === null) { setProgress(0); prevRef.current = null; return; }
    if (activeIdx !== prevRef.current) {
      prevRef.current = activeIdx; startRef.current = Date.now(); setProgress(0);
    }
    const tick = () => {
      const pct = Math.min(1, (Date.now() - startRef.current) / dwell);
      setProgress(pct);
      if (pct < 1) rafRef.current = requestAnimationFrame(tick);
      else rafRef.current = null;
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current !== null) { cancelAnimationFrame(rafRef.current); rafRef.current = null; } };
  }, [activeIdx, dwell]);

  return progress;
}

// ─────────────────────────────────────────────────────────────────────────────
// BOTÓN DE NIVEL — icono grande a la izquierda, etiqueta a la derecha
// ─────────────────────────────────────────────────────────────────────────────

interface ScaleBtnProps {
  level:     ScaleLevel;
  testId:    string;
  isHovered: boolean;
  isLocked:  boolean;
  isDimmed:  boolean;
  progress:  number;
  onEnter:   () => void;
  onSelect:  () => void;
}

function ScaleBtn({ level, testId, isHovered, isLocked, isDimmed, progress, onEnter, onSelect }: ScaleBtnProps) {
  return (
    <div
      className="gaze-target"
      data-gaze-target="true"
      data-testid={testId}
      onPointerEnter={onEnter}
      onClick={onSelect}
      style={{
        flex: 1,
        minHeight: 0,
        display: "flex",
        flexDirection: "row",
        alignItems: "center",
        gap: 14,
        padding: "0 16px",
        boxSizing: "border-box",
        background: isLocked ? "#F0FDF4" : level.bg,
        border: isLocked
          ? "2px solid #22C55E"
          : isHovered
          ? "2px solid #F59E0B"
          : "1.5px solid rgba(0,0,0,0.07)",
        borderLeft: `6px solid ${isLocked ? "#22C55E" : level.accent}`,
        borderRadius: 12,
        opacity: isDimmed ? 0.32 : 1,
        position: "relative",
        overflow: "hidden",
        cursor: "pointer",
        userSelect: "none",
        touchAction: "manipulation",
        WebkitTapHighlightColor: "transparent",
        boxShadow: isLocked
          ? "0 0 14px rgba(34,197,94,0.3)"
          : isHovered
          ? "0 1px 8px rgba(245,158,11,0.25)"
          : "0 1px 2px rgba(0,0,0,0.05)",
        transition: "border-color .12s, box-shadow .14s, opacity .18s, background .14s",
      }}
    >
      {/* Barra de progreso dwell */}
      {isHovered && !isLocked && (
        <div style={{
          position: "absolute",
          bottom: 0, left: 0,
          height: 3,
          width: `${progress * 100}%`,
          background: "#F59E0B",
          borderRadius: "0 2px 0 0",
          pointerEvents: "none",
        }} />
      )}

      {/* Emoji grande */}
      <span style={{
        fontSize: "clamp(1.9rem, 3.8vw, 2.8rem)",
        lineHeight: 1,
        flexShrink: 0,
        pointerEvents: "none",
        filter: isHovered && !isLocked ? "drop-shadow(0 0 5px rgba(245,158,11,.55))" : "none",
        transition: "filter .14s",
      }}>
        {level.icon}
      </span>

      {/* Etiqueta descriptiva */}
      <span style={{
        fontFamily: "'Lexend',sans-serif",
        fontWeight: 800,
        fontSize: "clamp(0.95rem, 2.3vw, 1.3rem)",
        color: isLocked ? "#16A34A" : level.accent,
        flex: 1,
        lineHeight: 1.2,
        pointerEvents: "none",
      }}>
        {level.label}
      </span>

      {/* Checkmark al seleccionar */}
      {isLocked && (
        <span style={{
          color: "#16A34A",
          fontSize: "1.35rem",
          fontWeight: 900,
          flexShrink: 0,
          pointerEvents: "none",
        }}>✓</span>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// LISTA DE NIVELES — columna vertical de 5 botones que reparten el espacio
// ─────────────────────────────────────────────────────────────────────────────

interface ScaleGridProps {
  levels:   ScaleLevel[];
  prefix:   string;
  onLocked: (label: string | null) => void;
}

function ScaleGrid({ levels, prefix, onLocked }: ScaleGridProps) {
  const { speak }  = useTTS();
  const [hover,  setHover]  = useState<number | null>(null);
  const [locked, setLocked] = useState<number | null>(null);

  const fire = useCallback((idx: number) => {
    setLocked(idx);
    onLocked(levels[idx].label);
    playBell();
    speak(levels[idx].tts);
  }, [levels, onLocked, speak]);

  // El progreso sólo es visual. La activación (TTS + lock) ocurre en onClick,
  // que el tracker de mirada dispara con .click() al completar su dwell propio.
  const progress  = useDwellProgress(hover, DWELL_MS);
  const isLocked  = locked !== null;

  const handleSelect = useCallback((idx: number) => {
    if (isLocked && locked === idx) return;
    fire(idx);
  }, [isLocked, locked, fire]);

  return (
    <div
      onPointerLeave={() => setHover(null)}
      style={{
        flex: 1,
        minHeight: 0,
        display: "flex",
        flexDirection: "column",
        gap: 5,
        overflow: "hidden",
      }}
    >
      {levels.map((level, idx) => (
        <ScaleBtn
          key={idx}
          level={level}
          testId={`${prefix}-btn-${idx}`}
          isHovered={hover === idx}
          isLocked={isLocked && locked === idx}
          isDimmed={isLocked && locked !== idx}
          progress={progress}
          onEnter={() => setHover(idx)}
          onSelect={() => handleSelect(idx)}
        />
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ACORDEÓN
// ─────────────────────────────────────────────────────────────────────────────

const HEADER_H = 52;

function AccordionPanel({
  title, isOpen, lockedBadge, onToggle, children,
}: {
  title:       string;
  isOpen:      boolean;
  lockedBadge: string | null;
  onToggle:    () => void;
  children:    ReactNode;
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
      const pct = Math.min(1, (Date.now() - startRef.current) / DWELL_MS);
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
      flex: isOpen ? "1 1 0" : `0 0 ${HEADER_H}px`,
      minHeight: HEADER_H,
      display: "flex",
      flexDirection: "column",
      borderRadius: 12,
      overflow: "hidden",
      border: isOpen ? "2px solid #D4CAB8" : "1.5px solid #E0D8CB",
      background: "#FFFFFF",
      boxShadow: isOpen ? "0 2px 10px rgba(0,0,0,0.08)" : "0 1px 3px rgba(0,0,0,0.05)",
      transition: "flex .22s ease, border-color .18s, box-shadow .18s",
    }}>

      {/* Cabecera */}
      <div
        className="gaze-target"
        data-gaze-target="true"
        onPointerEnter={startDwell}
        onPointerLeave={cancelDwell}
        onClick={() => onToggleRef.current()}
        style={{
          height: HEADER_H,
          flexShrink: 0,
          padding: "0 14px",
          display: "flex",
          alignItems: "center",
          gap: 8,
          background: isOpen ? "#FDF2E2" : "#FFFFFF",
          cursor: "pointer",
          position: "relative",
          overflow: "hidden",
          userSelect: "none",
          touchAction: "manipulation",
          WebkitTapHighlightColor: "transparent",
          transition: "background .18s",
        }}
      >
        <span style={{
          fontFamily: "'Lexend',sans-serif",
          fontWeight: 900,
          fontSize: "clamp(.88rem, 2.2vw, 1.05rem)",
          color: "#333333",
          letterSpacing: ".11em",
          textTransform: "uppercase",
          flexShrink: 0,
        }}>
          {title}
        </span>

        {lockedBadge && (
          <span style={{
            background: "rgba(34,197,94,.18)",
            color: "#14532D",
            fontSize: "clamp(.58rem, 1.4vw, .68rem)",
            fontWeight: 800,
            padding: "2px 8px",
            borderRadius: 20,
            fontFamily: "'Lexend',sans-serif",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
            maxWidth: "50%",
          }}>
            ✓ {lockedBadge}
          </span>
        )}

        <span style={{
          fontSize: "1rem",
          color: "#AAAAAA",
          marginLeft: "auto",
          flexShrink: 0,
          lineHeight: 1,
          transform: isOpen ? "rotate(180deg)" : "rotate(0deg)",
          transition: "transform .22s",
        }}>▾</span>

        {dwellPct > 0 && (
          <div style={{
            position: "absolute", bottom: 0, left: 0,
            height: 3,
            width: `${dwellPct * 100}%`,
            background: "#fbbf24",
            borderRadius: "0 2px 0 0",
            pointerEvents: "none",
          }} />
        )}
      </div>

      {/* Contenido */}
      <div style={{
        flex: 1,
        minHeight: 0,
        padding: isOpen ? "5px 6px 6px" : 0,
        display: isOpen ? "flex" : "none",
        flexDirection: "column",
        overflow: "hidden",
      }}>
        {children}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// RESUMEN
// ─────────────────────────────────────────────────────────────────────────────

function ScoreSummary({
  painLabel, breathingLabel, anxietyLabel,
}: {
  painLabel:      string | null;
  breathingLabel: string | null;
  anxietyLabel:   string | null;
}) {
  const findLevel = (levels: ScaleLevel[], label: string | null) =>
    label ? levels.find((l) => l.label === label) ?? null : null;

  const items = [
    { key: "dolor",    title: "Dolor",     level: findLevel(PAIN_LEVELS,      painLabel),      raw: painLabel      },
    { key: "resp",     title: "Resp.",      level: findLevel(BREATHING_LEVELS, breathingLabel), raw: breathingLabel },
    { key: "ansiedad", title: "Ansiedad",  level: findLevel(ANXIETY_LEVELS,   anxietyLabel),   raw: anxietyLabel   },
  ];

  return (
    <div
      data-testid="score-summary"
      style={{
        flexShrink: 0,
        borderRadius: 12,
        background: "#FFFFFF",
        border: "1.5px solid #E0D8CB",
        boxShadow: "0 1px 4px rgba(0,0,0,0.05)",
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
            padding: "6px 4px",
            borderRight: idx < items.length - 1 ? "1px solid #E8E0D4" : "none",
            gap: 3,
            overflow: "hidden",
          }}
        >
          <span style={{
            fontFamily: "'Lexend',sans-serif",
            fontSize: "clamp(.58rem, 1.4vw, .68rem)",
            fontWeight: 700,
            letterSpacing: ".08em",
            textTransform: "uppercase",
            color: "#AAAAAA",
            whiteSpace: "nowrap",
          }}>{item.title}</span>

          {item.level ? (
            <div style={{ display: "flex", alignItems: "center", gap: 3, overflow: "hidden", maxWidth: "100%" }}>
              <span style={{ fontSize: "clamp(.9rem, 2vw, 1.1rem)", lineHeight: 1, flexShrink: 0 }}>
                {item.level.icon}
              </span>
              <span style={{
                fontFamily: "'Lexend',sans-serif",
                fontSize: "clamp(.58rem, 1.4vw, .68rem)",
                fontWeight: 800,
                color: item.level.accent,
                lineHeight: 1.2,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}>
                {item.raw}
              </span>
            </div>
          ) : (
            <span style={{
              fontFamily: "'Lexend',sans-serif",
              fontSize: "clamp(.82rem, 2vw, 1rem)",
              fontWeight: 900,
              color: "#CCCCCC",
            }}>—</span>
          )}
        </div>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PÁGINA
// ─────────────────────────────────────────────────────────────────────────────

type ScaleKey = "pain" | "breathing" | "anxiety";

export default function Scales() {
  const [resetKey,       setResetKey]       = useState(0);
  const [openScale,      setOpenScale]      = useState<ScaleKey | null>(null);
  const [painLabel,      setPainLabel]      = useState<string | null>(null);
  const [breathingLabel, setBreathingLabel] = useState<string | null>(null);
  const [anxietyLabel,   setAnxietyLabel]   = useState<string | null>(null);

  const handleReset = useCallback(() => {
    setResetKey((k) => k + 1);
    setPainLabel(null);
    setBreathingLabel(null);
    setAnxietyLabel(null);
    setOpenScale(null);
  }, []);

  const toggle = useCallback((key: ScaleKey) =>
    setOpenScale((prev) => (prev === key ? null : key)), []);

  return (
    <FullscreenLayout>
      <div style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        overflow: "hidden",
        padding: "6px 8px 8px",
        gap: 6,
        boxSizing: "border-box",
        background: "#FDF2E2",
      }}>

        {/* Botón reiniciar */}
        <div style={{ display: "flex", justifyContent: "flex-end", flexShrink: 0 }}>
          <button
            className="gaze-target"
            data-gaze-target="true"
            data-testid="button-scale-reset"
            onClick={handleReset}
            style={{
              background: "#FFF",
              border: "1.5px solid #E0D8CB",
              borderRadius: 9,
              color: "#555555",
              padding: "5px 12px",
              cursor: "pointer",
              fontFamily: "'Lexend',sans-serif",
              fontWeight: 700,
              fontSize: ".68rem",
              letterSpacing: ".07em",
              textTransform: "uppercase",
              display: "flex",
              alignItems: "center",
              gap: 5,
              boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
              touchAction: "manipulation",
              WebkitTapHighlightColor: "transparent",
            }}
          >
            <RotateCcw style={{ width: 11, height: 11 }} />
            Reiniciar
          </button>
        </div>

        {/* Acordeón DOLOR */}
        <AccordionPanel
          title="Dolor"
          isOpen={openScale === "pain"}
          lockedBadge={painLabel}
          onToggle={() => toggle("pain")}
        >
          <ScaleGrid
            key={`pain-${resetKey}`}
            levels={PAIN_LEVELS}
            prefix="pain"
            onLocked={setPainLabel}
          />
        </AccordionPanel>

        {/* Acordeón RESPIRACIÓN */}
        <AccordionPanel
          title="Respiración"
          isOpen={openScale === "breathing"}
          lockedBadge={breathingLabel}
          onToggle={() => toggle("breathing")}
        >
          <ScaleGrid
            key={`breathing-${resetKey}`}
            levels={BREATHING_LEVELS}
            prefix="breathing"
            onLocked={setBreathingLabel}
          />
        </AccordionPanel>

        {/* Acordeón ANSIEDAD */}
        <AccordionPanel
          title="Ansiedad"
          isOpen={openScale === "anxiety"}
          lockedBadge={anxietyLabel}
          onToggle={() => toggle("anxiety")}
        >
          <ScaleGrid
            key={`anxiety-${resetKey}`}
            levels={ANXIETY_LEVELS}
            prefix="anxiety"
            onLocked={setAnxietyLabel}
          />
        </AccordionPanel>

        {/* Resumen */}
        <ScoreSummary
          painLabel={painLabel}
          breathingLabel={breathingLabel}
          anxietyLabel={anxietyLabel}
        />
      </div>
    </FullscreenLayout>
  );
}
