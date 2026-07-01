import { useState, useRef, useCallback, useEffect } from "react";
import { FullscreenLayout } from "@/components/FullscreenLayout";
import { playBell } from "@/lib/audio";
import { useTTS } from "@/hooks/use-tts";
import { RotateCcw } from "lucide-react";
import { DWELL_MS } from "@/lib/dwell";

// ─────────────────────────────────────────────────────────────────────────────
// DATOS — 5 niveles por escala, progresión verde → rojo
// ─────────────────────────────────────────────────────────────────────────────

type ScaleLevel = { label: string; icon: string; bg: string; accent: string; tts: string; };

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

type ScaleKey = "pain" | "breathing" | "anxiety";

const SCALE_META: { key: ScaleKey; title: string; levels: ScaleLevel[] }[] = [
  { key: "pain",      title: "Dolor",       levels: PAIN_LEVELS      },
  { key: "breathing", title: "Respiración", levels: BREATHING_LEVELS },
  { key: "anxiety",   title: "Ansiedad",    levels: ANXIETY_LEVELS   },
];

// ─────────────────────────────────────────────────────────────────────────────
// HOOK: progreso visual de dwell (no dispara — activación vía onClick)
// ─────────────────────────────────────────────────────────────────────────────

function useDwellProgress(activeIdx: number | null, dwell: number): number {
  const [progress, setProgress] = useState(0);
  const rafRef   = useRef<number | null>(null);
  const startRef = useRef(0);
  const prevRef  = useRef<number | null>(null);

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
// BOTÓN DE NIVEL — mitad izquierda: emoji ≥80px | mitad derecha: texto grande
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
        /* mínimo absoluto: el eye-tracking necesita área amplia */
        minHeight: 100,
        display: "flex",
        flexDirection: "row",
        boxSizing: "border-box",
        background: isLocked ? "#F0FDF4" : level.bg,
        border: isLocked
          ? "2.5px solid #22C55E"
          : isHovered
          ? "2.5px solid #F59E0B"
          : "1.5px solid rgba(0,0,0,0.07)",
        borderLeft: `8px solid ${isLocked ? "#22C55E" : level.accent}`,
        borderRadius: 16,
        opacity: isDimmed ? 0.27 : 1,
        position: "relative",
        overflow: "hidden",
        cursor: "pointer",
        userSelect: "none",
        touchAction: "manipulation",
        WebkitTapHighlightColor: "transparent",
        boxShadow: isLocked
          ? "0 0 18px rgba(34,197,94,0.32)"
          : isHovered
          ? "0 2px 14px rgba(245,158,11,0.32)"
          : "0 1px 3px rgba(0,0,0,0.06)",
        transition: "border-color .12s, box-shadow .14s, opacity .18s, background .14s",
      }}
    >
      {/* Barra dwell en borde inferior */}
      {isHovered && !isLocked && (
        <div style={{
          position: "absolute", bottom: 0, left: 0,
          height: 4,
          width: `${progress * 100}%`,
          background: "#F59E0B",
          borderRadius: "0 3px 0 0",
          pointerEvents: "none",
        }} />
      )}

      {/* Mitad izquierda — emoji centrado, mínimo 80 px */}
      <div style={{
        width: "50%",
        flexShrink: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        borderRight: `1px solid ${isLocked ? "rgba(34,197,94,0.2)" : "rgba(0,0,0,0.06)"}`,
        pointerEvents: "none",
      }}>
        <span style={{
          /* clamp garantiza ≥ 4rem (64px) y escala con la altura de pantalla */
          fontSize: "clamp(4rem, 12vh, 6rem)",
          lineHeight: 1,
          pointerEvents: "none",
          filter: isHovered && !isLocked ? "drop-shadow(0 0 7px rgba(245,158,11,.65))" : "none",
          transition: "filter .14s",
        }}>
          {level.icon}
        </span>
      </div>

      {/* Mitad derecha — etiqueta con fuente grande */}
      <div style={{
        flex: 1,
        display: "flex",
        alignItems: "center",
        padding: "0 16px 0 18px",
        gap: 10,
        pointerEvents: "none",
      }}>
        <span style={{
          fontFamily: "'Lexend', sans-serif",
          fontWeight: 800,
          fontSize: "clamp(1.1rem, 2.8vw, 1.75rem)",
          color: isLocked ? "#16A34A" : level.accent,
          lineHeight: 1.2,
          flex: 1,
        }}>
          {level.label}
        </span>
        {isLocked && (
          <span style={{
            color: "#16A34A", fontSize: "1.6rem",
            fontWeight: 900, flexShrink: 0,
          }}>✓</span>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// LISTA DE NIVELES — columna de 5 botones, scroll si la pantalla es muy pequeña
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

  const progress = useDwellProgress(hover, DWELL_MS);
  const hasLock  = locked !== null;

  const handleSelect = useCallback((idx: number) => {
    if (hasLock && locked === idx) return;
    fire(idx);
  }, [hasLock, locked, fire]);

  return (
    <div
      onPointerLeave={() => setHover(null)}
      style={{
        flex: 1,
        minHeight: 0,
        display: "flex",
        flexDirection: "column",
        gap: 6,
        /* scroll solo si no caben los 5 botones a 100px */
        overflowY: "auto",
      }}
    >
      {levels.map((level, idx) => (
        <ScaleBtn
          key={idx}
          level={level}
          testId={`${prefix}-btn-${idx}`}
          isHovered={hover === idx}
          isLocked={hasLock && locked === idx}
          isDimmed={hasLock && locked !== idx}
          progress={progress}
          onEnter={() => setHover(idx)}
          onSelect={() => handleSelect(idx)}
        />
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PESTAÑA — gaze-target con dwell para cambiar de escala
// ─────────────────────────────────────────────────────────────────────────────

function TabButton({ title, isActive, lockedLabel, onSelect }: {
  title:       string;
  isActive:    boolean;
  lockedLabel: string | null;
  onSelect:    () => void;
}) {
  const rafRef      = useRef<number | null>(null);
  const startRef    = useRef(0);
  const [dwellPct, setDwellPct] = useState(0);
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;

  const cancelDwell = useCallback(() => {
    if (rafRef.current !== null) { cancelAnimationFrame(rafRef.current); rafRef.current = null; }
    setDwellPct(0);
  }, []);

  const startDwell = useCallback(() => {
    if (rafRef.current !== null || isActive) return;
    startRef.current = Date.now();
    const tick = () => {
      const pct = Math.min(1, (Date.now() - startRef.current) / DWELL_MS);
      setDwellPct(pct);
      if (pct < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        rafRef.current = null;
        setDwellPct(0);
        onSelectRef.current();
      }
    };
    rafRef.current = requestAnimationFrame(tick);
  }, [isActive]);

  useEffect(() => () => cancelDwell(), [cancelDwell]);

  return (
    <div
      className="gaze-target"
      data-gaze-target="true"
      onPointerEnter={startDwell}
      onPointerLeave={cancelDwell}
      onClick={() => onSelectRef.current()}
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 3,
        padding: "8px 4px",
        position: "relative",
        overflow: "hidden",
        background: isActive ? "#FDF2E2" : "#FFFFFF",
        borderBottom: isActive ? "4px solid #D97706" : "4px solid transparent",
        cursor: "pointer",
        userSelect: "none",
        touchAction: "manipulation",
        WebkitTapHighlightColor: "transparent",
        transition: "background .18s, border-color .18s",
      }}
    >
      <span style={{
        fontFamily: "'Lexend', sans-serif",
        fontWeight: isActive ? 900 : 700,
        fontSize: "clamp(.8rem, 2.1vw, 1rem)",
        color: isActive ? "#92400E" : "#777777",
        letterSpacing: ".07em",
        textTransform: "uppercase",
        lineHeight: 1,
        whiteSpace: "nowrap",
      }}>
        {title}
      </span>

      {lockedLabel && (
        <span style={{
          fontFamily: "'Lexend', sans-serif",
          fontSize: "clamp(.52rem, 1.3vw, .62rem)",
          fontWeight: 800,
          color: "#16A34A",
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
          maxWidth: "95%",
          textAlign: "center",
        }}>
          ✓ {lockedLabel}
        </span>
      )}

      {dwellPct > 0 && (
        <div style={{
          position: "absolute", bottom: 0, left: 0,
          height: 4,
          width: `${dwellPct * 100}%`,
          background: "#fbbf24",
          pointerEvents: "none",
        }} />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// RESUMEN + REINICIAR (barra inferior combinada)
// ─────────────────────────────────────────────────────────────────────────────

function BottomBar({
  painLabel, breathingLabel, anxietyLabel, onReset,
}: {
  painLabel:      string | null;
  breathingLabel: string | null;
  anxietyLabel:   string | null;
  onReset:        () => void;
}) {
  const findLevel = (levels: ScaleLevel[], label: string | null) =>
    label ? levels.find((l) => l.label === label) ?? null : null;

  const chips = [
    { key: "dolor",    title: "Dolor",    lv: findLevel(PAIN_LEVELS,      painLabel),      raw: painLabel      },
    { key: "resp",     title: "Resp.",    lv: findLevel(BREATHING_LEVELS, breathingLabel), raw: breathingLabel },
    { key: "ansiedad", title: "Ansiedad", lv: findLevel(ANXIETY_LEVELS,   anxietyLabel),   raw: anxietyLabel   },
  ];

  return (
    <div style={{
      flexShrink: 0,
      display: "flex",
      alignItems: "stretch",
      background: "#FFFFFF",
      border: "1.5px solid #E0D8CB",
      borderRadius: 12,
      overflow: "hidden",
      boxShadow: "0 1px 4px rgba(0,0,0,0.05)",
    }}>
      {chips.map((chip, idx) => (
        <div
          key={chip.key}
          data-testid={`score-chip-${chip.key}`}
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: "5px 4px",
            borderRight: "1px solid #E8E0D4",
            gap: 2,
            overflow: "hidden",
          }}
        >
          <span style={{
            fontFamily: "'Lexend', sans-serif",
            fontSize: "clamp(.56rem, 1.3vw, .66rem)",
            fontWeight: 700,
            letterSpacing: ".07em",
            textTransform: "uppercase",
            color: "#AAAAAA",
            whiteSpace: "nowrap",
          }}>{chip.title}</span>

          {chip.lv ? (
            <div style={{ display: "flex", alignItems: "center", gap: 3, overflow: "hidden", maxWidth: "100%" }}>
              <span style={{ fontSize: "clamp(.85rem, 2vw, 1rem)", lineHeight: 1, flexShrink: 0 }}>
                {chip.lv.icon}
              </span>
              <span style={{
                fontFamily: "'Lexend', sans-serif",
                fontSize: "clamp(.54rem, 1.3vw, .64rem)",
                fontWeight: 800,
                color: chip.lv.accent,
                lineHeight: 1.2,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}>
                {chip.raw}
              </span>
            </div>
          ) : (
            <span style={{
              fontFamily: "'Lexend', sans-serif",
              fontSize: "clamp(.8rem, 1.8vw, .95rem)",
              fontWeight: 900,
              color: "#CCCCCC",
            }}>—</span>
          )}
        </div>
      ))}

      {/* Botón reiniciar integrado en la barra */}
      <button
        className="gaze-target"
        data-gaze-target="true"
        data-testid="button-scale-reset"
        onClick={onReset}
        style={{
          flexShrink: 0,
          width: 52,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 3,
          background: "#FAFAFA",
          border: "none",
          borderLeft: "1px solid #E8E0D4",
          cursor: "pointer",
          padding: 0,
          touchAction: "manipulation",
          WebkitTapHighlightColor: "transparent",
        }}
      >
        <RotateCcw style={{ width: 16, height: 16, color: "#888888" }} />
        <span style={{
          fontFamily: "'Lexend', sans-serif",
          fontSize: ".52rem",
          fontWeight: 700,
          color: "#AAAAAA",
          letterSpacing: ".05em",
          textTransform: "uppercase",
        }}>Reset</span>
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PÁGINA
// ─────────────────────────────────────────────────────────────────────────────

export default function Scales() {
  const [resetKey,       setResetKey]       = useState(0);
  const [activeScale,    setActiveScale]    = useState<ScaleKey>("pain");
  const [painLabel,      setPainLabel]      = useState<string | null>(null);
  const [breathingLabel, setBreathingLabel] = useState<string | null>(null);
  const [anxietyLabel,   setAnxietyLabel]   = useState<string | null>(null);

  const handleReset = useCallback(() => {
    setResetKey((k) => k + 1);
    setPainLabel(null);
    setBreathingLabel(null);
    setAnxietyLabel(null);
    setActiveScale("pain");
  }, []);

  const labelMap: Record<ScaleKey, string | null> = {
    pain:      painLabel,
    breathing: breathingLabel,
    anxiety:   anxietyLabel,
  };

  const setLabelMap: Record<ScaleKey, (v: string | null) => void> = {
    pain:      setPainLabel,
    breathing: setBreathingLabel,
    anxiety:   setAnxietyLabel,
  };

  const activeMeta = SCALE_META.find((s) => s.key === activeScale)!;

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

        {/* ── Barra de pestañas ─────────────────────────────────────────── */}
        <div style={{
          flexShrink: 0,
          display: "flex",
          flexDirection: "row",
          height: 60,
          background: "#FFFFFF",
          borderRadius: 12,
          border: "1.5px solid #E0D8CB",
          overflow: "hidden",
          boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
        }}>
          {SCALE_META.map((s) => (
            <TabButton
              key={s.key}
              title={s.title}
              isActive={activeScale === s.key}
              lockedLabel={labelMap[s.key]}
              onSelect={() => setActiveScale(s.key)}
            />
          ))}
        </div>

        {/* ── Área de la escala activa ───────────────────────────────────── */}
        <div style={{
          flex: 1,
          minHeight: 0,
          display: "flex",
          flexDirection: "column",
          background: "#FFFFFF",
          borderRadius: 12,
          border: "1.5px solid #E0D8CB",
          padding: "8px",
          boxSizing: "border-box",
          boxShadow: "0 1px 6px rgba(0,0,0,0.06)",
          overflow: "hidden",
        }}>
          <ScaleGrid
            key={`${activeScale}-${resetKey}`}
            levels={activeMeta.levels}
            prefix={activeScale}
            onLocked={setLabelMap[activeScale]}
          />
        </div>

        {/* ── Resumen + Reiniciar ────────────────────────────────────────── */}
        <BottomBar
          painLabel={painLabel}
          breathingLabel={breathingLabel}
          anxietyLabel={anxietyLabel}
          onReset={handleReset}
        />
      </div>
    </FullscreenLayout>
  );
}
