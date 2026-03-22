import { useState, useRef, useCallback } from "react";
import { FullscreenLayout } from "@/components/FullscreenLayout";
import { playBell } from "@/lib/audio";
import { useTTS } from "@/hooks/use-tts";
import { RotateCcw } from "lucide-react";

const DWELL_MS = 2500;

// ─────────────────────────────────────────────────────────────────────────────
// DATOS
// ─────────────────────────────────────────────────────────────────────────────

const BORG_BLOCKS = [
  { value: 0,  label: "Nada",              face: "😌", bg: "#A8D8F0" },
  { value: 1,  label: "Muy leve",          face: "😊", bg: "#82C4EB" },
  { value: 2,  label: "Leve",              face: "🙂", bg: "#5BAEE0" },
  { value: 3,  label: "Moderado",          face: "😐", bg: "#7DD4A0" },
  { value: 4,  label: "Algo duro",         face: "😐", bg: "#55C47A" },
  { value: 5,  label: "Duro",              face: "😟", bg: "#FFE566" },
  { value: 6,  label: "Duro",             face: "😟", bg: "#FFD01E" },
  { value: 7,  label: "Muy duro",          face: "😰", bg: "#FFB347" },
  { value: 8,  label: "Muy duro",          face: "😰", bg: "#FF8C42" },
  { value: 9,  label: "Extremo",           face: "😱", bg: "#FF6B6B" },
  { value: 10, label: "Máximo",            face: "😱", bg: "#FF4040" },
] as const;

const ANXIETY_LEVELS = [
  { label: "Tranquilo",    face: "😌", bg: "#6DC98E", tts: "Estoy tranquilo" },
  { label: "Inquieto",     face: "🙂", bg: "#B8E07A", tts: "Me siento inquieto" },
  { label: "Ansioso",      face: "😟", bg: "#FFD166", tts: "Estoy ansioso" },
  { label: "Muy ansioso",  face: "😰", bg: "#FF9B54", tts: "Estoy muy ansioso" },
  { label: "Pánico",       face: "😱", bg: "#FF6B6B", tts: "Siento pánico" },
] as const;

// ─────────────────────────────────────────────────────────────────────────────
// HOOK DWELL GENÉRICO
// ─────────────────────────────────────────────────────────────────────────────
function useDwell<T>(onLock: (value: T) => void) {
  const timerRef   = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastRef    = useRef<T | null>(null);

  const trigger = useCallback((value: T) => {
    if (value !== lastRef.current) {
      lastRef.current = value;
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => { timerRef.current = null; onLock(value); }, DWELL_MS);
    }
  }, [onLock]);

  const cancel = useCallback(() => {
    if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
    lastRef.current = null;
  }, []);

  return { trigger, cancel };
}

// ─────────────────────────────────────────────────────────────────────────────
// ESCALA 1 — EVA (Dolor): gradiente continuo 0-10
// ─────────────────────────────────────────────────────────────────────────────
function EvaStrip() {
  const { speak }     = useTTS();
  const stripRef      = useRef<HTMLDivElement>(null);
  const [hover, setHover]   = useState<number | null>(null);
  const [locked, setLocked] = useState<number | null>(null);

  const onLock = useCallback((val: number) => {
    setLocked(val);
    playBell();
    speak(`Mi nivel de dolor es ${val} sobre diez.`);
  }, [speak]);

  const { trigger, cancel } = useDwell<number>(onLock);

  const onPointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    const rect = stripRef.current?.getBoundingClientRect();
    if (!rect) return;
    const val = Math.max(0, Math.min(10, Math.round((e.clientX - rect.left) / rect.width * 10)));
    setHover(val);
    trigger(val);
  }, [trigger]);

  const onPointerLeave = useCallback(() => { cancel(); setHover(null); }, [cancel]);

  const active    = hover ?? locked;
  const isLocked  = locked !== null && hover === null;

  return (
    <div
      ref={stripRef}
      data-gaze-target="true"
      onPointerMove={onPointerMove}
      onPointerLeave={onPointerLeave}
      style={{
        flex: 1, minHeight: 0, borderRadius: 16, cursor: "crosshair",
        touchAction: "none", userSelect: "none", overflow: "hidden",
        background: "linear-gradient(to right, #28A745 0%, #DC3545 100%)",
        border: isLocked ? "3px solid #fbbf24" : "2px solid rgba(0,0,0,0.12)",
        boxShadow: isLocked ? "0 0 22px rgba(251,191,36,0.5)" : "none",
        display: "flex", flexDirection: "column",
        justifyContent: "space-between", padding: "7px 12px",
        boxSizing: "border-box", transition: "border-color .2s, box-shadow .2s",
      }}
    >
      {/* Etiqueta */}
      <div style={{ textAlign: "center", fontFamily: "'Lexend',sans-serif", fontWeight: 900, fontSize: "clamp(.6rem,1.4vw,.85rem)", color: "#333", letterSpacing: ".18em", textTransform: "uppercase", textShadow: "0 1px 3px rgba(255,255,255,.65)" }}>
        DOLOR (EVA)
        {isLocked && <span style={{ marginLeft: 10, fontSize: ".6rem", background: "rgba(251,191,36,.35)", color: "#6B4500", padding: "1px 8px", borderRadius: 8, fontWeight: 700 }}>✓ {locked}/10</span>}
      </div>

      {/* Fila de caras + números 0-10 */}
      <div style={{ display: "flex", alignItems: "center", flex: 1, minHeight: 0, gap: 6, padding: "4px 0" }}>
        <span style={{ fontSize: "clamp(1.3rem,3.5vw,1.9rem)", flexShrink: 0 }}>😊</span>
        <div style={{ flex: 1, display: "flex", justifyContent: "space-between", alignItems: "center", height: "100%" }}>
          {Array.from({ length: 11 }, (_, i) => i).map((n) => {
            const isSel    = active === n;
            const isThisLk = isLocked && locked === n;
            const sz       = isThisLk ? 46 : isSel ? 40 : 26;
            return (
              <div key={n} style={{
                width: sz, height: sz, borderRadius: "50%", flexShrink: 0,
                background: isThisLk ? "#fbbf24" : isSel ? "rgba(0,0,0,.32)" : "rgba(0,0,0,.14)",
                color: "#333", display: "flex", alignItems: "center", justifyContent: "center",
                fontFamily: "'Lexend',sans-serif",
                fontWeight: isSel || isThisLk ? 900 : 700,
                fontSize: isThisLk ? "clamp(.95rem,2.8vw,1.2rem)" : isSel ? "clamp(.85rem,2.3vw,1.1rem)" : "clamp(.6rem,1.6vw,.8rem)",
                border: isThisLk ? "3px solid #7A4500" : "none",
                boxShadow: isThisLk ? "0 0 14px rgba(251,191,36,.7)" : "none",
                textShadow: "0 1px 3px rgba(255,255,255,.55)",
                transition: "width .18s,height .18s,font-size .18s,background .14s",
              }}>{n}</div>
            );
          })}
        </div>
        <span style={{ fontSize: "clamp(1.3rem,3.5vw,1.9rem)", flexShrink: 0 }}>😭</span>
      </div>

      {active === null && (
        <div style={{ textAlign: "center", fontFamily: "'Lexend',sans-serif", fontSize: ".58rem", fontWeight: 600, color: "rgba(51,51,51,.55)", textShadow: "0 1px 2px rgba(255,255,255,.5)" }}>
          Mira un número · 2,5 s para fijar
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ESCALA 2 — BORG (Respiración): 11 bloques discretos coloreados
// ─────────────────────────────────────────────────────────────────────────────
function BorgStrip() {
  const { speak }     = useTTS();
  const stripRef      = useRef<HTMLDivElement>(null);
  const [hover, setHover]   = useState<number | null>(null); // 0-10
  const [locked, setLocked] = useState<number | null>(null);

  const onLock = useCallback((idx: number) => {
    setLocked(idx);
    playBell();
    speak(`Mi nivel de esfuerzo es ${idx}, ${BORG_BLOCKS[idx].label}.`);
  }, [speak]);

  const { trigger, cancel } = useDwell<number>(onLock);

  const onPointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    const rect = stripRef.current?.getBoundingClientRect();
    if (!rect) return;
    const idx = Math.max(0, Math.min(10, Math.floor((e.clientX - rect.left) / rect.width * 11)));
    setHover(idx);
    trigger(idx);
  }, [trigger]);

  const onPointerLeave = useCallback(() => { cancel(); setHover(null); }, [cancel]);

  const activeIdx = hover ?? locked;
  const isLocked  = locked !== null && hover === null;

  return (
    <div
      ref={stripRef}
      data-gaze-target="true"
      onPointerMove={onPointerMove}
      onPointerLeave={onPointerLeave}
      style={{
        flex: 1, minHeight: 0, borderRadius: 16, cursor: "crosshair",
        touchAction: "none", userSelect: "none",
        border: isLocked ? "3px solid #fbbf24" : "2px solid rgba(0,0,0,0.12)",
        boxShadow: isLocked ? "0 0 22px rgba(251,191,36,0.5)" : "none",
        display: "flex", flexDirection: "column",
        padding: "7px 8px", gap: 4, boxSizing: "border-box",
        background: "#1A1A1A",
        transition: "border-color .2s, box-shadow .2s",
      }}
    >
      {/* Etiqueta */}
      <div style={{ textAlign: "center", fontFamily: "'Lexend',sans-serif", fontWeight: 900, fontSize: "clamp(.6rem,1.4vw,.82rem)", color: "rgba(255,255,255,.85)", letterSpacing: ".18em", textTransform: "uppercase", flexShrink: 0 }}>
        RESPIRACIÓN (BORG)
        {isLocked && (
          <span style={{ marginLeft: 10, fontSize: ".6rem", background: "rgba(251,191,36,.35)", color: "#FFD", padding: "1px 8px", borderRadius: 8, fontWeight: 700 }}>
            ✓ {locked} – {BORG_BLOCKS[locked!].label}
          </span>
        )}
      </div>

      {/* Bloques */}
      <div style={{ flex: 1, minHeight: 0, display: "flex", gap: 3, borderRadius: 12, overflow: "hidden" }}>
        {BORG_BLOCKS.map((block, i) => {
          const isHov    = hover === i;
          const isThisLk = isLocked && locked === i;
          const isActive = activeIdx === i;
          return (
            <div key={i} style={{
              flex: 1, minWidth: 0,
              background: block.bg,
              filter: isHov ? "brightness(1.18)" : isThisLk ? "brightness(1.05)" : "brightness(1)",
              border: isThisLk ? "3px solid #fbbf24" : isActive ? "2px solid rgba(0,0,0,.35)" : "none",
              borderRadius: 10,
              boxShadow: isThisLk ? "0 0 14px rgba(251,191,36,.7), inset 0 0 6px rgba(251,191,36,.3)" : "none",
              display: "flex", flexDirection: "column",
              alignItems: "center", justifyContent: "space-evenly",
              padding: "4px 2px",
              transition: "filter .15s, border .12s, box-shadow .2s",
              boxSizing: "border-box",
              overflow: "hidden",
            }}>
              {/* Número */}
              <span style={{
                fontFamily: "'Lexend',sans-serif",
                fontWeight: 900,
                fontSize: isActive ? "clamp(1rem,3vw,1.4rem)" : "clamp(.85rem,2.4vw,1.1rem)",
                color: "#333333",
                lineHeight: 1,
                transition: "font-size .18s",
                textShadow: "0 1px 3px rgba(255,255,255,.5)",
              }}>{block.value}</span>
              {/* Cara */}
              <span style={{
                fontSize: isActive ? "clamp(1.1rem,3.2vw,1.5rem)" : "clamp(.9rem,2.5vw,1.2rem)",
                lineHeight: 1,
                transition: "font-size .18s",
              }}>{block.face}</span>
              {/* Etiqueta de texto */}
              <span style={{
                fontFamily: "'Lexend',sans-serif",
                fontWeight: 700,
                fontSize: "clamp(.42rem,1.1vw,.6rem)",
                color: "#333333",
                textAlign: "center",
                lineHeight: 1.2,
                overflow: "hidden",
                maxWidth: "100%",
                display: "-webkit-box",
                WebkitLineClamp: 2,
                WebkitBoxOrient: "vertical",
                textShadow: "0 1px 2px rgba(255,255,255,.4)",
              }}>{block.label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ESCALA 3 — ANSIEDAD: 5 niveles con nombre
// ─────────────────────────────────────────────────────────────────────────────
function AnxietyStrip() {
  const { speak }     = useTTS();
  const stripRef      = useRef<HTMLDivElement>(null);
  const [hover, setHover]   = useState<number | null>(null); // 0-4
  const [locked, setLocked] = useState<number | null>(null);

  const onLock = useCallback((idx: number) => {
    setLocked(idx);
    playBell();
    speak(ANXIETY_LEVELS[idx].tts);
  }, [speak]);

  const { trigger, cancel } = useDwell<number>(onLock);

  const onPointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    const rect = stripRef.current?.getBoundingClientRect();
    if (!rect) return;
    const idx = Math.max(0, Math.min(4, Math.floor((e.clientX - rect.left) / rect.width * 5)));
    setHover(idx);
    trigger(idx);
  }, [trigger]);

  const onPointerLeave = useCallback(() => { cancel(); setHover(null); }, [cancel]);

  const activeIdx = hover ?? locked;
  const isLocked  = locked !== null && hover === null;

  return (
    <div
      ref={stripRef}
      data-gaze-target="true"
      onPointerMove={onPointerMove}
      onPointerLeave={onPointerLeave}
      style={{
        flex: 1, minHeight: 0, borderRadius: 16, cursor: "crosshair",
        touchAction: "none", userSelect: "none",
        border: isLocked ? "3px solid #fbbf24" : "2px solid rgba(0,0,0,0.12)",
        boxShadow: isLocked ? "0 0 22px rgba(251,191,36,0.5)" : "none",
        display: "flex", flexDirection: "column",
        padding: "7px 8px", gap: 4, boxSizing: "border-box",
        background: "#1A1A1A",
        transition: "border-color .2s, box-shadow .2s",
      }}
    >
      {/* Etiqueta */}
      <div style={{ textAlign: "center", fontFamily: "'Lexend',sans-serif", fontWeight: 900, fontSize: "clamp(.6rem,1.4vw,.82rem)", color: "rgba(255,255,255,.85)", letterSpacing: ".18em", textTransform: "uppercase", flexShrink: 0 }}>
        ANSIEDAD
        {isLocked && (
          <span style={{ marginLeft: 10, fontSize: ".6rem", background: "rgba(251,191,36,.35)", color: "#FFD", padding: "1px 8px", borderRadius: 8, fontWeight: 700 }}>
            ✓ {ANXIETY_LEVELS[locked!].label}
          </span>
        )}
      </div>

      {/* 5 bloques */}
      <div style={{ flex: 1, minHeight: 0, display: "flex", gap: 3, borderRadius: 12, overflow: "hidden" }}>
        {ANXIETY_LEVELS.map((level, i) => {
          const isHov    = hover === i;
          const isThisLk = isLocked && locked === i;
          const isActive = activeIdx === i;
          return (
            <div key={i} style={{
              flex: 1, minWidth: 0,
              background: level.bg,
              filter: isHov ? "brightness(1.15)" : isThisLk ? "brightness(1.05)" : "brightness(1)",
              border: isThisLk ? "3px solid #fbbf24" : isActive ? "2px solid rgba(0,0,0,.3)" : "none",
              borderRadius: 10,
              boxShadow: isThisLk ? "0 0 14px rgba(251,191,36,.7), inset 0 0 6px rgba(251,191,36,.3)" : "none",
              display: "flex", flexDirection: "column",
              alignItems: "center", justifyContent: "space-evenly",
              padding: "4px 6px",
              transition: "filter .15s, border .12s, box-shadow .2s",
              boxSizing: "border-box",
            }}>
              {/* Cara */}
              <span style={{
                fontSize: isActive ? "clamp(1.4rem,4.5vw,2rem)" : "clamp(1.1rem,3.5vw,1.6rem)",
                lineHeight: 1,
                transition: "font-size .18s",
              }}>{level.face}</span>
              {/* Nombre */}
              <span style={{
                fontFamily: "'Lexend',sans-serif",
                fontWeight: 900,
                fontSize: isActive ? "clamp(.7rem,2vw,.95rem)" : "clamp(.6rem,1.6vw,.8rem)",
                color: "#333333",
                textAlign: "center",
                lineHeight: 1.2,
                textShadow: "0 1px 3px rgba(255,255,255,.5)",
                transition: "font-size .18s",
              }}>{level.label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PÁGINA
// ─────────────────────────────────────────────────────────────────────────────
export default function Scales() {
  const [resetKey, setResetKey] = useState(0);

  return (
    <FullscreenLayout>
      <div style={{
        display: "flex", flexDirection: "column", height: "100%",
        padding: "10px", gap: "10px", boxSizing: "border-box", background: "#111",
      }}>
        {/* Botón reiniciar */}
        <div style={{ display: "flex", justifyContent: "flex-end", flexShrink: 0 }}>
          <button
            data-gaze-target="true"
            data-testid="button-scale-reset"
            onClick={() => setResetKey((k) => k + 1)}
            style={{
              background: "rgba(255,255,255,.1)", border: "1px solid rgba(255,255,255,.2)",
              borderRadius: 10, color: "rgba(255,255,255,.75)", padding: "5px 13px",
              cursor: "pointer", fontFamily: "'Lexend',sans-serif", fontWeight: 700,
              fontSize: ".7rem", letterSpacing: ".08em", textTransform: "uppercase",
              display: "flex", alignItems: "center", gap: 6,
            }}
          >
            <RotateCcw style={{ width: 12, height: 12 }} />
            Reiniciar escalas
          </button>
        </div>

        <EvaStrip     key={`eva-${resetKey}`}     />
        <BorgStrip    key={`borg-${resetKey}`}    />
        <AnxietyStrip key={`ansiedad-${resetKey}`} />
      </div>
    </FullscreenLayout>
  );
}
