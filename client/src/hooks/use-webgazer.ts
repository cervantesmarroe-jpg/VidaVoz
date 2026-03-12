import { useState, useEffect, useRef } from 'react';
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

  // Activate gaze listener when isActive is true
  // Uses WebGazer if available, otherwise does nothing (graceful degradation)
  useEffect(() => {
    const cursorEl = document.getElementById('gaze-cursor');

    if (!isActive) {
      if (cursorEl) cursorEl.style.display = 'none';
      if (targetRef.current) {
        resetProgress(targetRef.current);
        targetRef.current = null;
      }
      try { window.webgazer?.clearGazeListener?.(); } catch (_) {}
      if (!isCalibrating) {
        try { window.webgazer?.pause?.(); } catch (_) {}
        try { window.webgazer?.showVideoPreview?.(false); } catch (_) {}
      }
      return;
    }

    // isActive is true — try to attach WebGazer gaze listener
    if (!window.webgazer) return;

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
      console.warn('WebGazer gaze listener error (non-fatal):', e);
    }
  }, [isActive, isCalibrating]);

  return {
    isActive,
    isCalibrating,
    startCalibration,
    finishCalibration,
    deactivate,
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
