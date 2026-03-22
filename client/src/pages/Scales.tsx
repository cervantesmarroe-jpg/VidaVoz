import { useState, useRef, useCallback, ElementType } from "react";
import { FullscreenLayout } from "@/components/FullscreenLayout";
import { useTTS } from "@/hooks/use-tts";
import { playBell } from "@/lib/audio";
import {
  Smile, Angry, Wind, Sun, Zap, AlertCircle,
  ArrowLeft, Send, CheckCircle2, ChevronRight,
} from "lucide-react";

const SCALE_DWELL_MS = 2000;

type ScaleId = "eva" | "borg" | "ansiedad";

interface ScaleDef {
  id: ScaleId;
  label: string;
  fullName: string;
  gradient: string;
  Icon0: ElementType;
  Icon10: ElementType;
  label0: string;
  label10: string;
  phrase: (v: number) => string;
  btnBg: string;
  btnHover: string;
}

const SCALES: ScaleDef[] = [
  {
    id: "eva",
    label: "VALORAR DOLOR (EVA)",
    fullName: "Escala Visual Analógica del Dolor",
    gradient: "linear-gradient(to right, #DDF5E0 0%, #FF9080 100%)",
    Icon0: Smile,
    Icon10: Angry,
    label0: "Sin dolor",
    label10: "Dolor máximo",
    phrase: (v) => `Mi nivel de dolor es ${v} sobre diez.`,
    btnBg: "#F28B6E",
    btnHover: "#E07050",
  },
  {
    id: "borg",
    label: "VALORAR RESPIRACIÓN (BORG)",
    fullName: "Escala de Borg — Disnea",
    gradient: "linear-gradient(to right, #EBF5FB 0%, #A98FCC 100%)",
    Icon0: Wind,
    Icon10: AlertCircle,
    label0: "Respiro bien",
    label10: "Me ahogo",
    phrase: (v) => `Mi nivel de falta de aire es ${v} sobre diez.`,
    btnBg: "#70B8E8",
    btnHover: "#4EA0D8",
  },
  {
    id: "ansiedad",
    label: "VALORAR ANSIEDAD",
    fullName: "Escala de Ansiedad",
    gradient: "linear-gradient(to right, #FDF2E2 0%, #FFB347 100%)",
    Icon0: Sun,
    Icon10: Zap,
    label0: "Tranquilo",
    label10: "Muy ansioso",
    phrase: (v) => `Mi nivel de ansiedad es ${v} sobre diez.`,
    btnBg: "#F2C46E",
    btnHover: "#E0A840",
  },
];

// ── Botón de número individual ────────────────────────────────────────────────
function NumberButton({
  value, selected, onSelect,
}: {
  value: number; selected: boolean; onSelect: (v: number) => void;
}) {
  const timerRef  = useRef<ReturnType<typeof setTimeout> | null>(null);
  const ringRef   = useRef<HTMLDivElement>(null);
  const btnRef    = useRef<HTMLButtonElement>(null);

  const startDwell = useCallback(() => {
    if (timerRef.current) return;
    const ring = ringRef.current;
    if (ring) {
      ring.style.transition = "none";
      ring.style.transform = "scale(1)";
      ring.style.opacity = "1";
      void ring.getBoundingClientRect();
      ring.style.transition = `transform ${SCALE_DWELL_MS}ms linear, opacity ${SCALE_DWELL_MS}ms linear`;
      ring.style.transform = "scale(1.7)";
      ring.style.opacity = "0";
    }
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      cancelDwell();
      playBell();
      onSelect(value);
    }, SCALE_DWELL_MS);
  }, [value, onSelect]);

  const cancelDwell = useCallback(() => {
    if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
    const ring = ringRef.current;
    if (ring) { ring.style.transition = "none"; ring.style.opacity = "0"; ring.style.transform = "scale(1)"; }
  }, []);

  return (
    <button
      ref={btnRef}
      data-gaze-target="true"
      data-testid={`scale-num-${value}`}
      onClick={() => { cancelDwell(); playBell(); onSelect(value); }}
      onPointerEnter={startDwell}
      onPointerLeave={cancelDwell}
      style={{
        position: "relative",
        background: "transparent",
        border: "none",
        cursor: "pointer",
        padding: "6px 2px",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: "3px",
        touchAction: "manipulation",
      }}
    >
      {/* Anillo dwell dorado */}
      <div
        ref={ringRef}
        style={{
          position: "absolute",
          width: 40, height: 40,
          borderRadius: "50%",
          border: "3px solid #fbbf24",
          boxShadow: "0 0 10px rgba(251,191,36,0.7)",
          opacity: 0,
          pointerEvents: "none",
          top: "50%", left: "50%",
          transform: "translate(-50%,-50%) scale(1)",
          marginTop: -2,
        }}
      />

      {/* Círculo del número */}
      <div style={{
        width: selected ? 46 : 34,
        height: selected ? 46 : 34,
        borderRadius: "50%",
        background: selected ? "#333333" : "rgba(0,0,0,0.18)",
        color: selected ? "#ffffff" : "#333333",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontFamily: "'Lexend', sans-serif",
        fontWeight: 900,
        fontSize: selected ? "1.2rem" : "0.85rem",
        transition: "all 0.25s",
        boxShadow: selected ? "0 4px 14px rgba(0,0,0,0.35)" : "none",
        flexShrink: 0,
      }}>
        {value}
      </div>

      {/* Tick mark */}
      <div style={{
        width: 2, height: 8,
        background: "rgba(0,0,0,0.25)",
        borderRadius: 1,
      }} />
    </button>
  );
}

// ── Pantalla de escala ────────────────────────────────────────────────────────
interface ScaleViewProps {
  scale: ScaleDef;
  value: number | null;
  sentValue: number | null;
  onValueSelect: (v: number) => void;
  onSend: (v: number) => void;
  onBack: () => void;
}

function ScaleView({ scale, value, sentValue, onValueSelect, onSend, onBack }: ScaleViewProps) {
  const { speak } = useTTS();

  const handleSend = () => {
    if (value === null) return;
    playBell();
    speak(scale.phrase(value));
    onSend(value);
  };

  const { Icon0, Icon10 } = scale;

  return (
    <div style={{
      display: "flex", flexDirection: "column",
      height: "100%", background: "#111",
      padding: "10px", gap: "10px", boxSizing: "border-box",
    }}>

      {/* Cabecera */}
      <div style={{ display: "flex", alignItems: "center", gap: "10px", flexShrink: 0 }}>
        <button
          data-gaze-target="true"
          data-testid="button-scale-back"
          onClick={onBack}
          style={{
            background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.2)",
            borderRadius: "10px", color: "#fff", padding: "8px 14px",
            cursor: "pointer", fontFamily: "'Lexend',sans-serif", fontWeight: 700,
            display: "flex", alignItems: "center", gap: "6px", fontSize: "0.85rem",
            flexShrink: 0,
          }}
        >
          <ArrowLeft style={{ width: 16, height: 16 }} /> Volver
        </button>
        <span style={{
          color: "rgba(255,255,255,0.55)", fontFamily: "'Lexend',sans-serif",
          fontWeight: 700, fontSize: "0.75rem", textTransform: "uppercase",
          letterSpacing: "0.12em",
        }}>
          {scale.fullName}
        </span>
      </div>

      {/* Bloque de escala con gradiente */}
      <div style={{
        flex: 1, borderRadius: "20px", background: scale.gradient,
        padding: "16px 14px", display: "flex", flexDirection: "column",
        justifyContent: "space-between", gap: "10px", boxSizing: "border-box",
        minHeight: 0,
      }}>

        {/* Valor actual */}
        <div style={{ textAlign: "center", flexShrink: 0 }}>
          {value !== null ? (
            <div style={{ fontFamily: "'Lexend',sans-serif", lineHeight: 1 }}>
              <span style={{ fontSize: "clamp(2.5rem,8vw,4rem)", fontWeight: 900, color: "#333333" }}>{value}</span>
              <span style={{ fontSize: "1rem", fontWeight: 600, color: "#555" }}> / 10</span>
            </div>
          ) : (
            <p style={{
              fontFamily: "'Lexend',sans-serif", fontSize: "0.85rem",
              color: "rgba(51,51,51,0.65)", fontWeight: 600,
              margin: 0, padding: "6px 0",
            }}>
              Mira el número durante 2 segundos para marcarlo
            </p>
          )}
        </div>

        {/* Fila de números con extremos */}
        <div style={{ display: "flex", alignItems: "center", gap: "6px", flex: 1, minHeight: 0, alignContent: "center" }}>

          {/* Extremo izquierdo */}
          <div style={{
            display: "flex", flexDirection: "column", alignItems: "center",
            gap: "4px", minWidth: "48px", flexShrink: 0,
          }}>
            <Icon0 style={{ width: 32, height: 32, color: "#333333", strokeWidth: 1.8 }} />
            <span style={{
              fontFamily: "'Lexend',sans-serif", fontSize: "0.55rem",
              fontWeight: 700, color: "#333333", textAlign: "center",
              textTransform: "uppercase", lineHeight: 1.2,
            }}>
              {scale.label0}
            </span>
          </div>

          {/* Barra con números */}
          <div style={{
            flex: 1, display: "flex", justifyContent: "space-between",
            alignItems: "center",
          }}>
            {Array.from({ length: 11 }, (_, i) => (
              <NumberButton
                key={i}
                value={i}
                selected={value === i}
                onSelect={onValueSelect}
              />
            ))}
          </div>

          {/* Extremo derecho */}
          <div style={{
            display: "flex", flexDirection: "column", alignItems: "center",
            gap: "4px", minWidth: "48px", flexShrink: 0,
          }}>
            <Icon10 style={{ width: 32, height: 32, color: "#333333", strokeWidth: 1.8 }} />
            <span style={{
              fontFamily: "'Lexend',sans-serif", fontSize: "0.55rem",
              fontWeight: 700, color: "#333333", textAlign: "center",
              textTransform: "uppercase", lineHeight: 1.2,
            }}>
              {scale.label10}
            </span>
          </div>
        </div>

        {/* Confirmación y botón enviar */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "8px", flexShrink: 0 }}>
          {sentValue !== null && (
            <div style={{
              fontFamily: "'Lexend',sans-serif", fontSize: "0.85rem",
              fontWeight: 700, color: "#1a5e2e",
              background: "rgba(34,197,94,0.2)", border: "1px solid rgba(34,197,94,0.4)",
              padding: "6px 18px", borderRadius: "20px",
              display: "flex", alignItems: "center", gap: "8px",
            }}>
              <CheckCircle2 style={{ width: 17, height: 17 }} />
              Valor registrado: {sentValue}/10
            </div>
          )}

          <button
            data-gaze-target="true"
            data-testid="button-scale-send"
            onClick={handleSend}
            disabled={value === null}
            style={{
              background: value !== null ? "#333333" : "rgba(0,0,0,0.18)",
              color: value !== null ? "#ffffff" : "rgba(51,51,51,0.4)",
              border: "none", borderRadius: "14px",
              padding: "12px 28px",
              fontFamily: "'Lexend',sans-serif",
              fontWeight: 800, fontSize: "0.95rem",
              letterSpacing: "0.07em", textTransform: "uppercase",
              cursor: value !== null ? "pointer" : "not-allowed",
              display: "flex", alignItems: "center", gap: "10px",
              transition: "all 0.2s",
              boxShadow: value !== null ? "0 4px 14px rgba(0,0,0,0.25)" : "none",
            }}
          >
            <Send style={{ width: 17, height: 17 }} />
            ENVIAR A ENFERMERÍA
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Botón de menú ─────────────────────────────────────────────────────────────
function MenuButton({
  scale, sentValue, onClick,
}: {
  scale: ScaleDef; sentValue: number | null; onClick: () => void;
}) {
  const btnRef  = useRef<HTMLButtonElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const startDwell = useCallback(() => {
    if (timerRef.current) return;
    if (btnRef.current) btnRef.current.style.background = scale.btnHover;
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      cancelDwell();
      onClick();
    }, 1500);
  }, [onClick, scale.btnHover]);

  const cancelDwell = useCallback(() => {
    if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
    if (btnRef.current) btnRef.current.style.background = scale.btnBg;
  }, [scale.btnBg]);

  return (
    <button
      ref={btnRef}
      data-gaze-target="true"
      data-testid={`button-scale-menu-${scale.id}`}
      onClick={onClick}
      onPointerEnter={startDwell}
      onPointerLeave={cancelDwell}
      style={{
        flex: 1, width: "100%",
        background: scale.btnBg,
        border: "none", borderRadius: "16px",
        color: "#333333", cursor: "pointer",
        display: "flex", alignItems: "center",
        justifyContent: "space-between",
        padding: "0 20px",
        fontFamily: "'Lexend',sans-serif",
        fontWeight: 800,
        fontSize: "clamp(0.85rem, 2.2vw, 1.25rem)",
        letterSpacing: "0.04em",
        textTransform: "uppercase",
        transition: "background 0.2s",
        gap: "12px",
      }}
    >
      <span style={{ textAlign: "left", flex: 1 }}>{scale.label}</span>

      {sentValue !== null && (
        <span style={{
          fontSize: "0.8rem", fontWeight: 700,
          background: "rgba(0,0,0,0.15)", padding: "4px 12px",
          borderRadius: "20px", whiteSpace: "nowrap",
        }}>
          ✓ {sentValue}/10
        </span>
      )}

      <ChevronRight style={{ width: 22, height: 22, flexShrink: 0 }} />
    </button>
  );
}

// ── Página principal ──────────────────────────────────────────────────────────
export default function Scales() {
  const [activeScale, setActiveScale] = useState<ScaleId | null>(null);
  const [values, setValues]     = useState<Record<ScaleId, number | null>>({ eva: null, borg: null, ansiedad: null });
  const [sentValues, setSentValues] = useState<Record<ScaleId, number | null>>({ eva: null, borg: null, ansiedad: null });

  const scale = activeScale ? SCALES.find((s) => s.id === activeScale)! : null;

  const handleValueSelect = useCallback((v: number) => {
    if (!activeScale) return;
    setValues((prev) => ({ ...prev, [activeScale]: v }));
  }, [activeScale]);

  const handleSend = useCallback((v: number) => {
    if (!activeScale) return;
    setSentValues((prev) => ({ ...prev, [activeScale]: v }));
  }, [activeScale]);

  return (
    <FullscreenLayout>
      {scale === null ? (
        /* ── Menú de selección ── */
        <div style={{
          display: "flex", flexDirection: "column",
          gap: "10px", padding: "10px",
          height: "100%", background: "#111",
          boxSizing: "border-box",
        }}>
          <div style={{
            color: "rgba(255,255,255,0.4)",
            fontFamily: "'Lexend',sans-serif",
            fontSize: "0.7rem", fontWeight: 700,
            letterSpacing: "0.18em", textTransform: "uppercase",
            textAlign: "center", paddingBottom: "2px",
          }}>
            VALORACIÓN CLÍNICA DEL PACIENTE
          </div>
          {SCALES.map((s) => (
            <MenuButton
              key={s.id}
              scale={s}
              sentValue={sentValues[s.id]}
              onClick={() => setActiveScale(s.id)}
            />
          ))}
        </div>
      ) : (
        /* ── Vista de escala ── */
        <ScaleView
          scale={scale}
          value={values[scale.id]}
          sentValue={sentValues[scale.id]}
          onValueSelect={handleValueSelect}
          onSend={handleSend}
          onBack={() => setActiveScale(null)}
        />
      )}
    </FullscreenLayout>
  );
}
