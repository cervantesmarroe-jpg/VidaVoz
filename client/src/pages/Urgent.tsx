import { useRef, useCallback } from "react";
import { Layout } from "@/components/Layout";
import { useTTS } from "@/hooks/use-tts";
import { Wind, Zap, Frown, GlassWater } from "lucide-react";

const DWELL_MS = 3000;

interface UrgentMsg {
  label: string;
  sublabel?: string;
  phrase: string;
  icon: React.ElementType;
  bg: string;
  border: string;
  shadow: string;
  text: string;
  priority?: boolean;
}

const URGENT_MSGS: UrgentMsg[] = [
  {
    label: "ME FALTA",
    sublabel: "EL AIRE",
    phrase: "Me falta el aire. Me ahogo. Necesito ayuda urgente.",
    icon: Wind,
    bg: "from-[#D9534F] to-[#b03a37]",
    border: "border-[#ff8a88]",
    shadow: "shadow-[0_0_48px_rgba(217,83,79,0.6)]",
    text: "text-white",
    priority: true,
  },
  {
    label: "TENGO",
    sublabel: "DOLOR",
    phrase: "Tengo mucho dolor. Necesito ayuda.",
    icon: Zap,
    bg: "from-[#F0AD4E] to-[#c8872a]",
    border: "border-[#ffd08a]",
    shadow: "shadow-[0_0_36px_rgba(240,173,78,0.5)]",
    text: "text-white",
  },
  {
    label: "TENGO",
    sublabel: "NÁUSEAS",
    phrase: "Tengo náuseas. Tengo ganas de vomitar.",
    icon: Frown,
    bg: "from-[#5CB85C] to-[#3d8b3d]",
    border: "border-[#96e096]",
    shadow: "shadow-[0_0_36px_rgba(92,184,92,0.5)]",
    text: "text-white",
  },
  {
    label: "TENGO",
    sublabel: "SED",
    phrase: "Tengo mucha sed. Necesito agua.",
    icon: GlassWater,
    bg: "from-[#5BC0DE] to-[#2d9ab8]",
    border: "border-[#9ae6fc]",
    shadow: "shadow-[0_0_36px_rgba(91,192,222,0.5)]",
    text: "text-white",
  },
];

function playBell() {
  try {
    const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();

    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const gain = ctx.createGain();

    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(ctx.destination);

    osc1.type = "sine";
    osc1.frequency.setValueAtTime(1047, ctx.currentTime);
    osc1.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.4);

    osc2.type = "sine";
    osc2.frequency.setValueAtTime(1319, ctx.currentTime);
    osc2.frequency.exponentialRampToValueAtTime(1109, ctx.currentTime + 0.4);

    gain.gain.setValueAtTime(0, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.25, ctx.currentTime + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1.1);

    osc1.start(ctx.currentTime);
    osc2.start(ctx.currentTime);
    osc1.stop(ctx.currentTime + 1.1);
    osc2.stop(ctx.currentTime + 1.1);
  } catch {
    // silently ignore if AudioContext is unavailable
  }
}

interface UrgentButtonProps {
  msg: UrgentMsg;
}

function UrgentButton({ msg }: UrgentButtonProps) {
  const { speak } = useTTS();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const svgRef   = useRef<SVGSVGElement>(null);
  const circRef  = useRef<SVGCircleElement>(null);
  const btnRef   = useRef<HTMLButtonElement>(null);

  const startDwell = useCallback(() => {
    if (timerRef.current) return;
    svgRef.current?.classList.add("active");

    // ensure class is absent, force reflow, then re-add to restart animation
    circRef.current?.classList.remove("animating");
    void circRef.current?.getBoundingClientRect();
    circRef.current?.classList.add("animating");

    timerRef.current = setTimeout(() => {
      playBell();
      speak(msg.phrase);
      timerRef.current = null;
      cancelDwell();
    }, DWELL_MS);
  }, [msg.phrase, speak]);

  const cancelDwell = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    svgRef.current?.classList.remove("active");
    circRef.current?.classList.remove("animating");
  }, []);

  const handleClick = () => {
    cancelDwell();
    playBell();
    speak(msg.phrase);
  };

  return (
    <button
      ref={btnRef}
      data-gaze-target="true"
      data-testid={`button-urgent-${msg.sublabel?.toLowerCase().replace(/\s/g, "-") ?? msg.label.toLowerCase()}`}
      onClick={handleClick}
      onPointerEnter={startDwell}
      onPointerLeave={cancelDwell}
      className={`
        relative flex flex-col items-center justify-center gap-3 md:gap-5
        rounded-3xl select-none touch-manipulation cursor-pointer
        bg-gradient-to-b ${msg.bg}
        border-4 ${msg.border}
        ${msg.shadow}
        ${msg.priority ? "ring-4 ring-white/50 ring-offset-4 ring-offset-amber-50" : ""}
        transition-transform duration-150 active:scale-95
        overflow-hidden
      `}
    >
      {/* Anillo de dwell SVG */}
      <svg
        ref={svgRef}
        className="dwell-ring-svg"
        viewBox="0 0 120 120"
        aria-hidden="true"
      >
        <circle
          ref={circRef}
          className="dwell-ring-circle"
          cx="60"
          cy="60"
          r="52"
        />
      </svg>

      {/* Icono */}
      <msg.icon
        className={`${msg.text} drop-shadow-xl z-10`}
        style={{ width: "clamp(4rem, 10vw, 7rem)", height: "clamp(4rem, 10vw, 7rem)", strokeWidth: 1.5 }}
        aria-hidden="true"
      />

      {/* Texto */}
      <div className={`z-10 flex flex-col items-center leading-tight ${msg.text}`}>
        <span
          className="font-black uppercase tracking-wider"
          style={{ fontSize: "clamp(1.5rem, 3.5vw, 2.8rem)" }}
        >
          {msg.label}
        </span>
        {msg.sublabel && (
          <span
            className="font-black uppercase tracking-widest"
            style={{ fontSize: "clamp(1.8rem, 4.5vw, 3.6rem)" }}
          >
            {msg.sublabel}
          </span>
        )}
      </div>

      {/* Capa de brillo sutil en la parte superior */}
      <div className="absolute inset-x-0 top-0 h-1/3 bg-white/10 rounded-t-3xl pointer-events-none" />
    </button>
  );
}

export default function Urgent() {
  return (
    <Layout>
      <div className="h-full flex items-center justify-center p-3 md:p-4">
        <div
          className="grid grid-cols-2 gap-3 md:gap-5"
          style={{ width: "min(100%, 98vw)", height: "min(100%, 95vh)" }}
        >
          {URGENT_MSGS.map((msg) => (
            <UrgentButton key={msg.sublabel ?? msg.label} msg={msg} />
          ))}
        </div>
      </div>
    </Layout>
  );
}
