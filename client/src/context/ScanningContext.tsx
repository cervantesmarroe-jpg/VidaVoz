// ─── Modo de Escaneo Secuencial — VidaVoz ─────────────────────────────────────
//
// Cicla por todos los elementos [data-gaze-target="true"] visibles,
// resaltándolos uno a uno con un intervalo configurable. Tres métodos
// de activación (todos manejados FUERA de este contexto, en FullscreenLayout):
//   1. Toque en cualquier parte de la pantalla
//   2. Pulsador externo Bluetooth (simula toque → cubierto por el punto 1)
//   3. Parpadeo sostenido >500 ms (captado por use-webgazer.ts)
//
// Al activar cualquiera de los tres, el elemento resaltado en ese instante
// recibe un `.click()` sintético y el cursor avanza al siguiente.
// ─────────────────────────────────────────────────────────────────────────────
import {
  createContext, useContext, useState, useRef,
  useCallback, useEffect, type ReactNode,
} from 'react';

export const SCAN_INTERVAL_MIN_S = 1;
export const SCAN_INTERVAL_MAX_S = 5;
const DEFAULT_MS = 2000;

interface ScanningCtx {
  active:        boolean;
  intervalMs:    number;
  enable:        (ms?: number) => void;
  disable:       () => void;
  activate:      () => void;
  setIntervalMs: (ms: number) => void;
}

const Ctx = createContext<ScanningCtx | null>(null);

// Devuelve los elementos gaze-target visibles en el DOM en este momento.
// Se llama en cada avance para reflejar el contenido de la pestaña activa.
function getTargets(): HTMLElement[] {
  return Array.from(
    document.querySelectorAll<HTMLElement>('[data-gaze-target="true"]'),
  ).filter(el => {
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  });
}

function applyHighlight(targets: HTMLElement[], idx: number) {
  document.querySelectorAll<HTMLElement>('.scan-focus')
    .forEach(el => el.classList.remove('scan-focus'));
  if (targets.length > 0) {
    targets[idx % targets.length]?.classList.add('scan-focus');
  }
}

export function ScanningProvider({ children }: { children: ReactNode }) {
  const [active, setActive]   = useState(false);
  const [intervalMs, setIval] = useState(DEFAULT_MS);
  const idxRef   = useRef(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopTimer = useCallback(() => {
    if (timerRef.current !== null) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const startTimer = useCallback((ms: number) => {
    stopTimer();
    const targets = getTargets();
    idxRef.current = 0;
    applyHighlight(targets, 0);
    timerRef.current = setInterval(() => {
      const tgts = getTargets();
      if (tgts.length === 0) return;
      idxRef.current = (idxRef.current + 1) % tgts.length;
      applyHighlight(tgts, idxRef.current);
    }, ms);
  }, [stopTimer]);

  const enable = useCallback((ms?: number) => {
    const effective = ms ?? intervalMs;
    setIval(effective);
    setActive(true);
    startTimer(effective);
  }, [intervalMs, startTimer]);

  const disable = useCallback(() => {
    setActive(false);
    stopTimer();
    document.querySelectorAll('.scan-focus').forEach(el => el.classList.remove('scan-focus'));
  }, [stopTimer]);

  // Activa el elemento resaltado actualmente, luego avanza al siguiente.
  // Llamado desde FullscreenLayout al recibir toque o parpadeo.
  const activate = useCallback(() => {
    const targets = getTargets();
    if (!targets.length) return;
    const el = targets[idxRef.current % targets.length];
    el?.click();
    idxRef.current = (idxRef.current + 1) % targets.length;
    applyHighlight(targets, idxRef.current);
  }, []);

  const setIntervalMs = useCallback((ms: number) => {
    setIval(ms);
    if (active) startTimer(ms);
  }, [active, startTimer]);

  useEffect(() => {
    return () => {
      stopTimer();
      document.querySelectorAll('.scan-focus').forEach(el => el.classList.remove('scan-focus'));
    };
  }, [stopTimer]);

  return (
    <Ctx.Provider value={{ active, intervalMs, enable, disable, activate, setIntervalMs }}>
      {children}
    </Ctx.Provider>
  );
}

export function useScanning(): ScanningCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useScanning fuera de ScanningProvider');
  return ctx;
}
