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

const DWELL_TIME_MS = 2000;

export function useWebGazer() {
  const { isActive, isCalibrating, startCalibration, finishCalibration, deactivate } =
    useWebGazerStore();

  const targetRef = useRef<HTMLElement | null>(null);
  const enterTimeRef = useRef<number>(0);
  const rafRef = useRef<number>(0);
  const posRef = useRef<{ x: number; y: number } | null>(null);
  const clickCooldownRef = useRef<boolean>(false);

  // Create gaze cursor element once
  useEffect(() => {
    if (!document.getElementById('gaze-cursor')) {
      const el = document.createElement('div');
      el.id = 'gaze-cursor';
      document.body.appendChild(el);
    }
    return () => { document.getElementById('gaze-cursor')?.remove(); };
  }, []);

  // Start WebGazer camera during calibration
  useEffect(() => {
    if (!isCalibrating) return;
    try {
      const wg = window.webgazer;
      if (!wg) return;
      wg.setRegression('ridge');
      wg.params.showFaceOverlay = false;
      wg.params.showFaceFeedbackBox = true;
      wg.showVideoPreview(true);
      wg.begin();
    } catch (e) {
      console.warn('WebGazer begin (non-fatal):', e);
    }
  }, [isCalibrating]);

  // Stop camera preview when calibration ends
  useEffect(() => {
    if (isCalibrating || isActive) return;
    try {
      window.webgazer?.showVideoPreview(false);
      window.webgazer?.pause();
    } catch (_) {}
  }, [isCalibrating, isActive]);

  // Activate gaze tracking when isActive
  useEffect(() => {
    const cursorEl = document.getElementById('gaze-cursor');

    if (!isActive) {
      if (cursorEl) cursorEl.style.display = 'none';
      cancelAnimationFrame(rafRef.current);
      try { window.webgazer?.clearGazeListener?.(); } catch (_) {}
      if (targetRef.current) { resetProgress(targetRef.current); targetRef.current = null; }
      return;
    }

    if (cursorEl) cursorEl.style.display = 'block';

    const wg = window.webgazer;
    const hasWebGazer = !!wg;

    if (hasWebGazer) {
      // --- WebGazer path: real eye tracking ---
      try {
        wg.setGazeListener((data: any, elapsedTime: number) => {
          if (!data) return;
          const { x, y } = data;
          posRef.current = { x, y };

          const cursor = document.getElementById('gaze-cursor');
          if (cursor) {
            cursor.style.transform = `translate(${x}px, ${y}px) rotate(45deg)`;
          }

          if (cursor) cursor.style.display = 'none';
          const el = document.elementFromPoint(x, y) as HTMLElement | null;
          if (cursor) cursor.style.display = 'block';

          const target = el?.closest('[data-gaze-target="true"]') as HTMLElement | null;
          handleDwell(target, elapsedTime);
        });
      } catch (e) {
        console.warn('WebGazer setGazeListener (non-fatal):', e);
      }
    } else {
      // --- Fallback path: pointer/mouse dwell-time ---
      const onMove = (e: PointerEvent) => { posRef.current = { x: e.clientX, y: e.clientY }; };
      window.addEventListener('pointermove', onMove);

      const tick = () => {
        if (posRef.current) {
          const { x, y } = posRef.current;
          const el = document.elementFromPoint(x, y) as HTMLElement | null;
          const target = el?.closest('[data-gaze-target="true"]') as HTMLElement | null;
          handleDwell(target, performance.now());
        }
        rafRef.current = requestAnimationFrame(tick);
      };
      rafRef.current = requestAnimationFrame(tick);

      return () => {
        cancelAnimationFrame(rafRef.current);
        window.removeEventListener('pointermove', onMove);
        if (targetRef.current) { resetProgress(targetRef.current); targetRef.current = null; }
      };
    }
  }, [isActive]);

  function handleDwell(target: HTMLElement | null, now: number) {
    if (target) {
      if (target !== targetRef.current) {
        if (targetRef.current) resetProgress(targetRef.current);
        targetRef.current = target;
        enterTimeRef.current = now;
        clickCooldownRef.current = false;
      } else if (!clickCooldownRef.current) {
        const progress = Math.min((now - enterTimeRef.current) / DWELL_TIME_MS, 1);
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
