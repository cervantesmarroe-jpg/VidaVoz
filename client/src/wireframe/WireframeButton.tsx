import { useRef, useState, useCallback, ReactNode } from "react";
import { DWELL_MS } from "@/lib/dwell";

interface Props {
  label?: string;
  sublabel?: string;
  iconText?: string;
  priority?: boolean;
  testId?: string;
  onActivate?: () => void;
  children?: ReactNode;
}

/**
 * Botón wireframe con dwell visible (3000 ms, mismo valor central que la app
 * real). El feedback visual está aislado en CSS scoped (wf-*) y no toca el
 * sistema de producción. Sirve para que el wireframe muestre cómo se siente
 * la activación por mirada / hover prolongado.
 */
export function WireframeButton({
  label, sublabel, iconText, priority, testId, onActivate, children,
}: Props) {
  const [active, setActive] = useState(false);
  const btnRef   = useRef<HTMLButtonElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rafRef   = useRef<number | null>(null);

  const cancel = useCallback(() => {
    if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
    if (rafRef.current)   { cancelAnimationFrame(rafRef.current); rafRef.current = null; }
    setActive(false);
    if (btnRef.current) btnRef.current.style.setProperty("--wf-progress", "0");
  }, []);

  const start = useCallback(() => {
    if (timerRef.current) return;
    setActive(true);
    const t0 = performance.now();
    const tick = () => {
      const p = Math.min((performance.now() - t0) / DWELL_MS, 1);
      if (btnRef.current) btnRef.current.style.setProperty("--wf-progress", String(p));
      if (p < 1) rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    timerRef.current = setTimeout(() => {
      cancel();
      onActivate?.();
    }, DWELL_MS);
  }, [cancel, onActivate]);

  return (
    <button
      ref={btnRef}
      data-testid={testId}
      data-gaze-active={active || undefined}
      onPointerEnter={start}
      onPointerLeave={cancel}
      onClick={() => { cancel(); onActivate?.(); }}
      className={`wf-btn ${priority ? "wf-btn-priority" : ""}`}
    >
      {iconText && <div className="wf-btn-icon">{iconText}</div>}
      {label    && <div className="wf-btn-label">{label}</div>}
      {sublabel && <div className="wf-btn-sublabel">{sublabel}</div>}
      {children}
    </button>
  );
}
