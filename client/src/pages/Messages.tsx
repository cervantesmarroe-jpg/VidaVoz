import { useRef, useCallback, ElementType } from "react";
import { FullscreenLayout } from "@/components/FullscreenLayout";
import { playBell } from "@/lib/audio";
import { useTTS } from "@/hooks/use-tts";
import {
  Thermometer, UtensilsCrossed, MoveHorizontal, Bath,
  Lightbulb, Clock, Users, HeartCrack, Music, Wind,
} from "lucide-react";

const MSG_DWELL_MS = 2000;

// ── Paleta por grupos ────────────────────────────────────────────────────────
// Ambiente:  Crema Tostado  #FDF2E2  → hover #F0D9B5  accent #B8865A
// Físico:    Amarillo Past  #FEF9E7  → hover #FDF0C4  accent #B8980A
// Higiene:   Verde Menta    #DDF5E0  → hover #B8E8BD  accent #27AE60
// Emocional: Rosa Palo      #FCECEC  → hover #F5CCCC  accent #C0647A
// Text & icons: #333333

const MSGS: {
  id: string; label: string; phrase: string;
  icon: ElementType; bg: string; bgHover: string; accent: string;
}[] = [
  // ─ Ambiente ─────────────────────────────────────────────────────
  {
    id: "frio-calor", label: "TENGO FRÍO / CALOR",
    phrase: "Tengo frío o calor. Por favor regule la temperatura.",
    icon: Thermometer,
    bg: "#FDF2E2", bgHover: "#F0D9B5", accent: "#B8865A",
  },
  {
    id: "luz", label: "LUZ: ENCENDER / APAGAR",
    phrase: "Por favor, encienda o apague la luz.",
    icon: Lightbulb,
    bg: "#FDF2E2", bgHover: "#F0D9B5", accent: "#B8865A",
  },
  // ─ Físico ────────────────────────────────────────────────────────
  {
    id: "hambre", label: "TENGO HAMBRE",
    phrase: "Tengo hambre. Quisiera comer algo.",
    icon: UtensilsCrossed,
    bg: "#FEF9E7", bgHover: "#FDF0C4", accent: "#B8980A",
  },
  {
    id: "posicion", label: "CAMBIAR DE POSICIÓN",
    phrase: "Necesito cambiar de posición. Estoy incómodo.",
    icon: MoveHorizontal,
    bg: "#FEF9E7", bgHover: "#FDF0C4", accent: "#B8980A",
  },
  // ─ Higiene ───────────────────────────────────────────────────────
  {
    id: "wc", label: "IR AL WC",
    phrase: "Necesito ir al baño urgentemente.",
    icon: Bath,
    bg: "#DDF5E0", bgHover: "#B8E8BD", accent: "#27AE60",
  },
  {
    id: "hora", label: "¿QUÉ HORA ES?",
    phrase: "¿Qué hora es? ¿Es de día o de noche?",
    icon: Clock,
    bg: "#FDF2E2", bgHover: "#F0D9B5", accent: "#B8865A",
  },
  // ─ Emocional ─────────────────────────────────────────────────────
  {
    id: "familia", label: "QUIERO VER A MI FAMILIA",
    phrase: "Quiero ver a mi familia. Por favor, déjenles pasar.",
    icon: Users,
    bg: "#FCECEC", bgHover: "#F5CCCC", accent: "#C0647A",
  },
  {
    id: "miedo", label: "TENGO MIEDO / NERVIOS",
    phrase: "Tengo miedo. Estoy nervioso. Necesito apoyo.",
    icon: HeartCrack,
    bg: "#FCECEC", bgHover: "#F5CCCC", accent: "#C0647A",
  },
  // ─ Higiene (cont.) ───────────────────────────────────────────────
  {
    id: "musica", label: "QUIERO LA RADIO / MÚSICA",
    phrase: "Quiero escuchar música o la radio.",
    icon: Music,
    bg: "#FCECEC", bgHover: "#F5CCCC", accent: "#C0647A",
  },
  {
    id: "aspiracion", label: "NECESITO ASPIRACIÓN",
    phrase: "Necesito aspiración de secreciones. Tengo mocos o flemas.",
    icon: Wind,
    bg: "#DDF5E0", bgHover: "#B8E8BD", accent: "#27AE60",
  },
];

// ── Botón rectangular pastel ──────────────────────────────────────────────────
interface MsgBtnProps {
  id: string; label: string; phrase: string;
  icon: ElementType; bg: string; bgHover: string; accent: string;
}

function MessageButton({ id, label, phrase, icon: Icon, bg, bgHover, accent }: MsgBtnProps) {
  const { speak }  = useTTS();
  const timerRef   = useRef<ReturnType<typeof setTimeout> | null>(null);
  const barRef     = useRef<HTMLDivElement>(null);
  const btnRef     = useRef<HTMLButtonElement>(null);

  const fire = useCallback(() => {
    playBell(); speak(phrase);
  }, [phrase, speak]);

  const startDwell = useCallback(() => {
    if (timerRef.current) return;
    if (btnRef.current) {
      btnRef.current.style.background = bgHover;
      btnRef.current.style.boxShadow  = "0 0 0 2.5px #fbbf24, 0 4px 18px rgba(251,191,36,0.28)";
    }
    const bar = barRef.current;
    if (bar) {
      bar.style.transition = "none"; bar.style.width = "0%";
      void bar.getBoundingClientRect();
      bar.style.transition = `width ${MSG_DWELL_MS}ms linear`;
      bar.style.width = "100%";
    }
    timerRef.current = setTimeout(() => {
      timerRef.current = null; cancelDwell(); fire();
    }, MSG_DWELL_MS);
  }, [bg, bgHover, fire]);

  const cancelDwell = useCallback(() => {
    if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
    if (btnRef.current) {
      btnRef.current.style.background = bg;
      btnRef.current.style.boxShadow  = "";
    }
    const bar = barRef.current;
    if (bar) { bar.style.transition = "none"; bar.style.width = "0%"; }
  }, [bg]);

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
        padding: "0 16px",
        background: bg,
        border: `1.5px solid ${accent}55`,
        borderRadius: "14px",
        color: "#333333",
        cursor: "pointer",
        userSelect: "none",
        touchAction: "manipulation",
        overflow: "hidden",
        minHeight: "0",
        width: "100%",
        transition: "background 0.18s",
      }}
    >
      {/* Acento lateral */}
      <div style={{
        position: "absolute", left: 0, top: 0, bottom: 0,
        width: "5px", background: accent, borderRadius: "14px 0 0 14px",
      }} />

      {/* Icon */}
      <Icon style={{
        width: "1.6rem", height: "1.6rem",
        color: accent, flexShrink: 0,
        position: "relative", zIndex: 1,
        strokeWidth: 2,
      }} aria-hidden="true" />

      {/* Label */}
      <span style={{
        fontFamily: "'Lexend', sans-serif",
        fontSize: "clamp(0.68rem, 1.7vw, 1rem)",
        fontWeight: 700,
        textTransform: "uppercase",
        letterSpacing: "0.06em",
        textAlign: "left",
        lineHeight: 1.25,
        color: "#333333",
        position: "relative",
        zIndex: 1,
      }}>
        {label}
      </span>

      {/* Barra dwell dorada */}
      <div
        ref={barRef}
        style={{
          position: "absolute", bottom: 0, left: 0,
          height: "3.5px", width: "0%",
          background: "#fbbf24",
          borderRadius: "0 0 14px 14px",
        }}
      />
    </button>
  );
}

// ── Página ───────────────────────────────────────────────────────────────────
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
          <MessageButton key={m.id} {...m} />
        ))}
      </div>
    </FullscreenLayout>
  );
}
