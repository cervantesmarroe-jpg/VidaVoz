import { useState, useEffect, useRef } from 'react';
import { create } from 'zustand';

interface WebGazerState {
  isActive: boolean;        // gaze listener controlling the UI
  isCalibrating: boolean;   // calibration overlay is visible
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
  const [isScriptLoaded, setIsScriptLoaded] = useState(false);

  const targetRef = useRef<HTMLElement | null>(null);
  const startTimeRef = useRef<number>(0);
  const clickCooldownRef = useRef<boolean>(false);

  // 1. Inject WebGazer script once
  useEffect(() => {
    if (document.getElementById('webgazer-script')) {
      setIsScriptLoaded(true);
      return;
    }

    const script = document.createElement('script');
    script.id = 'webgazer-script';
    script.src = 'https://webgazer.cs.brown.edu/webgazer.js';
    script.async = true;
    script.onload = () => {
      try {
        setIsScriptLoaded(true);
        if (window.webgazer?.params) {
          window.webgazer.params.showVideoPreview = true;
          window.webgazer.params.showFaceOverlay = false;
          window.webgazer.params.showFaceFeedbackBox = true;
        }
      } catch (e) {
        console.warn('WebGazer init error (non-fatal):', e);
      }
    };
    script.onerror = () => console.warn('WebGazer script failed to load.');
    document.body.appendChild(script);

    const cursor = document.createElement('div');
    cursor.id = 'gaze-cursor';
    document.body.appendChild(cursor);

    return () => {
      document.getElementById('gaze-cursor')?.remove();
    };
  }, []);

  // 2. Start WebGazer camera when calibration begins
  useEffect(() => {
    if (!isScriptLoaded || !window.webgazer) return;
    if (!isCalibrating) return;

    try { window.webgazer.resume(); } catch (_) {}
    try { window.webgazer.begin(); } catch (e) {
      console.warn('WebGazer begin error (non-fatal):', e);
    }
    try { window.webgazer.showVideoPreview(true); } catch (_) {}
    // Clear previous regression data so calibration starts fresh
    try { window.webgazer.clearData(); } catch (_) {}
  }, [isCalibrating, isScriptLoaded]);

  // 3. Activate gaze listener after calibration completes
  useEffect(() => {
    if (!isScriptLoaded || !window.webgazer) return;

    const cursorEl = document.getElementById('gaze-cursor');

    if (isActive) {
      if (cursorEl) cursorEl.style.display = 'block';

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
            const progress = Math.min((elapsedTime - startTimeRef.current) / DWELL_TIME_MS, 1);
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
    } else {
      if (cursorEl) cursorEl.style.display = 'none';
      try {
        window.webgazer.clearGazeListener();
      } catch (_) {}
      if (!isCalibrating) {
        try { window.webgazer.pause(); } catch (_) {}
        try { window.webgazer.showVideoPreview(false); } catch (_) {}
      }
      if (targetRef.current) {
        resetProgress(targetRef.current);
        targetRef.current = null;
      }
    }
  }, [isActive, isScriptLoaded, isCalibrating]);

  return { isActive, isCalibrating, startCalibration, finishCalibration, deactivate, isScriptLoaded };
}

function resetProgress(el: HTMLElement) {
  const bar = el.querySelector('.gaze-progress-bar') as HTMLElement;
  if (bar) bar.style.width = '0%';
}

function updateProgress(el: HTMLElement, progress: number) {
  const bar = el.querySelector('.gaze-progress-bar') as HTMLElement;
  if (bar) bar.style.width = `${progress * 100}%`;
}
