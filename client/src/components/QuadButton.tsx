import { useRef, useCallback, ReactNode } from "react";
import { useTTS } from "@/hooks/use-tts";

export const DWELL_MS = 3000;

// ── Campana Web Audio API ────────────────────────────────────────────────────
export function playBell() {
  try {
    const ctx = new (window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    const o1 = ctx.createOscillator(), o2 = ctx.createOscillator(), g = ctx.createGain();
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

// ── Props ────────────────────────────────────────────────────────────────────
export interface QuadButtonProps {
  label: string;
  sublabel?: string;
  phrase: string;
  icon: React.ElementType;
  bg: string;
  border: string;
  glow: string;
  priority?: boolean;
  onDwellStart?: () => void;
  onDwellEnd?: () => void;
  onActivate?: () => void;
  testId?: string;
  children?: ReactNode;
}

// ── Botón cuadrante reutilizable ─────────────────────────────────────────────
export function QuadButton({
  label, sublabel, phrase,
  icon: Icon, bg, border, glow, priority,
  onDwellStart, onDwellEnd, onActivate,
  testId, children,
}: QuadButtonProps) {
  const { speak }  = useTTS();
  const timerRef   = useRef<ReturnType<typeof setTimeout> | null>(null);
  const svgRef     = useRef<SVGSVGElement>(null);
  const circRef    = useRef<SVGCircleElement>(null);
  const btnRef     = useRef<HTMLButtonElement>(null);

  const fire = useCallback(() => {
    playBell();
    if (onActivate) onActivate(); else speak(phrase);
  }, [phrase, speak, onActivate]);

  const startDwell = useCallback(() => {
    if (timerRef.current) return;
    onDwellStart?.();
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
    onDwellEnd?.();
    btnRef.current?.classList.remove("urgent-btn-dwelling");
    svgRef.current?.classList.remove("active");
    circRef.current?.classList.remove("animating");
  }, [onDwellEnd]);

  return (
    <button
      ref={btnRef}
      data-gaze-target="true"
      data-testid={testId}
      onClick={() => { cancelDwell(); fire(); }}
      onPointerEnter={startDwell}
      onPointerLeave={cancelDwell}
      style={{
        background: bg,
        border: priority ? "4px solid rgba(255,255,255,0.55)" : border,
        boxShadow: glow,
        borderRadius: "20px",
        padding: "20px",
        outline: priority ? "3px solid rgba(255,255,255,0.3)" : "none",
        outlineOffset: priority ? "4px" : "0",
        color: "#fff",
        cursor: "pointer",
        userSelect: "none",
        touchAction: "manipulation",
        position: "relative",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: "10px",
        transition: "filter 0.15s",
      }}
    >
      {/* Dwell ring */}
      <svg ref={svgRef} className="dwell-ring-svg" viewBox="0 0 120 120" aria-hidden="true">
        <circle ref={circRef} className="dwell-ring-circle" cx="60" cy="60" r="52" />
      </svg>

      {/* Shimmer */}
      <div style={{
        position: "absolute", inset: 0, borderRadius: "20px", pointerEvents: "none",
        background: "linear-gradient(to bottom, rgba(255,255,255,0.14) 0%, transparent 45%)",
      }} />

      {/* Icon */}
      <Icon style={{
        width: "4rem", height: "4rem", strokeWidth: 1.5,
        filter: "drop-shadow(0 4px 8px rgba(0,0,0,0.35))",
        position: "relative", zIndex: 1, flexShrink: 0,
      }} aria-hidden="true" />

      {/* Label */}
      <div style={{ position: "relative", zIndex: 1, display: "flex", flexDirection: "column", alignItems: "center", lineHeight: 1.1, textAlign: "center" }}>
        <span style={{ fontFamily: "'Lexend',sans-serif", fontSize: "clamp(1rem,2.5vw,1.6rem)", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.08em", textShadow: "0 2px 8px rgba(0,0,0,0.4)" }}>
          {label}
        </span>
        {sublabel && (
          <span style={{ fontFamily: "'Lexend',sans-serif", fontSize: "clamp(1.4rem,3.8vw,2.8rem)", fontWeight: 900, textTransform: "uppercase", letterSpacing: "0.05em", textShadow: "0 2px 12px rgba(0,0,0,0.45)" }}>
            {sublabel}
          </span>
        )}
      </div>

      {/* Slot extra */}
      {children && <div style={{ position: "relative", zIndex: 1, width: "100%" }}>{children}</div>}
    </button>
  );
}

// ── Grid 2×2 reutilizable ────────────────────────────────────────────────────
export function QuadGrid({ children }: { children: ReactNode }) {
  return (
    <div style={{
      display: "grid",
      gridTemplateColumns: "1fr 1fr",
      gridTemplateRows: "1fr 1fr",
      gap: "10px",
      padding: "10px",
      height: "100%",
      boxSizing: "border-box",
      background: "#111",
    }}>
      {children}
    </div>
  );
}
