import { useRef, useCallback, ReactNode, ElementType } from "react";
import { useTTS } from "@/hooks/use-tts";
import { playBell, DWELL_MS } from "@/lib/audio";

// ── Props ────────────────────────────────────────────────────────────────────
export interface QuadButtonProps {
  label: string;
  sublabel?: string;
  phrase: string;
  icon: ElementType;
  bg: string;
  border: string;
  glow: string;
  textColor?: string;
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
  icon: Icon, bg, border, glow,
  textColor = "#333333",
  priority,
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
        border: priority ? `4px solid ${textColor}44` : border,
        boxShadow: glow,
        borderRadius: "20px",
        padding: "12px 14px",
        outline: priority ? `3px solid ${textColor}22` : "none",
        outlineOffset: priority ? "4px" : "0",
        color: textColor,
        cursor: "pointer",
        userSelect: "none",
        touchAction: "manipulation",
        position: "relative",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: "6px",
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
        background: "linear-gradient(to bottom, rgba(255,255,255,0.25) 0%, transparent 45%)",
      }} />

      {/* Icon — wrapper flex:1 captura todo el espacio sobrante */}
      <div style={{
        flex: 1,
        width: "100%",
        minHeight: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        position: "relative",
        zIndex: 1,
      }}>
        <Icon style={{
          width: "auto",
          height: "100%",
          maxWidth: "100%",
          maxHeight: "24rem",
          minHeight: "4.5rem",
          strokeWidth: 1.8,
          filter: "drop-shadow(0 3px 6px rgba(0,0,0,0.18))",
          color: textColor,
        }} aria-hidden="true" />
      </div>

      {/* Label */}
      <div style={{ position: "relative", zIndex: 1, display: "flex", flexDirection: "column", alignItems: "center", lineHeight: 1.1, textAlign: "center" }}>
        <span style={{ fontFamily: "'Lexend',sans-serif", fontSize: "clamp(0.85rem,2.2vw,1.4rem)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", textShadow: "none", color: textColor, opacity: 0.75 }}>
          {label}
        </span>
        {sublabel && (
          <span style={{ fontFamily: "'Lexend',sans-serif", fontSize: "clamp(1.3rem,3.5vw,2.6rem)", fontWeight: 900, textTransform: "uppercase", letterSpacing: "0.05em", color: textColor }}>
            {sublabel}
          </span>
        )}
      </div>

      {/* Slot extra */}
      {children && <div style={{ position: "relative", zIndex: 1, width: "100%" }}>{children}</div>}
    </button>
  );
}

// ── Grid 2×2 reutilizable (responsivo vía CSS) ───────────────────────────────
export function QuadGrid({ children }: { children: ReactNode }) {
  return (
    <div className="quad-grid-container" style={{
      gap: "10px",
      padding: "10px",
      height: "100%",
      boxSizing: "border-box",
      background: "#FAFAFA",
    }}>
      {children}
    </div>
  );
}
