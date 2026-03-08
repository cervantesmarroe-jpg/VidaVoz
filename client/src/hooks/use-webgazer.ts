import { useState, useEffect, useCallback, useRef } from 'react';
import { create } from 'zustand';

interface WebGazerState {
  isActive: boolean;
  isCalibrating: boolean;
  toggleActive: () => void;
  setCalibrating: (val: boolean) => void;
}

export const useWebGazerStore = create<WebGazerState>((set) => ({
  isActive: false,
  isCalibrating: false,
  toggleActive: () => set((state) => ({ isActive: !state.isActive })),
  setCalibrating: (val) => set({ isCalibrating: val }),
}));

// Declare global webgazer type for TS
declare global {
  interface Window {
    webgazer: any;
  }
}

const DWELL_TIME_MS = 2000; // 2 seconds to click

export function useWebGazer() {
  const { isActive, toggleActive, isCalibrating, setCalibrating } = useWebGazerStore();
  const [isScriptLoaded, setIsScriptLoaded] = useState(false);
  
  // Refs to maintain state inside the high-frequency listener
  const targetRef = useRef<HTMLElement | null>(null);
  const startTimeRef = useRef<number>(0);
  const clickCooldownRef = useRef<boolean>(false);

  // 1. Inject the WebGazer script
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
      setIsScriptLoaded(true);
      // Setup webgazer options
      window.webgazer.params.showVideoPreview = true;
      window.webgazer.params.showFaceOverlay = false;
      window.webgazer.params.showFaceFeedbackBox = true;
    };
    document.body.appendChild(script);

    // Create custom cursor element
    const cursor = document.createElement('div');
    cursor.id = 'gaze-cursor';
    document.body.appendChild(cursor);

    return () => {
      const cursorEl = document.getElementById('gaze-cursor');
      if (cursorEl) cursorEl.remove();
    };
  }, []);

  // Reset visual progress bar on a target
  const resetProgress = (el: HTMLElement) => {
    const bar = el.querySelector('.gaze-progress-bar') as HTMLElement;
    if (bar) bar.style.width = '0%';
  };

  // Update visual progress bar
  const updateProgress = (el: HTMLElement, progress: number) => {
    const bar = el.querySelector('.gaze-progress-bar') as HTMLElement;
    if (bar) bar.style.width = `${progress * 100}%`;
  };

  // 2. Handle Activation / Deactivation
  useEffect(() => {
    if (!isScriptLoaded || !window.webgazer) return;

    if (isActive) {
      const cursorElement = document.getElementById('gaze-cursor');
      if (cursorElement) cursorElement.style.display = 'block';
      
      window.webgazer.setGazeListener((data: any, elapsedTime: number) => {
        if (!data) return;

        const x = data.x;
        const y = data.y;

        const cursor = document.getElementById('gaze-cursor');
        if (cursor) {
          cursor.style.transform = `translate(${x}px, ${y}px) rotate(45deg)`;
        }

        // Temporarily hide cursor to find what's underneath
        if (cursor) cursor.style.display = 'none';
        const elUnderCursor = document.elementFromPoint(x, y) as HTMLElement;
        if (cursor) cursor.style.display = 'block';

        const target = elUnderCursor?.closest('[data-gaze-target="true"]') as HTMLElement;

        if (target) {
          if (target !== targetRef.current) {
            // Looking at a new target
            if (targetRef.current) resetProgress(targetRef.current);
            targetRef.current = target;
            startTimeRef.current = elapsedTime;
            clickCooldownRef.current = false;
          } else if (!clickCooldownRef.current) {
            // Continuing to look at the same target
            const duration = elapsedTime - startTimeRef.current;
            const progress = Math.min(duration / DWELL_TIME_MS, 1);
            
            updateProgress(target, progress);

            if (progress >= 1) {
              // Trigger the click!
              target.click();
              resetProgress(target);
              clickCooldownRef.current = true; // Wait until they look away
              
              // Optional visual feedback on click
              target.style.transform = 'scale(0.95)';
              setTimeout(() => { target.style.transform = ''; }, 150);
            }
          }
        } else {
          // Looked away from any target
          if (targetRef.current) {
            resetProgress(targetRef.current);
            targetRef.current = null;
          }
        }
      }).begin();

      window.webgazer.showVideoPreview(true);

    } else {
      // Deactivate
      const cursorElement = document.getElementById('gaze-cursor');
      if (cursorElement) cursorElement.style.display = 'none';
      if (window.webgazer && typeof window.webgazer.pause === 'function') {
        window.webgazer.pause();
        window.webgazer.showVideoPreview(false);
      }
      
      if (targetRef.current) {
        resetProgress(targetRef.current);
        targetRef.current = null;
      }
    }

    return () => {
      // Cleanup happens inside else block mostly
    };
  }, [isActive, isScriptLoaded]);

  return { isActive, toggleActive, isScriptLoaded };
}
