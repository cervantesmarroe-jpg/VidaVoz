import { useEffect, useRef } from 'react';
import { create } from 'zustand';

interface WebGazerState {
  isActive: boolean;
  isCalibrating: boolean;
  startCalibration: () => void;
  finishCalibration: () => void;
  deactivate: () => void;
}

export const useWebGazerStore = create<WebGazerState>((set) => ({
  isActive: false,
  isCalibrating: false,
  startCalibration: () => set({ isCalibrating: true, isActive: false }),
  finishCalibration: () => set({ isCalibrating: false, isActive: true }),
  deactivate: () => set({ isActive: false, isCalibrating: false }),
}));

const DWELL_TIME_MS = 2000;

// Pure pointer-based dwell-time system — no camera or WebGazer required.
// Works with any pointing device: mouse, trackpad, head-tracker, eye-tracker.
export function useWebGazer() {
  const { isActive, isCalibrating, startCalibration, finishCalibration, deactivate } =
    useWebGazerStore();

  const targetRef = useRef<HTMLElement | null>(null);
  const enterTimeRef = useRef<number>(0);
  const rafRef = useRef<number>(0);
  const posRef = useRef<{ x: number; y: number }>({ x: -1, y: -1 });
  const clickCooldownRef = useRef<boolean>(false);

  useEffect(() => {
    if (!isActive) {
      cancelAnimationFrame(rafRef.current);
      if (targetRef.current) {
        resetProgress(targetRef.current);
        targetRef.current = null;
      }
      return;
    }

    const onPointerMove = (e: PointerEvent) => {
      posRef.current = { x: e.clientX, y: e.clientY };
    };

    window.addEventListener('pointermove', onPointerMove);

    const tick = () => {
      const { x, y } = posRef.current;
      if (x < 0) { rafRef.current = requestAnimationFrame(tick); return; }

      const el = document.elementFromPoint(x, y) as HTMLElement | null;
      const target = el?.closest('[data-gaze-target="true"]') as HTMLElement | null;

      if (target) {
        if (target !== targetRef.current) {
          if (targetRef.current) resetProgress(targetRef.current);
          targetRef.current = target;
          enterTimeRef.current = performance.now();
          clickCooldownRef.current = false;
        } else if (!clickCooldownRef.current) {
          const elapsed = performance.now() - enterTimeRef.current;
          const progress = Math.min(elapsed / DWELL_TIME_MS, 1);
          updateProgress(target, progress);
          if (progress >= 1) {
            target.click();
            resetProgress(target);
            clickCooldownRef.current = true;
            target.style.transform = 'scale(0.95)';
            setTimeout(() => { target.style.transform = ''; }, 150);
          }
        }
      } else {
        if (targetRef.current) {
          resetProgress(targetRef.current);
          targetRef.current = null;
        }
      }

      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener('pointermove', onPointerMove);
      if (targetRef.current) {
        resetProgress(targetRef.current);
        targetRef.current = null;
      }
    };
  }, [isActive]);

  return { isActive, isCalibrating, startCalibration, finishCalibration, deactivate };
}

function resetProgress(el: HTMLElement) {
  const bar = el.querySelector('.gaze-progress-bar') as HTMLElement | null;
  if (bar) bar.style.width = '0%';
}

function updateProgress(el: HTMLElement, progress: number) {
  const bar = el.querySelector('.gaze-progress-bar') as HTMLElement | null;
  if (bar) bar.style.width = `${progress * 100}%`;
}
