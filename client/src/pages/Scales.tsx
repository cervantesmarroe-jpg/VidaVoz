import { useState, useRef, useCallback, useEffect } from "react";
import { FullscreenLayout } from "@/components/FullscreenLayout";
import { playBell } from "@/lib/audio";
import { useTTS } from "@/hooks/use-tts";
import { RotateCcw, Send } from "lucide-react";

const DWELL_MS = 2500;

// ─────────────────────────────────────────────────────────────────────────────
// DATOS
// ─────────────────────────────────────────────────────────────────────────────

const BORG_BLOCKS = [
  { value: 0,  label: "Nada",     face: "😌", bg: "#A8D8F0" },
  { value: 1,  label: "Muy leve", face: "😊", bg: "#82C4EB" },
  { value: 2,  label: "Leve",     face: "🙂", bg: "#5BAEE0" },
  { value: 3,  label: "Moderado", face: "😐", bg: "#7DD4A0" },
  { value: 4,  label: "Algo duro",face: "😐", bg: "#55C47A" },
  { value: 5,  label: "Duro",     face: "😟", bg: "#FFE566" },
  { value: 6,  label: "Duro",     face: "😟", bg: "#FFD01E" },
  { value: 7,  label: "Muy duro", face: "😰", bg: "#FFB347" },
  { value: 8,  label: "Muy duro", face: "😰", bg: "#FF8C42" },
  { value: 9,  label: "Extremo",  face: "😱", bg: "#FF6B6B" },
  { value: 10, label: "Máximo",   face: "😱", bg: "#FF4040" },
] as const;

const ANXIETY_LEVELS = [
  { label: "Tranquilo",   face: "😌", bg: "#6DC98E", tts: "Estoy tranquilo." },
  { label: "Inquieto",    face: "🙂", bg: "#B8E07A", tts: "Me siento inquieto." },
  { label: "Ansioso",     face: "😟", bg: "#FFD166", tts: "Estoy ansioso." },
  { label: "Muy ansioso", face: "😰", bg: "#FF9B54", tts: "Estoy muy ansioso." },
  { label: "Pánico",      face: "😱", bg: "#FF6B6B", tts: "Siento pánico." },
] as const;

// ─────────────────────────────────────────────────────────────────────────────
// HOOK: dwell con progreso RAF (0→1, llama onLock al completar)
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
// ESCALA 1 — EVA (Dolor): gradiente continuo 0-10
// ─────────────────────────────────────────────────────────────────────────────
function EvaStrip({ onLocked }: { onLocked: (v: number | null) => void }) {
  const { speak }  = useTTS();
  const stripRef   = useRef<HTMLDivElement>(null);
  const [hover,  setHover]  = useState<number | null>(null);
  const [locked, setLocked] = useState<number | null>(null);

  const onLock = useCallback((val: number) => {
    setLocked(val); onLocked(val);
    playBell();
    speak(`Mi nivel de dolor es ${val} sobre diez.`);
  }, [speak, onLocked]);

  const progress = useDwellWithProgress(hover, DWELL_MS, onLock);

  const onPointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    const rect = stripRef.current?.getBoundingClientRect();
    if (!rect) return;
    const val = Math.max(0, Math.min(10, Math.round((e.clientX - rect.left) / rect.width * 10)));
    setHover(val);
  }, []);
  const onPointerLeave = useCallback(() => setHover(null), []);

  const active   = hover ?? locked;
  const isLocked = locked !== null && hover === null;

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
        boxShadow: isLocked ? "0 0 22px rgba(251,191,36,0.5)" : "0 1px 4px rgba(0,0,0,0.06)",
        display: "flex", flexDirection: "column",
        justifyContent: "space-between", padding: "7px 12px",
        boxSizing: "border-box", transition: "border-color .2s, box-shadow .2s",
      }}
    >
      {/* Etiqueta */}
      <div style={{ textAlign: "center", fontFamily: "'Lexend',sans-serif", fontWeight: 900, fontSize: "clamp(.6rem,1.4vw,.85rem)", color: "#333", letterSpacing: ".18em", textTransform: "uppercase", textShadow: "0 1px 3px rgba(255,255,255,.65)", flexShrink: 0 }}>
        DOLOR (EVA)
        {isLocked && (
          <span style={{ marginLeft: 10, fontSize: ".6rem", background: "rgba(251,191,36,.35)", color: "#6B4500", padding: "1px 8px", borderRadius: 8, fontWeight: 700 }}>
            ✓ {locked}/10
          </span>
        )}
      </div>

      {/* Fila de caras + números 0-10 */}
      <div style={{ display: "flex", alignItems: "center", flex: 1, minHeight: 0, gap: 6, padding: "4px 0" }}>
        <span style={{ fontSize: "clamp(1.3rem,3.5vw,1.9rem)", flexShrink: 0 }}>😊</span>
        <div style={{ flex: 1, display: "flex", justifyContent: "space-between", alignItems: "center", height: "100%" }}>
          {Array.from({ length: 11 }, (_, i) => i).map((n) => {
            const isSel    = hover === n;
            const isThisLk = isLocked && locked === n;
            const dimmed   = isLocked && locked !== n;
            const sz       = isThisLk ? 46 : isSel ? 40 : 28;
            // Growing gold ring via box-shadow (RAF-driven, no CSS transition)
            const ringPx   = isSel && !isThisLk ? 2 + progress * 5 : 0;
            const ringAlpha = isSel && !isThisLk ? 0.3 + progress * 0.5 : 0;
            return (
              <div key={n} style={{
                width: sz, height: sz, borderRadius: "50%", flexShrink: 0,
                position: "relative",
                background: isThisLk ? "#fbbf24" : isSel ? "rgba(0,0,0,.28)" : "rgba(0,0,0,.14)",
                opacity: dimmed ? 0.38 : 1,
                color: "#333", display: "flex", alignItems: "center", justifyContent: "center",
                fontFamily: "'Lexend',sans-serif",
                fontWeight: isSel || isThisLk ? 900 : 700,
                fontSize: isThisLk ? "clamp(.95rem,2.8vw,1.2rem)" : isSel ? "clamp(.85rem,2.3vw,1.1rem)" : "clamp(.62rem,1.6vw,.82rem)",
                border: isThisLk ? "3px solid #7A4500" : "none",
                boxShadow: isThisLk
                  ? "0 0 14px rgba(251,191,36,.7)"
                  : isSel && ringPx > 0
                  ? `0 0 0 ${ringPx}px rgba(251,191,36,${ringAlpha}), 0 0 ${ringPx * 3}px rgba(251,191,36,${ringAlpha * 0.6})`
                  : "none",
                textShadow: "0 1px 3px rgba(255,255,255,.55)",
                transition: "width .18s, height .18s, opacity .2s, background .14s",
              }}>
                {n}
              </div>
            );
          })}
        </div>
        <span style={{ fontSize: "clamp(1.3rem,3.5vw,1.9rem)", flexShrink: 0 }}>😭</span>
      </div>

      {active === null && (
        <div style={{ textAlign: "center", fontFamily: "'Lexend',sans-serif", fontSize: ".58rem", fontWeight: 600, color: "rgba(51,51,51,.55)", textShadow: "0 1px 2px rgba(255,255,255,.5)", flexShrink: 0 }}>
          Mira un número · 2,5 s para fijar
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ESCALA 2 — BORG (Respiración): 11 bloques discretos coloreados
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
      {/* Etiqueta */}
      <div style={{ textAlign: "center", fontFamily: "'Lexend',sans-serif", fontWeight: 900, fontSize: "clamp(.6rem,1.4vw,.82rem)", color: "#333333", letterSpacing: ".18em", textTransform: "uppercase", flexShrink: 0 }}>
        RESPIRACIÓN (BORG)
        {isLocked && (
          <span style={{ marginLeft: 10, fontSize: ".6rem", background: "rgba(251,191,36,.35)", color: "#6B4C00", padding: "1px 8px", borderRadius: 8, fontWeight: 700 }}>
            ✓ {locked} – {BORG_BLOCKS[locked!].label}
          </span>
        )}
      </div>

      {/* Bloques — sin gap, hitbox completo */}
      <div style={{ flex: 1, minHeight: 0, display: "flex", gap: 2, borderRadius: 10, overflow: "hidden" }}>
        {BORG_BLOCKS.map((block, i) => {
          const isHov    = hover === i;
          const isThisLk = isLocked && locked === i;
          const dimmed   = isLocked && locked !== i;
          // Conic-gradient fill overlay driven by progress
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
              {/* Conic fill overlay (dwell progress) */}
              {isHov && !isThisLk && fillDeg > 0 && (
                <div style={{
                  position: "absolute", inset: 0,
                  background: `conic-gradient(from -90deg, rgba(251,191,36,0.52) ${fillDeg}deg, transparent ${fillDeg}deg)`,
                  pointerEvents: "none", zIndex: 2,
                  borderRadius: "inherit",
                }} />
              )}

              {/* Número */}
              <span style={{
                fontFamily: "'Lexend',sans-serif", fontWeight: 900,
                fontSize: isHov || isThisLk ? "clamp(1rem,3vw,1.4rem)" : "clamp(.85rem,2.4vw,1.1rem)",
                color: "#333333", lineHeight: 1,
                transition: "font-size .18s",
                textShadow: "0 1px 3px rgba(255,255,255,.5)",
                position: "relative", zIndex: 3,
              }}>{block.value}</span>

              {/* Cara */}
              <span style={{
                fontSize: isHov || isThisLk ? "clamp(1.1rem,3.2vw,1.5rem)" : "clamp(.9rem,2.5vw,1.2rem)",
                lineHeight: 1, transition: "font-size .18s",
                position: "relative", zIndex: 3,
              }}>{block.face}</span>

              {/* Etiqueta semántica — siempre legible */}
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
// ESCALA 3 — ANSIEDAD: 5 niveles con nombre
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
      {/* Etiqueta */}
      <div style={{ textAlign: "center", fontFamily: "'Lexend',sans-serif", fontWeight: 900, fontSize: "clamp(.6rem,1.4vw,.82rem)", color: "#333333", letterSpacing: ".18em", textTransform: "uppercase", flexShrink: 0 }}>
        ANSIEDAD
        {isLocked && (
          <span style={{ marginLeft: 10, fontSize: ".6rem", background: "rgba(251,191,36,.35)", color: "#6B4C00", padding: "1px 8px", borderRadius: 8, fontWeight: 700 }}>
            ✓ {ANXIETY_LEVELS[locked!].label}
          </span>
        )}
      </div>

      {/* 5 bloques */}
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
              {/* Conic fill overlay */}
              {isHov && !isThisLk && fillDeg > 0 && (
                <div style={{
                  position: "absolute", inset: 0,
                  background: `conic-gradient(from -90deg, rgba(251,191,36,0.52) ${fillDeg}deg, transparent ${fillDeg}deg)`,
                  pointerEvents: "none", zIndex: 2,
                  borderRadius: "inherit",
                }} />
              )}

              {/* Cara */}
              <span style={{
                fontSize: isHov || isThisLk ? "clamp(1.4rem,4.5vw,2rem)" : "clamp(1.1rem,3.5vw,1.6rem)",
                lineHeight: 1, transition: "font-size .18s",
                position: "relative", zIndex: 3,
              }}>{level.face}</span>

              {/* Nombre */}
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
// BOTÓN ENVIAR VALORES
// ─────────────────────────────────────────────────────────────────────────────
interface EnviarProps {
  evaLocked:     number | null;
  borgLocked:    number | null;
  anxietyLocked: number | null;
}

function EnviarButton({ evaLocked, borgLocked, anxietyLocked }: EnviarProps) {
  const { speak } = useTTS();
  const [hover,  setHover]  = useState<"send" | null>(null);
  const barRef = useRef<HTMLDivElement>(null);

  const onLock = useCallback(() => {
    const parts: string[] = [];
    if (evaLocked !== null)     parts.push(`Dolor ${evaLocked} sobre diez.`);
    if (borgLocked !== null)    parts.push(`Esfuerzo respiratorio ${borgLocked}, ${BORG_BLOCKS[borgLocked].label}.`);
    if (anxietyLocked !== null) parts.push(ANXIETY_LEVELS[anxietyLocked].tts);
    playBell();
    speak(parts.join(" "));
  }, [speak, evaLocked, borgLocked, anxietyLocked]);

  const progress = useDwellWithProgress(hover, DWELL_MS, onLock);

  return (
    <div
      data-gaze-target="true"
      data-testid="button-enviar-valores"
      onPointerEnter={() => setHover("send")}
      onPointerLeave={() => setHover(null)}
      onClick={onLock}
      style={{
        flexShrink: 0,
        height: 60,
        borderRadius: 14,
        background: "#D5F5E3",
        border: hover ? `3px solid #fbbf24` : "1.5px solid #A8E6C8",
        boxShadow: hover
          ? "0 0 18px rgba(251,191,36,0.4)"
          : "0 2px 8px rgba(20,100,50,0.12)",
        display: "flex", alignItems: "center", justifyContent: "center",
        gap: 12, cursor: "pointer", userSelect: "none",
        position: "relative", overflow: "hidden",
        transition: "border .15s, box-shadow .15s",
      }}
    >
      {/* Barra de progreso dorada */}
      <div style={{
        position: "absolute", bottom: 0, left: 0,
        height: 5, width: `${progress * 100}%`,
        background: "linear-gradient(to right, #fbbf24, #f59e0b)",
        transition: "none",
        borderRadius: "0 3px 0 0",
      }} />

      <Send style={{ width: 22, height: 22, color: "#145A30", flexShrink: 0 }} />
      <span style={{
        fontFamily: "'Lexend',sans-serif", fontWeight: 900,
        fontSize: "clamp(.85rem,2.2vw,1.15rem)",
        letterSpacing: ".07em", textTransform: "uppercase",
        color: "#145A30",
      }}>
        Enviar valores
      </span>

      {/* Resumen compacto de valores marcados */}
      <div style={{
        display: "flex", gap: 8, marginLeft: 4,
      }}>
        {evaLocked !== null && (
          <span style={{ background: "rgba(20,90,48,0.15)", borderRadius: 8, padding: "2px 8px", fontSize: ".7rem", fontWeight: 800, color: "#145A30", fontFamily: "'Lexend',sans-serif" }}>
            EVA {evaLocked}/10
          </span>
        )}
        {borgLocked !== null && (
          <span style={{ background: "rgba(20,90,48,0.15)", borderRadius: 8, padding: "2px 8px", fontSize: ".7rem", fontWeight: 800, color: "#145A30", fontFamily: "'Lexend',sans-serif" }}>
            BORG {borgLocked}
          </span>
        )}
        {anxietyLocked !== null && (
          <span style={{ background: "rgba(20,90,48,0.15)", borderRadius: 8, padding: "2px 8px", fontSize: ".7rem", fontWeight: 800, color: "#145A30", fontFamily: "'Lexend',sans-serif" }}>
            {ANXIETY_LEVELS[anxietyLocked].label}
          </span>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PÁGINA
// ─────────────────────────────────────────────────────────────────────────────
export default function Scales() {
  const [resetKey,      setResetKey]      = useState(0);
  const [evaLocked,     setEvaLocked]     = useState<number | null>(null);
  const [borgLocked,    setBorgLocked]    = useState<number | null>(null);
  const [anxietyLocked, setAnxietyLocked] = useState<number | null>(null);

  const anyLocked = evaLocked !== null || borgLocked !== null || anxietyLocked !== null;

  const handleReset = useCallback(() => {
    setResetKey((k) => k + 1);
    setEvaLocked(null);
    setBorgLocked(null);
    setAnxietyLocked(null);
  }, []);

  return (
    <FullscreenLayout>
      <div style={{
        display: "flex", flexDirection: "column", height: "100%",
        padding: "10px", gap: "10px", boxSizing: "border-box", background: "#FAFAFA",
      }}>
        {/* Barra superior: reiniciar */}
        <div style={{ display: "flex", justifyContent: "flex-end", flexShrink: 0 }}>
          <button
            data-gaze-target="true"
            data-testid="button-scale-reset"
            onClick={handleReset}
            style={{
              background: "#FFFFFF", border: "1.5px solid #E0E0E0",
              borderRadius: 10, color: "#555555", padding: "5px 13px",
              cursor: "pointer", fontFamily: "'Lexend',sans-serif", fontWeight: 700,
              fontSize: ".7rem", letterSpacing: ".08em", textTransform: "uppercase",
              display: "flex", alignItems: "center", gap: 6,
              boxShadow: "0 1px 4px rgba(0,0,0,0.07)",
            }}
          >
            <RotateCcw style={{ width: 12, height: 12 }} />
            Reiniciar escalas
          </button>
        </div>

        <EvaStrip     key={`eva-${resetKey}`}     onLocked={setEvaLocked}     />
        <BorgStrip    key={`borg-${resetKey}`}     onLocked={setBorgLocked}    />
        <AnxietyStrip key={`ansiedad-${resetKey}`} onLocked={setAnxietyLocked} />

        {/* Botón ENVIAR — solo visible cuando hay al menos un valor marcado */}
        {anyLocked && (
          <EnviarButton
            evaLocked={evaLocked}
            borgLocked={borgLocked}
            anxietyLocked={anxietyLocked}
          />
        )}
      </div>
    </FullscreenLayout>
  );
}
