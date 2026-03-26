import { useRef, useCallback, useEffect, useState, ElementType } from "react";
import { FullscreenLayout } from "@/components/FullscreenLayout";
import { playBell } from "@/lib/audio";
import { useTTS } from "@/hooks/use-tts";
import { supabase } from "@/lib/supabaseClient";
import {
  Thermometer, UtensilsCrossed, MoveHorizontal, Bath,
  Lightbulb, Clock, Users, HeartCrack, Music, Wind,
  MessageCircle,
} from "lucide-react";

const MSG_DWELL_MS = 2000;

// ── Colores pastel rotativos para mensajes dinámicos ──────────────────────────
const PALETTE = [
  { bg: "#FDDEDE", bgHover: "#F5C8C8", accent: "#B03060" },
  { bg: "#D5F5E3", bgHover: "#B8EDD1", accent: "#145A30" },
  { bg: "#FEEFDC", bgHover: "#F9DFB8", accent: "#7A4200" },
  { bg: "#FCF3CF", bgHover: "#F7E89E", accent: "#6B4C00" },
];

// Icono genérico para mensajes de Supabase sin icono específico
const ICON_MAP: Record<string, ElementType> = {
  thermometer: Thermometer,
  food:        UtensilsCrossed,
  position:    MoveHorizontal,
  wc:          Bath,
  light:       Lightbulb,
  clock:       Clock,
  family:      Users,
  fear:        HeartCrack,
  music:       Music,
  suction:     Wind,
};

// ── Tipo de mensaje (local o de Supabase) ─────────────────────────────────────
interface MsgItem {
  id: string;
  label: string;
  phrase: string;
  icon: ElementType;
  bg: string;
  bgHover: string;
  accent: string;
}

// ── Mensajes estáticos de respaldo (por si Supabase no está configurado) ──────
const STATIC_MSGS: MsgItem[] = [
  {
    id: "familia", label: "QUIERO VER A MI FAMILIA",
    phrase: "Quiero ver a mi familia. Por favor, déjenles pasar.",
    icon: Users, bg: "#FDDEDE", bgHover: "#F5C8C8", accent: "#B03060",
  },
  {
    id: "wc", label: "IR AL WC",
    phrase: "Necesito ir al baño urgentemente.",
    icon: Bath, bg: "#D5F5E3", bgHover: "#B8EDD1", accent: "#145A30",
  },
  {
    id: "frio-calor", label: "TENGO FRÍO / CALOR",
    phrase: "Tengo frío o calor. Por favor regule la temperatura.",
    icon: Thermometer, bg: "#FEEFDC", bgHover: "#F9DFB8", accent: "#7A4200",
  },
  {
    id: "miedo", label: "TENGO MIEDO / NERVIOS",
    phrase: "Tengo miedo. Estoy nervioso. Necesito apoyo.",
    icon: HeartCrack, bg: "#FDDEDE", bgHover: "#F5C8C8", accent: "#B03060",
  },
  {
    id: "hambre", label: "TENGO HAMBRE",
    phrase: "Tengo hambre. Quisiera comer algo.",
    icon: UtensilsCrossed, bg: "#FCF3CF", bgHover: "#F7E89E", accent: "#6B4C00",
  },
  {
    id: "luz", label: "LUZ: ENCENDER / APAGAR",
    phrase: "Por favor, encienda o apague la luz.",
    icon: Lightbulb, bg: "#FEEFDC", bgHover: "#F9DFB8", accent: "#7A4200",
  },
  {
    id: "aspiracion", label: "NECESITO ASPIRACIÓN",
    phrase: "Necesito aspiración de secreciones. Tengo mocos o flemas.",
    icon: Wind, bg: "#D5F5E3", bgHover: "#B8EDD1", accent: "#145A30",
  },
  {
    id: "posicion", label: "CAMBIAR DE POSICIÓN",
    phrase: "Necesito cambiar de posición. Estoy incómodo.",
    icon: MoveHorizontal, bg: "#FCF3CF", bgHover: "#F7E89E", accent: "#6B4C00",
  },
  {
    id: "musica", label: "QUIERO LA RADIO / MÚSICA",
    phrase: "Quiero escuchar música o la radio.",
    icon: Music, bg: "#FDDEDE", bgHover: "#F5C8C8", accent: "#B03060",
  },
  {
    id: "hora", label: "¿QUÉ HORA ES?",
    phrase: "¿Qué hora es? ¿Es de día o de noche?",
    icon: Clock, bg: "#FEEFDC", bgHover: "#F9DFB8", accent: "#7A4200",
  },
];

// ── Convierte fila de Supabase → MsgItem ─────────────────────────────────────
function rowToMsg(row: Record<string, unknown>, idx: number): MsgItem {
  const palette = PALETTE[idx % PALETTE.length];
  const iconKey  = (row.icono as string | undefined) ?? "";
  const icon     = ICON_MAP[iconKey] ?? MessageCircle;
  return {
    id:      String(row.id ?? idx),
    label:   (row.texto as string) ?? "",
    phrase:  (row.frase as string) ?? (row.texto as string) ?? "",
    icon,
    bg:      (row.color_fondo as string)  ?? palette.bg,
    bgHover: palette.bgHover,
    accent:  (row.color_acento as string) ?? palette.accent,
  };
}

// ── Botón rectangular pastel ──────────────────────────────────────────────────
function MessageButton({ id, label, phrase, icon: Icon, bg, bgHover, accent }: MsgItem) {
  const { speak } = useTTS();
  const timerRef  = useRef<ReturnType<typeof setTimeout> | null>(null);
  const barRef    = useRef<HTMLDivElement>(null);
  const btnRef    = useRef<HTMLButtonElement>(null);

  const fire = useCallback(() => {
    playBell(); speak(phrase);
  }, [phrase, speak]);

  const startDwell = useCallback(() => {
    if (timerRef.current) return;
    if (btnRef.current) {
      btnRef.current.style.background  = bgHover;
      btnRef.current.style.boxShadow   = `0 0 0 2.5px #fbbf24, 0 4px 14px rgba(251,191,36,0.22)`;
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
  }, [bgHover, fire]);

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
        transition: "background 0.18s",
        boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
      }}
    >
      <Icon style={{ width: "1.6rem", height: "1.6rem", color: accent, flexShrink: 0, strokeWidth: 2 }} aria-hidden="true" />
      <span style={{
        fontFamily: "'Lexend', sans-serif",
        fontSize: "clamp(0.68rem, 1.7vw, 1rem)",
        fontWeight: 700,
        textTransform: "uppercase",
        letterSpacing: "0.06em",
        textAlign: "left",
        lineHeight: 1.25,
        color: "#333333",
      }}>
        {label}
      </span>
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

// ── Página ────────────────────────────────────────────────────────────────────
export default function Messages() {
  const [msgs, setMsgs] = useState<MsgItem[]>(STATIC_MSGS);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);

  // Fetch inicial + suscripción real-time
  useEffect(() => {
    let channel: ReturnType<typeof supabase.channel> | null = null;

    async function fetchMensajes() {
      setLoading(true);
      const { data, error: err } = await supabase
        .from("mensajes")
        .select("*")
        .order("orden", { ascending: true });

      if (err) {
        console.warn("Supabase error, usando mensajes estáticos:", err.message);
        setError(err.message);
        setMsgs(STATIC_MSGS);
      } else if (data && data.length > 0) {
        setMsgs(data.map((row, i) => rowToMsg(row as Record<string, unknown>, i)));
        setError(null);
      } else {
        // Tabla vacía → usar estáticos
        setMsgs(STATIC_MSGS);
      }
      setLoading(false);
    }

    fetchMensajes();

    // Suscripción en tiempo real a cualquier cambio en la tabla mensajes
    channel = supabase
      .channel("mensajes-changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "mensajes" },
        () => { fetchMensajes(); }
      )
      .subscribe();

    return () => {
      if (channel) supabase.removeChannel(channel);
    };
  }, []);

  // Calcular cuántas columnas/filas necesitamos
  const cols = 2;
  const rows = Math.ceil(msgs.length / cols);

  return (
    <FullscreenLayout>
      <div style={{
        display: "grid",
        gridTemplateColumns: `repeat(${cols}, 1fr)`,
        gridTemplateRows: `repeat(${rows}, 1fr)`,
        gap: "8px",
        padding: "10px",
        height: "100%",
        boxSizing: "border-box",
        background: "#FAFAFA",
        overflowY: "auto",
      }}>
        {loading && (
          <div style={{
            gridColumn: "1 / -1",
            display: "flex", alignItems: "center", justifyContent: "center",
            color: "#AAAAAA", fontFamily: "'Lexend',sans-serif", fontSize: ".85rem",
          }}>
            Cargando mensajes…
          </div>
        )}
        {!loading && msgs.map((m) => (
          <MessageButton key={m.id} {...m} />
        ))}
      </div>

      {/* Indicador discreto de error de conexión */}
      {error && (
        <div style={{
          position: "absolute", bottom: 6, left: "50%", transform: "translateX(-50%)",
          background: "#FEF9C3", border: "1px solid #FCD34D", borderRadius: 8,
          padding: "3px 12px", fontSize: ".6rem", color: "#6B4C00",
          fontFamily: "'Lexend',sans-serif", fontWeight: 600,
          pointerEvents: "none", zIndex: 10,
        }}>
          Modo sin conexión — mensajes locales
        </div>
      )}
    </FullscreenLayout>
  );
}
