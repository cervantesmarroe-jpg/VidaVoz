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
// Served locally so no CDN dependency and no cross-origin worker restrictions
const WG_URL = '/webgazer.js';

// ─── WebGazer bootstrap helpers ────────────────────────────────────────────

/** Delete WebGazer's IndexedDB databases so it starts fresh with no TF.js model data. */
async function purgeWebGazerStorage() {
  for (const name of ['WebGazerGazeData', 'webgazer', 'localforage']) {
    await new Promise<void>((res) => {
      try {
        const r = indexedDB.deleteDatabase(name);
        r.onsuccess = r.onerror = r.onblocked = () => res();
      } catch (_) { res(); }
    });
  }
}

/**
 * Wrap window.Worker with a Proxy so errors inside workers (e.g. TF.js workers
 * whose CDN URLs return HTML in restricted envs) are caught on the instance
 * and don't bubble to window.onerror / the runtime-error overlay.
 */
function installWorkerGuard() {
  if ((window as any).__workerGuardInstalled) return;
  (window as any).__workerGuardInstalled = true;

  const NativeWorker = window.Worker;
  (window as any).Worker = new Proxy(NativeWorker, {
    construct(Target, args: [string | URL, WorkerOptions?]) {
      const worker = new Target(...args);
      worker.addEventListener('error', (e: ErrorEvent) => {
        e.preventDefault?.();
        e.stopImmediatePropagation?.();
      });
      return worker;
    },
  });
}

/** Load the WebGazer script, configure it, and call begin(). */
async function loadAndBeginWebGazer(): Promise<void> {
  // Install Worker guard before anything so TF.js worker errors are swallowed
  installWorkerGuard();

  if (window.webgazer?.begin) {
    // Already loaded — just (re)configure and begin
    configureAndBegin();
    return;
  }

  // Purge stored calibration data to prevent TF.js model restore on init
  await purgeWebGazerStorage();

  return new Promise((resolve) => {
    const script = document.createElement('script');
    script.src = WG_URL;
    script.async = true;
    script.onload = () => { configureAndBegin(); resolve(); };
    script.onerror = () => {
      console.warn('WebGazer CDN load failed — pointer dwell-time will be used');
      resolve();
    };
    document.head.appendChild(script);
  });
}

function configureAndBegin() {
  try {
    const wg = window.webgazer;
    if (!wg) return;
    // 'ridge' = lightweight regression, NO TF.js workers for gaze prediction
    wg.setRegression('ridge');
    wg.params.saveDataAcrossSessions = false;
    wg.params.showFaceOverlay        = false;
    wg.params.showFaceFeedbackBox    = true;
    wg.showVideoPreview(true);
    wg.begin().catch?.(() => {});   // .catch ensures promise rejection is handled
  } catch (e) {
    console.warn('WebGazer begin (non-fatal):', e);
  }
}

// ─── React hook ─────────────────────────────────────────────────────────────

export function useWebGazer() {
  const { isActive, isCalibrating, startCalibration, finishCalibration, deactivate } =
    useWebGazerStore();

  const targetRef    = useRef<HTMLElement | null>(null);
  const enterTimeRef = useRef<number>(0);
  const rafRef       = useRef<number>(0);
  const posRef       = useRef<{ x: number; y: number } | null>(null);
  const cooldownRef  = useRef<boolean>(false);

  // Create gaze cursor element once
  useEffect(() => {
    if (!document.getElementById('gaze-cursor')) {
      const el = document.createElement('div');
      el.id = 'gaze-cursor';
      document.body.appendChild(el);
    }
    return () => { document.getElementById('gaze-cursor')?.remove(); };
  }, []);

  // Load + start WebGazer when calibration begins
  useEffect(() => {
    if (!isCalibrating) return;
    loadAndBeginWebGazer().catch(() => {});
  }, [isCalibrating]);

  // Pause camera when neither calibrating nor active
  useEffect(() => {
    if (isCalibrating || isActive) return;
    try {
      window.webgazer?.showVideoPreview?.(false);
      window.webgazer?.pause?.();
    } catch (_) {}
  }, [isCalibrating, isActive]);

  // Dwell tracking when active
  useEffect(() => {
    const cursor = document.getElementById('gaze-cursor');

    if (!isActive) {
      if (cursor) cursor.style.display = 'none';
      cancelAnimationFrame(rafRef.current);
      try { window.webgazer?.setGazeListener?.(null); } catch (_) {}
      if (targetRef.current) { resetProgress(targetRef.current); targetRef.current = null; }
      return;
    }

    if (cursor) cursor.style.display = 'block';

    if (window.webgazer?.setGazeListener) {
      // ── WebGazer eye-tracking ─────────────────────────────────────────────
      try {
        window.webgazer.setGazeListener((data: any, elapsed: number) => {
          if (!data) return;
          const { x, y } = data as { x: number; y: number };

          const c = document.getElementById('gaze-cursor');
          if (c) c.style.transform =
            `translate(calc(${x}px - 50%), calc(${y}px - 50%)) rotate(45deg)`;

          // Temporarily hide cursor so hit-test finds the element underneath
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
        try { window.webgazer?.setGazeListener?.(null); } catch (_) {}
      };
    } else {
      // ── Pointer / touch fallback ──────────────────────────────────────────
      const onMove = (e: PointerEvent) => {
        posRef.current = { x: e.clientX, y: e.clientY };
      };
      window.addEventListener('pointermove', onMove);

      const tick = () => {
        if (posRef.current) {
          const { x, y } = posRef.current;
          const el  = document.elementFromPoint(x, y) as HTMLElement | null;
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

  /** Shared dwell logic for both WebGazer and pointer paths */
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

// ─── DOM helpers ────────────────────────────────────────────────────────────

function resetProgress(el: HTMLElement) {
  const bar = el.querySelector('.gaze-progress-bar') as HTMLElement | null;
  if (bar) bar.style.width = '0%';
}

function updateProgress(el: HTMLElement, progress: number) {
  const bar = el.querySelector('.gaze-progress-bar') as HTMLElement | null;
  if (bar) bar.style.width = `${progress * 100}%`;
}
