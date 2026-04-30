import { useState, useRef, useCallback, useEffect, ReactNode } from "react";
import { FullscreenLayout } from "@/components/FullscreenLayout";
import { playBell } from "@/lib/audio";
import { useTTS } from "@/hooks/use-tts";
import { RotateCcw } from "lucide-react";

const DWELL_MS        = 3000;
const ACCORDION_DWELL = 3000;

// ─────────────────────────────────────────────────────────────────────────────
// DATOS
// ─────────────────────────────────────────────────────────────────────────────

type ScaleItem = {
  num:   number;
  face:  string;
  label: string;
  bg:    string;
  tts:   string;
};

const EVA_ITEMS: ScaleItem[] = [
  { num: 0,  face: "😊", label: "Sin dolor",       bg: "#DDF5E0", tts: "Mi dolor es 0 sobre 10. Sin dolor." },
  { num: 1,  face: "🙂", label: "Muy leve",         bg: "#E0F1DF", tts: "Mi dolor es 1 sobre 10. Muy leve." },
  { num: 2,  face: "😌", label: "Leve",             bg: "#E3EEDE", tts: "Mi dolor es 2 sobre 10. Leve." },
  { num: 3,  face: "😐", label: "Leve-moderado",    bg: "#E6EADC", tts: "Mi dolor es 3 sobre 10. Leve-moderado." },
  { num: 4,  face: "😕", label: "Moderado",         bg: "#E9E7DB", tts: "Mi dolor es 4 sobre 10. Moderado." },
  { num: 5,  face: "😟", label: "Moderado-intenso", bg: "#ECE3D9", tts: "Mi dolor es 5 sobre 10. Moderado-intenso." },
  { num: 6,  face: "😮", label: "Intenso",          bg: "#EFDFD8", tts: "Mi dolor es 6 sobre 10. Intenso." },
  { num: 7,  face: "😣", label: "Muy intenso",      bg: "#F2DCD7", tts: "Mi dolor es 7 sobre 10. Muy intenso." },
  { num: 8,  face: "😢", label: "Muy intenso",      bg: "#F4D8D5", tts: "Mi dolor es 8 sobre 10. Muy intenso." },
  { num: 9,  face: "😭", label: "Severo",           bg: "#F5D4D2", tts: "Mi dolor es 9 sobre 10. Severo." },
  { num: 10, face: "😱", label: "Insoportable",     bg: "#F7D0CF", tts: "Mi dolor es 10 sobre 10. Insoportable." },
];

const BORG_ITEMS: ScaleItem[] = [
  { num: 0,  face: "😌", label: "Nada",           bg: "#DDF5E0", tts: "Mi esfuerzo respiratorio es 0. Nada." },
  { num: 1,  face: "😊", label: "Muy leve",        bg: "#E0F1DF", tts: "Mi esfuerzo respiratorio es 1. Muy leve." },
  { num: 2,  face: "🙂", label: "Leve",            bg: "#E3EEDE", tts: "Mi esfuerzo respiratorio es 2. Leve." },
  { num: 3,  face: "😐", label: "Moderado",        bg: "#E6EADC", tts: "Mi esfuerzo respiratorio es 3. Moderado." },
  { num: 4,  face: "😕", label: "Algo duro",       bg: "#E9E7DB", tts: "Mi esfuerzo respiratorio es 4. Algo duro." },
  { num: 5,  face: "😟", label: "Duro",            bg: "#ECE3D9", tts: "Mi esfuerzo respiratorio es 5. Duro." },
  { num: 6,  face: "😟", label: "Duro",            bg: "#EFDFD8", tts: "Mi esfuerzo respiratorio es 6. Duro." },
  { num: 7,  face: "😰", label: "Muy duro",        bg: "#F2DCD7", tts: "Mi esfuerzo respiratorio es 7. Muy duro." },
  { num: 8,  face: "😰", label: "Muy duro",        bg: "#F4D8D5", tts: "Mi esfuerzo respiratorio es 8. Muy duro." },
  { num: 9,  face: "😱", label: "Extremo",         bg: "#F5D4D2", tts: "Mi esfuerzo respiratorio es 9. Extremo." },
  { num: 10, face: "😱", label: "Máximo absoluto", bg: "#F7D0CF", tts: "Mi esfuerzo respiratorio es 10. Máximo absoluto." },
];

const ANXIETY_ITEMS: ScaleItem[] = [
  { num: 1, face: "😌", label: "Tranquilo",   bg: "#DDF5E0", tts: "Estoy tranquilo." },
  { num: 2, face: "🙂", label: "Inquieto",    bg: "#E4EBDC", tts: "Me siento inquieto." },
  { num: 3, face: "😟", label: "Ansioso",     bg: "#ECE3D9", tts: "Estoy ansioso." },
  { num: 4, face: "😰", label: "Muy ansioso", bg: "#F2DCD7", tts: "Estoy muy ansioso." },
  { num: 5, face: "😱", label: "Pánico",      bg: "#F7D0CF", tts: "Siento pánico." },
];

// ─────────────────────────────────────────────────────────────────────────────
// HOOK: progreso de dwell con RAF
// ─────────────────────────────────────────────────────────────────────────────
function useDwellProgress(
  activeIdx: number | null,
  dwell: number,
  onFire: (idx: number) => void,
): number {
  const [progress, setProgress] = useState(0);
  const rafRef    = useRef<number | null>(null);
  const startRef  = useRef(0);
  const prevRef   = useRef<number | null>(null);
  const firedRef  = useRef(false);
  const fireRef   = useRef(onFire);
  fireRef.current = onFire;

  useEffect(() => {
    if (rafRef.current !== null) { cancelAnimationFrame(rafRef.current); rafRef.current = null; }
    if (activeIdx === null) { setProgress(0); prevRef.current = null; firedRef.current = false; return; }
    if (activeIdx !== prevRef.current) {
      prevRef.current = activeIdx; startRef.current = Date.now();
      firedRef.current = false; setProgress(0);
    }
    const captured = activeIdx;
    const tick = () => {
      const pct = Math.min(1, (Date.now() - startRef.current) / dwell);
      setProgress(pct);
      if (pct < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else if (!firedRef.current) {
        firedRef.current = true; rafRef.current = null;
        fireRef.current(captured);
      }
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current !== null) { cancelAnimationFrame(rafRef.current); rafRef.current = null; } };
  }, [activeIdx, dwell]);

  return progress;
}

// ─────────────────────────────────────────────────────────────────────────────
// BOTÓN INDIVIDUAL — sin altura mínima fija, se adapta a la fila del grid
// ─────────────────────────────────────────────────────────────────────────────
interface ScaleBtnProps {
  item:      ScaleItem;
  testId:    string;
  isHovered: boolean;
  isLocked:  boolean;
  isDimmed:  boolean;
  progress:  number;
  onEnter:   () => void;
  onSelect:  () => void;
}

function ScaleBtn({ item, testId, isHovered, isLocked, isDimmed, progress, onEnter, onSelect }: ScaleBtnProps) {
  return (
    <div
      data-gaze-target="true"
      data-testid={testId}
      onPointerEnter={onEnter}
      onClick={onSelect}
      style={{
        /* el grid le asigna la altura exacta — nunca desborda */
        minHeight: 0,
        minWidth: 0,
        display: "flex",
        alignItems: "center",
        padding: "0 10px",
        gap: 8,
        boxSizing: "border-box",
        background: isLocked ? "#F0FDF4" : item.bg,
        border: isLocked
          ? "2px solid #22C55E"
          : isHovered
          ? "2px solid #F59E0B"
          : "1px solid rgba(0,0,0,0.07)",
        borderRadius: 10,
        opacity: isDimmed ? 0.32 : 1,
        position: "relative",
        overflow: "hidden",
        cursor: "pointer",
        userSelect: "none",
        touchAction: "manipulation",
        WebkitTapHighlightColor: "transparent",
        boxShadow: isLocked
          ? "0 0 12px rgba(34,197,94,0.3)"
          : isHovered
          ? "0 1px 8px rgba(245,158,11,0.2)"
          : "0 1px 2px rgba(0,0,0,0.05)",
        transition: "border-color .12s, box-shadow .14s, opacity .18s, background .14s",
      }}
    >
      {/* Barra de progreso dwell — llena el borde inferior */}
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

      {/* Checkmark cuando bloqueado */}
      {isLocked && (
        <div style={{
          position: "absolute",
          top: 4, right: 6,
          fontSize: ".58rem",
          fontWeight: 900,
          color: "#16A34A",
          fontFamily: "'Lexend',sans-serif",
          lineHeight: 1,
          pointerEvents: "none",
        }}>✓</div>
      )}

      {/* Número — grande y en negrita a la izquierda */}
      <span style={{
        fontFamily: "'Lexend',sans-serif",
        fontWeight: 900,
        /* fuente adaptativa: si el botón es bajo, el número se achica */
        fontSize: "clamp(.85rem,3.5cqh,1.5rem)",
        color: isLocked ? "#16A34A" : "#1A1A1A",
        lineHeight: 1,
        minWidth: "1.8ch",
        textAlign: "center",
        flexShrink: 0,
        pointerEvents: "none",
      }}>
        {item.num}
      </span>

      {/* Emoji — al centro */}
      <span style={{
        fontSize: "clamp(.9rem,3.8cqh,1.6rem)",
        lineHeight: 1,
        flexShrink: 0,
        pointerEvents: "none",
        filter: isHovered && !isLocked ? "drop-shadow(0 0 3px rgba(245,158,11,.5))" : "none",
        transition: "filter .14s",
      }}>
        {item.face}
      </span>

      {/* Etiqueta — alineada a la derecha */}
      <span style={{
        fontFamily: "'Lexend',sans-serif",
        fontWeight: 700,
        fontSize: "clamp(.55rem,2.5cqh,.88rem)",
        color: isLocked ? "#14532D" : "#2A2A2A",
        flex: 1,
        textAlign: "right",
        lineHeight: 1.15,
        overflow: "hidden",
        display: "-webkit-box",
        WebkitLineClamp: 2,
        WebkitBoxOrient: "vertical",
        pointerEvents: "none",
      }}>
        {item.label}
      </span>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// GRID DE ESCALA — sin scroll, altura 100 %, distribución exacta
// • 11 ítems → 2 columnas × 6 filas  (la última celda queda vacía)
// •  5 ítems → 1 columna  × 5 filas
// ─────────────────────────────────────────────────────────────────────────────
interface ScaleGridProps {
  items:    ScaleItem[];
  prefix:   string;
  onLocked: (val: number | null) => void;
}

function ScaleGrid({ items, prefix, onLocked }: ScaleGridProps) {
  const { speak }  = useTTS();
  const [hover,  setHover]  = useState<number | null>(null);
  const [locked, setLocked] = useState<number | null>(null);

  const fire = useCallback((idx: number) => {
    setLocked(idx);
    onLocked(items[idx].num);
    playBell();
    speak(items[idx].tts);
  }, [items, onLocked, speak]);

  const progress  = useDwellProgress(hover, DWELL_MS, fire);
  const isLocked  = locked !== null && hover === null;

  const handleSelect = useCallback((idx: number) => {
    if (isLocked && locked === idx) return;
    fire(idx);
  }, [isLocked, locked, fire]);

  /* Distribución en rejilla: >6 ítems → 2 columnas */
  const cols = items.length > 6 ? 2 : 1;
  const rows = Math.ceil(items.length / cols);

  return (
    <div
      /* contenedor sin contenido gaze-target propio */
      onPointerLeave={() => setHover(null)}
      style={{
        /* ocupa todo el espacio que el acordeón le deja */
        flex: 1,
        minHeight: 0,
        /* contenedor de consulta para clamp(…cqh…) */
        containerType: "size",
        display: "grid",
        gridTemplateColumns: `repeat(${cols}, 1fr)`,
        gridTemplateRows: `repeat(${rows}, 1fr)`,
        /* flow en fila: 0,1 | 2,3 | 4,5 … legible de izq a der */
        gridAutoFlow: "row",
        gap: 4,
        overflow: "hidden",
      }}
    >
      {items.map((item, idx) => (
        <ScaleBtn
          key={idx}
          item={item}
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
// ACORDEÓN — transición suave, overflow oculto para no generar scroll
// ─────────────────────────────────────────────────────────────────────────────
const HEADER_H = 50; // px — cabecera reducida

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
      flex: isOpen ? "1 1 0" : `0 0 ${HEADER_H}px`,
      minHeight: HEADER_H,
      display: "flex",
      flexDirection: "column",
      borderRadius: 12,
      /* overflow hidden es clave: impide que el contenido genere scroll */
      overflow: "hidden",
      border: isOpen ? "2px solid #D4CAB8" : "1.5px solid #E0D8CB",
      background: "#FFFFFF",
      boxShadow: isOpen
        ? "0 2px 10px rgba(0,0,0,0.08)"
        : "0 1px 3px rgba(0,0,0,0.05)",
      transition: "flex .22s ease, border-color .18s, box-shadow .18s",
    }}>

      {/* ── Cabecera (siempre visible, es el dwell target) ────────────────── */}
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
          fontSize: "clamp(.76rem,2vw,.98rem)",
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
            fontSize: ".65rem",
            fontWeight: 800,
            padding: "2px 8px",
            borderRadius: 20,
            fontFamily: "'Lexend',sans-serif",
            whiteSpace: "nowrap",
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

      {/* ── Contenido: ocupa el resto del panel, overflow hidden ──────────── */}
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
// RESUMEN DE PUNTUACIONES
// ─────────────────────────────────────────────────────────────────────────────
function ScoreSummary({
  evaLocked, borgLocked, anxietyLocked,
}: {
  evaLocked: number | null;
  borgLocked: number | null;
  anxietyLocked: number | null;
}) {
  const anxietyLabel = anxietyLocked !== null
    ? ANXIETY_ITEMS[anxietyLocked - 1]?.label ?? null
    : null;

  const items = [
    { key: "eva",      label: "Dolor",    value: evaLocked  !== null ? `${evaLocked}/10`  : null },
    { key: "borg",     label: "Esfuerzo", value: borgLocked !== null ? `${borgLocked}/10` : null },
    { key: "ansiedad", label: "Ansiedad", value: anxietyLabel },
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
            gap: 2,
          }}
        >
          <span style={{
            fontFamily: "'Lexend',sans-serif",
            fontSize: "clamp(.42rem,1.1vw,.58rem)",
            fontWeight: 700,
            letterSpacing: ".1em",
            textTransform: "uppercase",
            color: "#AAAAAA",
          }}>{item.label}</span>
          <span style={{
            fontFamily: "'Lexend',sans-serif",
            fontSize: "clamp(.66rem,1.7vw,.88rem)",
            fontWeight: 900,
            color: item.value !== null ? "#16A34A" : "#CCCCCC",
            textAlign: "center",
          }}>{item.value ?? "—"}</span>
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

  const evaBadge     = evaLocked     !== null ? `${evaLocked}/10`                       : null;
  const borgBadge    = borgLocked    !== null ? `${borgLocked}/10`                      : null;
  const anxietyBadge = anxietyLocked !== null ? ANXIETY_ITEMS[anxietyLocked - 1]?.label : null;

  return (
    <FullscreenLayout>
      <div style={{
        display: "flex",
        flexDirection: "column",
        /* altura total sin scroll: el acordeón absorbe el espacio disponible */
        height: "100%",
        overflow: "hidden",
        padding: "6px 8px 8px",
        gap: 6,
        boxSizing: "border-box",
        background: "#FDF2E2",
      }}>

        {/* ── Botón reiniciar ─────────────────────────────────────────────── */}
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

        {/* ── Acordeón DOLOR (EVA) ──────────────────────────────────────── */}
        <AccordionPanel
          title="Dolor (EVA)"
          isOpen={openScale === "eva"}
          lockedBadge={evaBadge}
          onToggle={() => toggle("eva")}
        >
          <ScaleGrid
            key={`eva-${resetKey}`}
            items={EVA_ITEMS}
            prefix="eva"
            onLocked={setEvaLocked}
          />
        </AccordionPanel>

        {/* ── Acordeón RESPIRACIÓN (BORG) ──────────────────────────────── */}
        <AccordionPanel
          title="Respiración (BORG)"
          isOpen={openScale === "borg"}
          lockedBadge={borgBadge}
          onToggle={() => toggle("borg")}
        >
          <ScaleGrid
            key={`borg-${resetKey}`}
            items={BORG_ITEMS}
            prefix="borg"
            onLocked={setBorgLocked}
          />
        </AccordionPanel>

        {/* ── Acordeón ANSIEDAD ────────────────────────────────────────── */}
        <AccordionPanel
          title="Ansiedad"
          isOpen={openScale === "anxiety"}
          lockedBadge={anxietyBadge}
          onToggle={() => toggle("anxiety")}
        >
          <ScaleGrid
            key={`ansiedad-${resetKey}`}
            items={ANXIETY_ITEMS}
            prefix="anxiety"
            onLocked={setAnxietyLocked}
          />
        </AccordionPanel>

        {/* ── Resumen de puntuaciones ───────────────────────────────────── */}
        <ScoreSummary
          evaLocked={evaLocked}
          borgLocked={borgLocked}
          anxietyLocked={anxietyLocked}
        />
      </div>
    </FullscreenLayout>
  );
}
