import { useRef, useCallback, useState, useEffect, ElementType } from "react";
import { FullscreenLayout } from "@/components/FullscreenLayout";
import { playBell } from "@/lib/audio";
import { useTTS } from "@/hooks/use-tts";
import {
  TempColor, HungerColor, PositionColor, ToiletColor,
  LightColor, ClockColor, FamilyColor, FearColor, MusicColor, SuctionColor,
  HygieneColor, CalendarColor, VisitsColor,
} from "@/components/icons/ColorIcons";

import { DWELL_MS as MSG_DWELL_MS } from "@/lib/dwell";

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
  // Fila 6 ─────────────────────────────────────────────────────────
  {
    id: "aseo", label: "ME GUSTARÍA ASEARME",
    phrase: "Me gustaría asearme. Necesito lavarme la cara o el cuerpo.",
    icon: HygieneColor,
    bg: "#D5F5E3", bgHover: "#B8EDD1", accent: "#145A30",
  },
  {
    id: "dia", label: "¿QUÉ DÍA ES HOY?",
    phrase: "¿Qué día es hoy? ¿En qué fecha estamos?",
    icon: CalendarColor,
    bg: "#FCF3CF", bgHover: "#F7E89E", accent: "#6B4C00",
  },
  {
    id: "visitas", label: "¿CUÁL ES EL HORARIO DE VISITAS?",
    phrase: "¿Cuál es el horario de visitas? ¿Cuándo puede venir mi familia?",
    icon: VisitsColor,
    bg: "#FDDEDE", bgHover: "#F5C8C8", accent: "#B03060",
  },
];

const PAGE_SIZE = 6;

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
    // El temporizador interno sólo pinta el progreso visual. La
    // activación (y el TTS) sucede únicamente en onClick — disparado
    // por un tap táctil real o por el .click() sintético del tracker
    // de mirada al completar su propio dwell. Así el mensaje no se
    // pronuncia antes de que la acción se confirme realmente.
    timerRef.current = setTimeout(() => {
      timerRef.current = null; cancelDwell();
    }, MSG_DWELL_MS);
  }, [bg, bgHover]);

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
      className="gaze-target"
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
      <span className="msg-btn-label" style={{
        fontFamily: "'Lexend', sans-serif",
        fontSize: "clamp(1.05rem, 2.4vw, 1.5rem)",
        fontWeight: 800,
        textTransform: "uppercase",
        letterSpacing: "0.04em",
        textAlign: "center",
        lineHeight: 1.2,
        color: "#1A1A1A",
        width: "100%",
        marginTop: "4px",
        overflowWrap: "break-word",
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

// ── Botón de navegación de página ─────────────────────────────────────────────
function NavArrowButton({ page, totalPages, onNext, width = 108 }: {
  page: number; totalPages: number; onNext: () => void; width?: number;
}) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const barRef   = useRef<HTMLDivElement>(null);
  const btnRef   = useRef<HTMLButtonElement>(null);

  const startDwell = useCallback(() => {
    if (timerRef.current) return;
    if (btnRef.current) {
      btnRef.current.style.background = "#BAE6FD";
      btnRef.current.style.boxShadow  = "0 0 0 2.5px #fbbf24, 0 4px 14px rgba(251,191,36,0.22)";
    }
    const bar = barRef.current;
    if (bar) {
      bar.style.transition = "none"; bar.style.width = "0%";
      void bar.getBoundingClientRect();
      bar.style.transition = `width ${MSG_DWELL_MS}ms linear`;
      bar.style.width = "100%";
    }
    timerRef.current = setTimeout(() => {
      timerRef.current = null; cancelDwell();
    }, MSG_DWELL_MS);
  }, []);

  const cancelDwell = useCallback(() => {
    if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
    if (btnRef.current) {
      btnRef.current.style.background = "#E0F2FE";
      btnRef.current.style.boxShadow  = "";
    }
    const bar = barRef.current;
    if (bar) { bar.style.transition = "none"; bar.style.width = "0%"; }
  }, []);

  return (
    <button
      ref={btnRef}
      className="gaze-target"
      data-gaze-target="true"
      onClick={() => { cancelDwell(); onNext(); }}
      onPointerEnter={startDwell}
      onPointerLeave={cancelDwell}
      aria-label={`Página ${page + 1} de ${totalPages}. Ir a la siguiente`}
      style={{
        position: "relative",
        width: `${width}px`,
        flexShrink: 0,
        height: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: "14px",
        background: "#E0F2FE",
        border: "1.5px solid #BAE6FD",
        borderLeft: "6px solid #0EA5E9",
        borderRadius: "16px",
        cursor: "pointer",
        userSelect: "none",
        touchAction: "manipulation",
        overflow: "hidden",
        padding: "16px 6px",
        transition: "background 0.18s",
        boxShadow: "0 2px 8px rgba(14,165,233,0.12)",
      }}
    >
      {/* Indicador de página: puntos */}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "7px" }}>
        {Array.from({ length: totalPages }, (_, i) => (
          <div key={i} style={{
            width: "11px", height: "11px", borderRadius: "50%",
            background: i === page ? "#0369A1" : "#BAE6FD",
            transition: "background 0.2s",
          }} />
        ))}
      </div>

      {/* Chevron derecho — grande y visible */}
      <svg width="52" height="52" viewBox="0 0 24 24" fill="none"
        stroke="#0369A1" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
        aria-hidden="true">
        <polyline points="9 18 15 12 9 6" />
      </svg>

      {/* Etiqueta vertical */}
      <span style={{
        fontFamily: "'Lexend', sans-serif",
        fontSize: "0.72rem",
        fontWeight: 800,
        color: "#0369A1",
        textTransform: "uppercase",
        letterSpacing: "0.08em",
        writingMode: "vertical-rl",
        textOrientation: "mixed",
        transform: "rotate(180deg)",
      }}>
        PÁGINA
      </span>

      {/* Barra dwell dorada */}
      <div ref={barRef} style={{
        position: "absolute", bottom: 0, left: 0,
        height: "3.5px", width: "0%",
        background: "#fbbf24",
        borderRadius: "0 0 16px 16px",
      }} />
    </button>
  );
}

// ── Detección de orientación y tamaño ────────────────────────────────────────
function useIsLandscape() {
  const [landscape, setLandscape] = useState(
    () => typeof window !== "undefined" && window.matchMedia("(orientation: landscape)").matches
  );
  useEffect(() => {
    const mq = window.matchMedia("(orientation: landscape)");
    const handler = (e: MediaQueryListEvent) => setLandscape(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);
  return landscape;
}

function useIsMobile() {
  const [mobile, setMobile] = useState(
    () => typeof window !== "undefined" && window.innerWidth < 768,
  );
  useEffect(() => {
    const update = () => setMobile(window.innerWidth < 768);
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);
  return mobile;
}

// ── Botón de paginación inferior (solo móvil) ─────────────────────────────────
function MobilePageButton({ page, totalPages, onNext }: {
  page: number; totalPages: number; onNext: () => void;
}) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const barRef   = useRef<HTMLDivElement>(null);
  const btnRef   = useRef<HTMLButtonElement>(null);

  const startDwell = useCallback(() => {
    if (timerRef.current) return;
    if (btnRef.current) {
      btnRef.current.style.background = "#BAE6FD";
      btnRef.current.style.boxShadow  = "0 0 0 2.5px #fbbf24, 0 4px 14px rgba(251,191,36,0.22)";
    }
    const bar = barRef.current;
    if (bar) {
      bar.style.transition = "none"; bar.style.width = "0%";
      void bar.getBoundingClientRect();
      bar.style.transition = `width ${MSG_DWELL_MS}ms linear`;
      bar.style.width = "100%";
    }
    timerRef.current = setTimeout(() => { timerRef.current = null; cancelDwell(); }, MSG_DWELL_MS);
  }, []);

  const cancelDwell = useCallback(() => {
    if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
    if (btnRef.current) {
      btnRef.current.style.background = "#E0F2FE";
      btnRef.current.style.boxShadow  = "0 2px 6px rgba(14,165,233,0.12)";
    }
    const bar = barRef.current;
    if (bar) { bar.style.transition = "none"; bar.style.width = "0%"; }
  }, []);

  return (
    <button
      ref={btnRef}
      className="gaze-target"
      data-gaze-target="true"
      onClick={() => { cancelDwell(); onNext(); }}
      onPointerEnter={startDwell}
      onPointerLeave={cancelDwell}
      aria-label={`Página ${page + 1} de ${totalPages}. Siguiente`}
      style={{
        position: "relative",
        flexShrink: 0,
        alignSelf: "center",
        height: "46px",
        display: "flex",
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: "8px",
        background: "#E0F2FE",
        border: "1.5px solid #BAE6FD",
        borderRadius: "23px",
        padding: "0 20px",
        cursor: "pointer",
        userSelect: "none",
        touchAction: "manipulation",
        overflow: "hidden",
        boxShadow: "0 2px 6px rgba(14,165,233,0.12)",
        transition: "background 0.18s, box-shadow 0.18s",
      }}
    >
      {/* Puntos de página */}
      <div style={{ display: "flex", gap: "5px", alignItems: "center" }}>
        {Array.from({ length: totalPages }, (_, i) => (
          <div key={i} style={{
            width: "7px", height: "7px", borderRadius: "50%",
            background: i === page ? "#0369A1" : "#93C5FD",
            flexShrink: 0,
            transition: "background 0.2s",
          }} />
        ))}
      </div>

      {/* Separador */}
      <div style={{ width: "1px", height: "18px", background: "#BAE6FD", flexShrink: 0 }} />

      {/* Etiqueta + chevron */}
      <div style={{ display: "flex", alignItems: "center", gap: "3px" }}>
        <span style={{
          fontFamily: "'Lexend', sans-serif",
          fontSize: "0.64rem",
          fontWeight: 800,
          color: "#0369A1",
          textTransform: "uppercase",
          letterSpacing: "0.07em",
        }}>SIGUIENTE</span>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
          stroke="#0369A1" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
          aria-hidden="true">
          <polyline points="9 18 15 12 9 6" />
        </svg>
      </div>

      {/* Barra dwell */}
      <div ref={barRef} style={{
        position: "absolute", bottom: 0, left: 0,
        height: "3px", width: "0%",
        background: "#fbbf24",
        borderRadius: "0 0 23px 23px",
      }} />
    </button>
  );
}

// ── Página ───────────────────────────────────────────────────────────────────
export default function Messages() {
  const [page, setPage] = useState(0);
  const totalPages  = Math.ceil(MSGS.length / PAGE_SIZE);
  const visibleMsgs = MSGS.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const isLandscape = useIsLandscape();
  const isMobile    = useIsMobile();

  const nextPage = useCallback(() => {
    setPage(p => (p + 1) % totalPages);
  }, [totalPages]);

  // El grid mantiene siempre la misma estructura (cols × rows = PAGE_SIZE),
  // independientemente de cuántos mensajes haya en la página actual.
  // Las celdas vacías quedan en blanco — sin celdas fantasma.
  const cols = isLandscape ? 3 : 2;                    // coincide con el CSS
  const rows = Math.ceil(PAGE_SIZE / cols);             // portrait → 3, landscape → 2

  return (
    <FullscreenLayout>
      <div style={{
        display: "flex",
        flexDirection: isMobile ? "column" : "row",
        gap: "8px",
        padding: "10px",
        height: "100%",
        boxSizing: "border-box",
        background: "#FAFAFA",
      }}>
        {/* Cuadrícula — filas/columnas fijas, celdas vacías quedan en blanco */}
        <div className="msg-grid-container" style={{
          flex: 1,
          minHeight: 0,
          gap: "8px",
          gridTemplateRows: `repeat(${rows}, 1fr)`,
        }}>
          {visibleMsgs.map((m) => (
            <MessageButton key={m.id} {...m} />
          ))}
        </div>

        {/* Escritorio/tablet: flecha lateral */}
        {!isMobile && totalPages > 1 && (
          <NavArrowButton page={page} totalPages={totalPages} onNext={nextPage} />
        )}

        {/* Móvil: botón de paginación inferior centrado */}
        {isMobile && totalPages > 1 && (
          <MobilePageButton page={page} totalPages={totalPages} onNext={nextPage} />
        )}
      </div>
    </FullscreenLayout>
  );
}
