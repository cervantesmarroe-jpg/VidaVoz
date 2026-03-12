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
const WG_URL = 'https://webgazer.cs.brown.edu/webgazer.js';

/** Load WebGazer once, set ridge regression (no TF.js workers), then begin. */
function loadAndBeginWebGazer(): Promise<void> {
  return new Promise((resolve) => {
    if (window.webgazer) {
      beginWebGazer();
      resolve();
      return;
    }

    // Clear any stale localStorage so WebGazer doesn't auto-resume a crashed session
    Object.keys(localStorage)
      .filter((k) => k.startsWith('webgazer') || k.startsWith('wg'))
      .forEach((k) => localStorage.removeItem(k));

    const script = document.createElement('script');
    script.src = WG_URL;
    script.async = true;
    script.onload = () => {
      beginWebGazer();
      resolve();
    };
    script.onerror = () => {
      console.warn('WebGazer script failed to load — using pointer fallback');
      resolve(); // don't reject; fallback handles it
    };
    document.head.appendChild(script);
  });
}

function beginWebGazer() {
  try {
    const wg = window.webgazer;
    if (!wg) return;
    // Ridge regression = no TF.js workers → no "Unexpected token '<'" crash
    wg.setRegression('ridge');
    wg.params.showFaceOverlay = false;
    wg.params.showFaceFeedbackBox = true;
    wg.showVideoPreview(true);
    wg.begin();
  } catch (e) {
    console.warn('WebGazer begin (non-fatal):', e);
  }
}

// ---------------------------------------------------------------------------

export function useWebGazer() {
  const { isActive, isCalibrating, startCalibration, finishCalibration, deactivate } =
    useWebGazerStore();

  const targetRef       = useRef<HTMLElement | null>(null);
  const enterTimeRef    = useRef<number>(0);
  const rafRef          = useRef<number>(0);
  const posRef          = useRef<{ x: number; y: number } | null>(null);
  const cooldownRef     = useRef<boolean>(false);

  // --- Cursor element -------------------------------------------------
  useEffect(() => {
    if (!document.getElementById('gaze-cursor')) {
      const el = document.createElement('div');
      el.id = 'gaze-cursor';
      document.body.appendChild(el);
    }
    return () => { document.getElementById('gaze-cursor')?.remove(); };
  }, []);

  // --- Load + start WebGazer when calibration begins ------------------
  useEffect(() => {
    if (!isCalibrating) return;
    loadAndBeginWebGazer();
  }, [isCalibrating]);

  // --- Pause camera when neither calibrating nor active ---------------
  useEffect(() => {
    if (isCalibrating || isActive) return;
    try {
      window.webgazer?.showVideoPreview(false);
      window.webgazer?.pause();
    } catch (_) {}
  }, [isCalibrating, isActive]);

  // --- Dwell tracking when active -------------------------------------
  useEffect(() => {
    const cursor = document.getElementById('gaze-cursor');

    if (!isActive) {
      if (cursor) cursor.style.display = 'none';
      cancelAnimationFrame(rafRef.current);
      try { window.webgazer?.clearGazeListener?.(); } catch (_) {}
      if (targetRef.current) { resetProgress(targetRef.current); targetRef.current = null; }
      return;
    }

    if (cursor) cursor.style.display = 'block';

    if (window.webgazer) {
      // ── WebGazer eye-tracking path ──────────────────────────────────
      try {
        window.webgazer.setGazeListener((data: any, elapsed: number) => {
          if (!data) return;
          const { x, y } = data as { x: number; y: number };

          const c = document.getElementById('gaze-cursor');
          if (c) c.style.transform = `translate(calc(${x}px - 50%), calc(${y}px - 50%)) rotate(45deg)`;

          // Temporarily hide cursor to hit-test the element underneath
          if (c) c.style.visibility = 'hidden';
          const el = document.elementFromPoint(x, y) as HTMLElement | null;
          if (c) c.style.visibility = '';

          const tgt = el?.closest('[data-gaze-target="true"]') as HTMLElement | null;
          dwellTick(tgt, elapsed);
        });
      } catch (e) {
        console.warn('setGazeListener (non-fatal):', e);
      }

      return () => {
        try { window.webgazer?.clearGazeListener?.(); } catch (_) {}
      };
    } else {
      // ── Pointer / touch fallback ────────────────────────────────────
      const onMove = (e: PointerEvent) => { posRef.current = { x: e.clientX, y: e.clientY }; };
      window.addEventListener('pointermove', onMove);

      const tick = () => {
        if (posRef.current) {
          const { x, y } = posRef.current;
          const el = document.elementFromPoint(x, y) as HTMLElement | null;
          const tgt = el?.closest('[data-gaze-target="true"]') as HTMLElement | null;
          dwellTick(tgt, performance.now());
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
  }, [isActive]); // eslint-disable-line react-hooks/exhaustive-deps

  /** Core dwell logic — shared between WebGazer and pointer paths */
  function dwellTick(target: HTMLElement | null, now: number) {
    if (target) {
      if (target !== targetRef.current) {
        if (targetRef.current) resetProgress(targetRef.current);
        targetRef.current = target;
        enterTimeRef.current = now;
        cooldownRef.current = false;
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
  (el.querySelector('.gaze-progress-bar') as HTMLElement | null)?.style &&
    ((el.querySelector('.gaze-progress-bar') as HTMLElement).style.width = '0%');
}

function updateProgress(el: HTMLElement, progress: number) {
  const bar = el.querySelector('.gaze-progress-bar') as HTMLElement | null;
  if (bar) bar.style.width = `${progress * 100}%`;
}
