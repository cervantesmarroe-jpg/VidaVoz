import { useRef, useCallback, ElementType } from "react";
import { FullscreenLayout } from "@/components/FullscreenLayout";
import { playBell } from "@/lib/audio";
import { useTTS } from "@/hooks/use-tts";
import {
  TempColor, HungerColor, PositionColor, ToiletColor,
  LightColor, ClockColor, FamilyColor, FearColor, MusicColor, SuctionColor,
} from "@/components/icons/ColorIcons";

const MSG_DWELL_MS = 3000;

// Paleta pastel soft — colores alineados con la nueva estética higiénica
// Salmón:  #FDDEDE  accent #B03060
// Verde:   #D5F5E3  accent #145A30
// Ámbar:   #FEEFDC  accent #7A4200
// Amarillo:#FCF3CF  accent #6B4C00

const MSGS: {
  id: string; label: string; phrase: string;
  icon: ElementType; bg: string; bgHover: string; accent: string;
}[] = [
  // Fila 1 ─────────────────────────────────────────────────────────
  {
    id: "familia", label: "QUIERO VER A MI FAMILIA",
    phrase: "Quiero ver a mi familia. Por favor, déjenles pasar.",
    icon: FamilyColor,
    bg: "#FDDEDE", bgHover: "#F5C8C8", accent: "#B03060",
  },
  {
    id: "wc", label: "IR AL WC",
    phrase: "Necesito ir al baño urgentemente.",
    icon: ToiletColor,
    bg: "#D5F5E3", bgHover: "#B8EDD1", accent: "#145A30",
  },
  // Fila 2 ─────────────────────────────────────────────────────────
  {
    id: "frio-calor", label: "TENGO FRÍO / CALOR",
    phrase: "Tengo frío o calor. Por favor regule la temperatura.",
    icon: TempColor,
    bg: "#FEEFDC", bgHover: "#F9DFB8", accent: "#7A4200",
  },
  {
    id: "miedo", label: "TENGO MIEDO / NERVIOS",
    phrase: "Tengo miedo. Estoy nervioso. Necesito apoyo.",
    icon: FearColor,
    bg: "#FDDEDE", bgHover: "#F5C8C8", accent: "#B03060",
  },
  // Fila 3 ─────────────────────────────────────────────────────────
  {
    id: "hambre", label: "TENGO HAMBRE",
    phrase: "Tengo hambre. Quisiera comer algo.",
    icon: HungerColor,
    bg: "#FCF3CF", bgHover: "#F7E89E", accent: "#6B4C00",
  },
  {
    id: "luz", label: "LUZ: ENCENDER / APAGAR",
    phrase: "Por favor, encienda o apague la luz.",
    icon: LightColor,
    bg: "#FEEFDC", bgHover: "#F9DFB8", accent: "#7A4200",
  },
  // Fila 4 ─────────────────────────────────────────────────────────
  {
    id: "aspiracion", label: "NECESITO ASPIRACIÓN",
    phrase: "Necesito aspiración de secreciones. Tengo mocos o flemas.",
    icon: SuctionColor,
    bg: "#D5F5E3", bgHover: "#B8EDD1", accent: "#145A30",
  },
  {
    id: "posicion", label: "CAMBIAR DE POSICIÓN",
    phrase: "Necesito cambiar de posición. Estoy incómodo.",
    icon: PositionColor,
    bg: "#FCF3CF", bgHover: "#F7E89E", accent: "#6B4C00",
  },
  // Fila 5 ─────────────────────────────────────────────────────────
  {
    id: "musica", label: "QUIERO LA RADIO / MÚSICA",
    phrase: "Quiero escuchar música o la radio.",
    icon: MusicColor,
    bg: "#FDDEDE", bgHover: "#F5C8C8", accent: "#B03060",
  },
  {
    id: "hora", label: "¿QUÉ HORA ES?",
    phrase: "¿Qué hora es? ¿Es de día o de noche?",
    icon: ClockColor,
    bg: "#FEEFDC", bgHover: "#F9DFB8", accent: "#7A4200",
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
      btnRef.current.style.boxShadow  = `0 0 0 2.5px #fbbf24, 0 4px 14px rgba(251,191,36,0.22)`;
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
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: "4px",
        padding: "8px 8px 10px",
        background: bg,
        border: `1.5px solid #E0E0E0`,
        borderLeft: `5px solid ${accent}`,
        borderRadius: "14px",
        color: "#333333",
        cursor: "pointer",
        userSelect: "none",
        touchAction: "manipulation",
        overflow: "hidden",
        minHeight: "0",
        width: "100%",
        height: "100%",
        transition: "background 0.18s",
        boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
      }}
    >
      {/* Icon — wrapper flex:1 ocupa todo el alto sobrante */}
      <div style={{
        flex: 1,
        width: "100%",
        minHeight: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}>
        <Icon style={{
          width: "auto",
          height: "100%",
          maxWidth: "100%",
          maxHeight: "12rem",
          minHeight: "2.6rem",
          color: accent,
          strokeWidth: 2,
          filter: "drop-shadow(0 2px 5px rgba(0,0,0,0.15))",
        }} aria-hidden="true" />
      </div>

      {/* Label */}
      <span style={{
        fontFamily: "'Lexend', sans-serif",
        fontSize: "clamp(0.85rem, 1.9vw, 1.15rem)",
        fontWeight: 800,
        textTransform: "uppercase",
        letterSpacing: "0.04em",
        textAlign: "center",
        lineHeight: 1.2,
        color: "#1A1A1A",
        width: "100%",
        marginTop: "4px",
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
      <div className="msg-grid-container" style={{
        gap: "8px",
        padding: "10px",
        height: "100%",
        boxSizing: "border-box",
        background: "#FAFAFA",
        overflowY: "auto",
      }}>
        {MSGS.map((m) => (
          <MessageButton key={m.id} {...m} />
        ))}
      </div>
    </FullscreenLayout>
  );
}
