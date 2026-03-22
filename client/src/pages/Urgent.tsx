import { useRef, useCallback, useEffect, useState } from "react";
import { FullscreenLayout } from "@/components/FullscreenLayout";
import { useTTS } from "@/hooks/use-tts";
import { Wind, Zap, Frown, GlassWater } from "lucide-react";

const DWELL_MS = 3000;

// ── Tipos ────────────────────────────────────────────────────────────────────
interface UrgentMsg {
  label: string;
  sublabel: string;
  phrase: string;
  icon: React.ElementType;
  bg: string;
  border: string;
  glow: string;
  text: string;
  priority?: boolean;
}

// ── Definición de mensajes ───────────────────────────────────────────────────
const URGENT_MSGS: UrgentMsg[] = [
  {
    label: "ME FALTA",
    sublabel: "EL AIRE",
    phrase: "Me falta el aire. Me ahogo. Necesito ayuda urgente.",
    icon: Wind,
    bg: "linear-gradient(160deg, #D9534F 0%, #a03030 100%)",
    border: "3px solid #ff9a98",
    glow: "0 0 60px rgba(217,83,79,0.7)",
    text: "#ffffff",
    priority: true,
  },
  {
    label: "TENGO",
    sublabel: "DOLOR",
    phrase: "Tengo mucho dolor. Necesito ayuda.",
    icon: Zap,
    bg: "linear-gradient(160deg, #F0AD4E 0%, #b87a1a 100%)",
    border: "3px solid #ffd48a",
    glow: "0 0 50px rgba(240,173,78,0.6)",
    text: "#ffffff",
  },
  {
    label: "TENGO",
    sublabel: "NÁUSEAS",
    phrase: "Tengo náuseas. Tengo ganas de vomitar.",
    icon: Frown,
    bg: "linear-gradient(160deg, #5CB85C 0%, #2d6e2d 100%)",
    border: "3px solid #90e090",
    glow: "0 0 50px rgba(92,184,92,0.6)",
    text: "#ffffff",
  },
  {
    label: "TENGO",
    sublabel: "SED",
    phrase: "Tengo mucha sed. Necesito agua.",
    icon: GlassWater,
    bg: "linear-gradient(160deg, #5BC0DE 0%, #2080a0 100%)",
    border: "3px solid #9ae0f8",
    glow: "0 0 50px rgba(91,192,222,0.6)",
    text: "#ffffff",
  },
];

// ── Sonido de campana ────────────────────────────────────────────────────────
function playBell() {
  try {
    const ctx = new (window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    const o1 = ctx.createOscillator();
    const o2 = ctx.createOscillator();
    const g  = ctx.createGain();
    o1.connect(g); o2.connect(g); g.connect(ctx.destination);
    o1.type = "sine"; o1.frequency.setValueAtTime(1047, ctx.currentTime);
    o1.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.4);
    o2.type = "sine"; o2.frequency.setValueAtTime(1319, ctx.currentTime);
    o2.frequency.exponentialRampToValueAtTime(1109, ctx.currentTime + 0.4);
    g.gain.setValueAtTime(0, ctx.currentTime);
    g.gain.linearRampToValueAtTime(0.25, ctx.currentTime + 0.01);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1.1);
    o1.start(); o2.start(); o1.stop(ctx.currentTime + 1.1); o2.stop(ctx.currentTime + 1.1);
  } catch { /* silently ignore */ }
}

// ── Cursor de mirada ─────────────────────────────────────────────────────────
interface GazeCursorProps { isDwelling: boolean }

function GazeCursor({ isDwelling }: GazeCursorProps) {
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;

    const onMove = (e: PointerEvent) => {
      const x = e.clientX - 22;
      const y = e.clientY - 22;
      wrap.style.transform = `translate(${x}px, ${y}px)`;
      wrap.style.opacity = "1";
    };

    window.addEventListener("pointermove", onMove, { passive: true });
    return () => window.removeEventListener("pointermove", onMove);
  }, []);

  return (
    <div
      ref={wrapRef}
      className="fixed top-0 left-0 pointer-events-none z-[9998]"
      style={{ opacity: 0, transition: "transform 0.09s linear, opacity 0.3s", willChange: "transform" }}
    >
      <div
        style={{
          width: 44, height: 44,
          borderRadius: "50%",
          background: isDwelling
            ? "rgba(251, 191, 36, 0.18)"
            : "rgba(255, 255, 255, 0.22)",
          border: `3px solid ${isDwelling ? "#f59e0b" : "#fbbf24"}`,
          boxShadow: isDwelling
            ? "0 0 32px rgba(245,158,11,0.9), 0 0 8px rgba(255,255,255,0.4)"
            : "0 0 16px rgba(251,191,36,0.6)",
          animation: isDwelling ? "cursor-scale-pulse 0.8s ease-in-out infinite" : "none",
        }}
      />
    </div>
  );
}

// ── Botón urgente ────────────────────────────────────────────────────────────
interface BtnProps {
  msg: UrgentMsg;
  onDwellStart: () => void;
  onDwellEnd: () => void;
}

function UrgentButton({ msg, onDwellStart, onDwellEnd }: BtnProps) {
  const { speak } = useTTS();
  const timerRef  = useRef<ReturnType<typeof setTimeout> | null>(null);
  const svgRef    = useRef<SVGSVGElement>(null);
  const circRef   = useRef<SVGCircleElement>(null);
  const btnRef    = useRef<HTMLButtonElement>(null);

  const fire = useCallback(() => {
    playBell();
    speak(msg.phrase);
  }, [msg.phrase, speak]);

  const startDwell = useCallback(() => {
    if (timerRef.current) return;
    onDwellStart();
    btnRef.current?.classList.add("urgent-btn-dwelling");
    svgRef.current?.classList.add("active");
    circRef.current?.classList.remove("animating");
    void circRef.current?.getBoundingClientRect();
    circRef.current?.classList.add("animating");
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      cancelDwell();
      fire();
    }, DWELL_MS);
  }, [fire, onDwellStart]);

  const cancelDwell = useCallback(() => {
    if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
    onDwellEnd();
    btnRef.current?.classList.remove("urgent-btn-dwelling");
    svgRef.current?.classList.remove("active");
    circRef.current?.classList.remove("animating");
  }, [onDwellEnd]);

  const handleClick = () => { cancelDwell(); fire(); };

  return (
    <button
      ref={btnRef}
      data-gaze-target="true"
      data-testid={`button-urgent-${msg.sublabel.toLowerCase().replace(/\s/g, "-")}`}
      onClick={handleClick}
      onPointerEnter={startDwell}
      onPointerLeave={cancelDwell}
      style={{
        background: msg.bg,
        border: msg.priority ? `4px solid #ff9a98` : msg.border,
        boxShadow: msg.glow,
        borderRadius: "20px",
        padding: "20px",
        outline: msg.priority ? "3px solid rgba(255,255,255,0.35)" : "none",
        outlineOffset: msg.priority ? "4px" : "0",
        transition: "filter 0.15s",
        color: msg.text,
        cursor: "pointer",
        userSelect: "none",
        touchAction: "manipulation",
        position: "relative",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: "12px",
      }}
    >
      {/* Anillo de dwell SVG */}
      <svg ref={svgRef} className="dwell-ring-svg" viewBox="0 0 120 120" aria-hidden="true">
        <circle ref={circRef} className="dwell-ring-circle" cx="60" cy="60" r="52" />
      </svg>

      {/* Brillo superior */}
      <div style={{
        position: "absolute", inset: 0,
        background: "linear-gradient(to bottom, rgba(255,255,255,0.15) 0%, transparent 45%)",
        borderRadius: "20px", pointerEvents: "none",
      }} />

      {/* Icono */}
      <msg.icon
        style={{ width: "4rem", height: "4rem", strokeWidth: 1.5, filter: "drop-shadow(0 4px 8px rgba(0,0,0,0.35))", position: "relative", zIndex: 1 }}
        aria-hidden="true"
      />

      {/* Texto */}
      <div style={{ position: "relative", zIndex: 1, display: "flex", flexDirection: "column", alignItems: "center", lineHeight: 1.1 }}>
        <span style={{
          fontFamily: "'Lexend', sans-serif",
          fontSize: "clamp(1rem, 2.5vw, 1.6rem)",
          fontWeight: 800,
          textTransform: "uppercase",
          letterSpacing: "0.08em",
          color: msg.text,
          textShadow: "0 2px 8px rgba(0,0,0,0.4)",
        }}>
          {msg.label}
        </span>
        <span style={{
          fontFamily: "'Lexend', sans-serif",
          fontSize: "clamp(1.4rem, 3.8vw, 2.8rem)",
          fontWeight: 900,
          textTransform: "uppercase",
          letterSpacing: "0.05em",
          color: msg.text,
          textShadow: "0 2px 12px rgba(0,0,0,0.45)",
        }}>
          {msg.sublabel}
        </span>
      </div>
    </button>
  );
}

// ── Página principal ─────────────────────────────────────────────────────────
export default function Urgent() {
  const [isDwelling, setIsDwelling] = useState(false);

  return (
    <FullscreenLayout>
      {/* Cursor de mirada */}
      <GazeCursor isDwelling={isDwelling} />

      {/* Grid 2x2 — ocupa todo el espacio disponible */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gridTemplateRows: "1fr 1fr",
          gap: "10px",
          padding: "10px",
          height: "100%",
          boxSizing: "border-box",
          background: "#111",
        }}
      >
        {URGENT_MSGS.map((msg) => (
          <UrgentButton
            key={msg.sublabel}
            msg={msg}
            onDwellStart={() => setIsDwelling(true)}
            onDwellEnd={() => setIsDwelling(false)}
          />
        ))}
      </div>
    </FullscreenLayout>
  );
}
