import { useState, useEffect, useRef, useCallback } from 'react';
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
const WEBGAZER_SCRIPT_ID = 'webgazer-script';

// Remove WebGazer's stored data from localStorage to prevent auto-start
function clearWebGazerStorage() {
  try {
    Object.keys(localStorage)
      .filter((k) => k.toLowerCase().includes('webgazer'))
      .forEach((k) => localStorage.removeItem(k));
  } catch (_) {}
}

// Load the WebGazer script on demand and resolve when ready
function loadWebGazerScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (document.getElementById(WEBGAZER_SCRIPT_ID)) {
      resolve();
      return;
    }
    clearWebGazerStorage();
    const script = document.createElement('script');
    script.id = WEBGAZER_SCRIPT_ID;
    script.src = 'https://webgazer.cs.brown.edu/webgazer.js';
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('WebGazer script failed to load'));
    document.body.appendChild(script);
  });
}

export function useWebGazer() {
  const { isActive, isCalibrating, startCalibration, finishCalibration, deactivate } =
    useWebGazerStore();

  const [isScriptLoaded, setIsScriptLoaded] = useState(
    () => !!document.getElementById(WEBGAZER_SCRIPT_ID)
  );

  const targetRef = useRef<HTMLElement | null>(null);
  const startTimeRef = useRef<number>(0);
  const clickCooldownRef = useRef<boolean>(false);

  // Create gaze cursor element once
  useEffect(() => {
    if (!document.getElementById('gaze-cursor')) {
      const cursor = document.createElement('div');
      cursor.id = 'gaze-cursor';
      document.body.appendChild(cursor);
    }
    return () => {
      document.getElementById('gaze-cursor')?.remove();
    };
  }, []);

  // When calibration begins: load script (if not yet), then start WebGazer
  useEffect(() => {
    if (!isCalibrating) return;

    (async () => {
      try {
        await loadWebGazerScript();
        setIsScriptLoaded(true);

        if (!window.webgazer) return;

        // Configure before starting
        if (window.webgazer.params) {
          window.webgazer.params.showFaceOverlay = false;
          window.webgazer.params.showFaceFeedbackBox = true;
        }

        try { window.webgazer.showVideoPreview(true); } catch (_) {}
        try { window.webgazer.begin(); } catch (e) {
          console.warn('WebGazer begin (non-fatal):', e);
        }
      } catch (e) {
        console.warn('WebGazer load failed (non-fatal):', e);
      }
    })();
  }, [isCalibrating]);

  // Gaze listener: activate after calibration, deactivate otherwise
  useEffect(() => {
    if (!isScriptLoaded || !window.webgazer) return;

    const cursorEl = document.getElementById('gaze-cursor');

    if (isActive) {
      if (cursorEl) cursorEl.style.display = 'block';

      try {
        window.webgazer.setGazeListener((data: any, elapsedTime: number) => {
          if (!data) return;
          const { x, y } = data;

          const cursor = document.getElementById('gaze-cursor');
          if (cursor) cursor.style.transform = `translate(${x}px, ${y}px) rotate(45deg)`;

          if (cursor) cursor.style.display = 'none';
          const elUnder = document.elementFromPoint(x, y) as HTMLElement;
          if (cursor) cursor.style.display = 'block';

          const target = elUnder?.closest('[data-gaze-target="true"]') as HTMLElement;

          if (target) {
            if (target !== targetRef.current) {
              if (targetRef.current) resetProgress(targetRef.current);
              targetRef.current = target;
              startTimeRef.current = elapsedTime;
              clickCooldownRef.current = false;
            } else if (!clickCooldownRef.current) {
              const progress = Math.min(
                (elapsedTime - startTimeRef.current) / DWELL_TIME_MS,
                1
              );
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
        });
      } catch (e) {
        console.warn('WebGazer setGazeListener (non-fatal):', e);
      }
    } else {
      if (cursorEl) cursorEl.style.display = 'none';
      if (targetRef.current) {
        resetProgress(targetRef.current);
        targetRef.current = null;
      }
      try { window.webgazer.clearGazeListener(); } catch (_) {}
      if (!isCalibrating) {
        try { window.webgazer.pause(); } catch (_) {}
        try { window.webgazer.showVideoPreview(false); } catch (_) {}
      }
    }
  }, [isActive, isScriptLoaded, isCalibrating]);

  return {
    isActive,
    isCalibrating,
    startCalibration,
    finishCalibration,
    deactivate,
    isScriptLoaded,
  };
}

function resetProgress(el: HTMLElement) {
  const bar = el.querySelector('.gaze-progress-bar') as HTMLElement;
  if (bar) bar.style.width = '0%';
}

function updateProgress(el: HTMLElement, progress: number) {
  const bar = el.querySelector('.gaze-progress-bar') as HTMLElement;
  if (bar) bar.style.width = `${progress * 100}%`;
}
