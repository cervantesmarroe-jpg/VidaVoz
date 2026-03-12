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

declare global {
  interface Window { webgazer: any; }
}

const DWELL_MS = 2000;

const wg = () => window.webgazer;

// ─── React hook ─────────────────────────────────────────────────────────────

export function useWebGazer() {
  const { isActive, isCalibrating, startCalibration, finishCalibration, deactivate } =
    useWebGazerStore();

  const targetRef    = useRef<HTMLElement | null>(null);
  const enterTimeRef = useRef<number>(0);
  const cooldownRef  = useRef<boolean>(false);
  const rafRef       = useRef<number>(0);

  // Gaze cursor element
  useEffect(() => {
    if (!document.getElementById('gaze-cursor')) {
      const el = document.createElement('div');
      el.id = 'gaze-cursor';
      document.body.appendChild(el);
    }
    return () => { document.getElementById('gaze-cursor')?.remove(); };
  }, []);

  // When calibration starts: open camera, show video preview
  useEffect(() => {
    if (!isCalibrating) return;
    try {
      wg()?.showVideoPreview(true);
      wg()?.params && (wg().params.showFaceFeedbackBox = true);
      // .catch() handles the TF.js face-model Promise rejection gracefully
      const p = wg()?.begin();
      if (p && typeof p.catch === 'function') p.catch(() => {});
    } catch (e) {
      console.warn('webgazer.begin():', e);
    }
  }, [isCalibrating]);

  // When neither calibrating nor active: pause camera, hide preview
  useEffect(() => {
    if (isCalibrating || isActive) return;
    try {
      wg()?.showVideoPreview(false);
      wg()?.pause();
      wg()?.setGazeListener(null);
    } catch (_) {}
  }, [isCalibrating, isActive]);

  // When active: attach gaze listener → dwell tracking
  useEffect(() => {
    const cursor = document.getElementById('gaze-cursor');
    if (!isActive) {
      if (cursor) cursor.style.display = 'none';
      cancelAnimationFrame(rafRef.current);
      try { wg()?.setGazeListener(null); } catch (_) {}
      if (targetRef.current) { resetProgress(targetRef.current); targetRef.current = null; }
      return;
    }

    if (cursor) cursor.style.display = 'block';
    // Video preview off once active (prediction runs in background)
    try { wg()?.showVideoPreview(false); } catch (_) {}

    try {
      wg()?.setGazeListener((data: any, elapsed: number) => {
        if (!data) return;
        const { x, y } = data as { x: number; y: number };

        // Move cursor
        const c = document.getElementById('gaze-cursor');
        if (c) c.style.transform = `translate(calc(${x}px - 50%), calc(${y}px - 50%)) rotate(45deg)`;

        // Hit-test: hide cursor momentarily so elementFromPoint finds what's underneath
        if (c) c.style.visibility = 'hidden';
        const el  = document.elementFromPoint(x, y) as HTMLElement | null;
        if (c) c.style.visibility = '';

        const target = el?.closest('[data-gaze-target="true"]') as HTMLElement | null;
        dwellTick(target, elapsed);
      });
    } catch (e) {
      console.warn('setGazeListener:', e);
    }

    return () => {
      try { wg()?.setGazeListener(null); } catch (_) {}
    };
  }, [isActive]); // eslint-disable-line react-hooks/exhaustive-deps

  function dwellTick(target: HTMLElement | null, now: number) {
    if (target) {
      if (target !== targetRef.current) {
        if (targetRef.current) resetProgress(targetRef.current);
        targetRef.current  = target;
        enterTimeRef.current = now;
        cooldownRef.current  = false;
      } else if (!cooldownRef.current) {
        const progress = Math.min((now - enterTimeRef.current) / DWELL_MS, 1);
        updateProgress(target, progress);
        if (progress >= 1) {
          target.click();
          resetProgress(target);
          cooldownRef.current = true;
          target.style.transform = 'scale(0.95)';
          setTimeout(() => { target.style.transform = ''; }, 150);
        }
      }
    } else if (targetRef.current) {
      resetProgress(targetRef.current);
      targetRef.current = null;
    }
  }

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
