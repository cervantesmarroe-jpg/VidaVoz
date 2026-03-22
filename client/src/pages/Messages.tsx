import { useRef, useCallback, ElementType } from "react";
import { FullscreenLayout } from "@/components/FullscreenLayout";
import { playBell } from "@/lib/audio";
import { useTTS } from "@/hooks/use-tts";
import {
  Thermometer, UtensilsCrossed, MoveHorizontal, Bath,
  Lightbulb, Clock, Users, HeartCrack, Music, Wind,
} from "lucide-react";

const MSG_DWELL_MS = 2000;

// ── Definición de los 10 mensajes ────────────────────────────────────────────
const MSGS = [
  {
    id: "frio-calor",
    label: "TENGO FRÍO / CALOR",
    phrase: "Tengo frío o calor. Por favor regule la temperatura.",
    icon: Thermometer,
    accent: "#93c5fd",
    bg: "rgba(30,42,64,0.95)",
  },
  {
    id: "hambre",
    label: "TENGO HAMBRE",
    phrase: "Tengo hambre. Quisiera comer algo.",
    icon: UtensilsCrossed,
    accent: "#fcd34d",
    bg: "rgba(42,34,16,0.95)",
  },
  {
    id: "posicion",
    label: "CAMBIAR DE POSICIÓN",
    phrase: "Necesito cambiar de posición. Estoy incómodo.",
    icon: MoveHorizontal,
    accent: "#a78bfa",
    bg: "rgba(42,31,61,0.95)",
  },
  {
    id: "wc",
    label: "IR AL WC",
    phrase: "Necesito ir al baño urgentemente.",
    icon: Bath,
    accent: "#5eead4",
    bg: "rgba(22,42,38,0.95)",
  },
  {
    id: "luz",
    label: "LUZ: ENCENDER / APAGAR",
    phrase: "Por favor, encienda o apague la luz.",
    icon: Lightbulb,
    accent: "#fde68a",
    bg: "rgba(40,34,12,0.95)",
  },
  {
    id: "hora",
    label: "¿QUÉ HORA ES?",
    phrase: "¿Qué hora es? ¿Es de día o de noche?",
    icon: Clock,
    accent: "#7dd3fc",
    bg: "rgba(18,30,48,0.95)",
  },
  {
    id: "familia",
    label: "QUIERO VER A MI FAMILIA",
    phrase: "Quiero ver a mi familia. Por favor, déjenles pasar.",
    icon: Users,
    accent: "#fca5a5",
    bg: "rgba(46,22,22,0.95)",
  },
  {
    id: "miedo",
    label: "TENGO MIEDO / NERVIOS",
    phrase: "Tengo miedo. Estoy nervioso. Necesito apoyo.",
    icon: HeartCrack,
    accent: "#a5b4fc",
    bg: "rgba(28,22,52,0.95)",
  },
  {
    id: "musica",
    label: "QUIERO LA RADIO / MÚSICA",
    phrase: "Quiero escuchar música o la radio.",
    icon: Music,
    accent: "#c4b5fd",
    bg: "rgba(38,24,52,0.95)",
  },
  {
    id: "aspiracion",
    label: "NECESITO ASPIRACIÓN",
    phrase: "Necesito aspiración de secreciones. Tengo mocos o flemas.",
    icon: Wind,
    accent: "#86efac",
    bg: "rgba(18,44,26,0.95)",
  },
];

// ── Botón rectangular con dwell 2s y borde dorado ────────────────────────────
interface MsgBtnProps {
  label: string;
  phrase: string;
  icon: ElementType;
  accent: string;
  bg: string;
  id: string;
}

function MessageButton({ label, phrase, icon: Icon, accent, bg, id }: MsgBtnProps) {
  const { speak }   = useTTS();
  const timerRef    = useRef<ReturnType<typeof setTimeout> | null>(null);
  const barRef      = useRef<HTMLDivElement>(null);
  const btnRef      = useRef<HTMLButtonElement>(null);

  const fire = useCallback(() => {
    playBell();
    speak(phrase);
  }, [phrase, speak]);

  const startDwell = useCallback(() => {
    if (timerRef.current) return;
    // Borde dorado
    if (btnRef.current) {
      btnRef.current.style.boxShadow = `0 0 0 2px #fbbf24, 0 0 18px rgba(251,191,36,0.35)`;
    }
    // Barra de progreso
    const bar = barRef.current;
    if (bar) {
      bar.style.transition = "none";
      bar.style.width = "0%";
      void bar.getBoundingClientRect();
      bar.style.transition = `width ${MSG_DWELL_MS}ms linear`;
      bar.style.width = "100%";
    }
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      cancelDwell();
      fire();
    }, MSG_DWELL_MS);
  }, [fire]);

  const cancelDwell = useCallback(() => {
    if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
    if (btnRef.current) btnRef.current.style.boxShadow = "";
    const bar = barRef.current;
    if (bar) { bar.style.transition = "none"; bar.style.width = "0%"; }
  }, []);

  return (
    <button
      ref={btnRef}
      data-gaze-target="true"
      data-testid={`button-msg-${id}`}
      onClick={() => { cancelDwell(); fire(); }}
      onPointerEnter={startDwell}
      onPointerLeave={cancelDwell}
      style={{
        position: "relative",
        display: "flex",
        alignItems: "center",
        gap: "14px",
        padding: "0 18px",
        background: bg,
        border: `1.5px solid ${accent}33`,
        borderRadius: "14px",
        color: "#fff",
        cursor: "pointer",
        userSelect: "none",
        touchAction: "manipulation",
        overflow: "hidden",
        minHeight: "0",
        transition: "border-color 0.15s",
        width: "100%",
      }}
    >
      {/* Shimmer */}
      <div style={{
        position: "absolute", inset: 0, borderRadius: "14px", pointerEvents: "none",
        background: "linear-gradient(to bottom, rgba(255,255,255,0.06) 0%, transparent 40%)",
      }} />

      {/* Acento lateral */}
      <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: "4px", background: accent, borderRadius: "14px 0 0 14px", opacity: 0.8 }} />

      {/* Icon */}
      <Icon style={{ width: "1.7rem", height: "1.7rem", color: accent, flexShrink: 0, position: "relative", zIndex: 1 }} aria-hidden="true" />

      {/* Texto */}
      <span style={{
        fontFamily: "'Lexend', sans-serif",
        fontSize: "clamp(0.75rem, 1.8vw, 1.05rem)",
        fontWeight: 700,
        textTransform: "uppercase",
        letterSpacing: "0.07em",
        textAlign: "left",
        lineHeight: 1.2,
        color: "rgba(255,255,255,0.92)",
        position: "relative",
        zIndex: 1,
      }}>
        {label}
      </span>

      {/* Barra de progreso (dwell) */}
      <div
        ref={barRef}
        style={{
          position: "absolute", bottom: 0, left: 0, height: "3px",
          width: "0%", background: "#fbbf24", borderRadius: "0 0 14px 14px",
        }}
      />
    </button>
  );
}

// ── Página Mensajes ───────────────────────────────────────────────────────────
export default function Messages() {
  return (
    <FullscreenLayout>
      <div style={{
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gridTemplateRows: "repeat(5, 1fr)",
        gap: "10px",
        padding: "10px",
        height: "100%",
        boxSizing: "border-box",
        background: "#111",
        overflowY: "auto",
      }}>
        {MSGS.map((m) => (
          <MessageButton
            key={m.id}
            id={m.id}
            label={m.label}
            phrase={m.phrase}
            icon={m.icon}
            accent={m.accent}
            bg={m.bg}
          />
        ))}
      </div>
    </FullscreenLayout>
  );
}
