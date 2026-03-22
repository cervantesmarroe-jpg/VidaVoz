import {
  createContext,
  useContext,
  useState,
  useEffect,
  useRef,
  useCallback,
  ReactNode,
} from "react";

const SCAN_INTERVAL_MS = 2000;

interface ScanningContextType {
  isScanningMode: boolean;
  activateScanning: () => void;
  deactivateScanning: () => void;
}

const ScanningContext = createContext<ScanningContextType>({
  isScanningMode: false,
  activateScanning: () => {},
  deactivateScanning: () => {},
});

function getVisibleTargets(): HTMLElement[] {
  return Array.from(
    document.querySelectorAll<HTMLElement>('[data-gaze-target="true"]')
  ).filter((el) => {
    const rect = el.getBoundingClientRect();
    return (
      rect.width > 0 &&
      rect.height > 0 &&
      rect.top < window.innerHeight &&
      rect.bottom > 0 &&
      rect.left < window.innerWidth &&
      rect.right > 0
    );
  });
}

function clearAllHighlights() {
  document.querySelectorAll(".scanning-highlight").forEach((el) => {
    el.classList.remove("scanning-highlight");
  });
}

export function ScanningProvider({ children }: { children: ReactNode }) {
  const [isScanningMode, setIsScanningMode] = useState(false);
  const currentIndexRef = useRef(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const step = useCallback(() => {
    const targets = getVisibleTargets();
    if (targets.length === 0) return;

    clearAllHighlights();

    if (currentIndexRef.current >= targets.length) {
      currentIndexRef.current = 0;
    }

    targets[currentIndexRef.current].classList.add("scanning-highlight");
    currentIndexRef.current = (currentIndexRef.current + 1) % targets.length;
  }, []);

  const handlePointerDown = useCallback(
    (e: Event) => {
      if (!isScanningMode) return;
      const highlighted = document.querySelector<HTMLElement>(".scanning-highlight");
      if (!highlighted) return;

      const target = e.target as Element;
      if (highlighted.contains(target)) return;

      e.preventDefault();
      e.stopPropagation();
      highlighted.click();
    },
    [isScanningMode]
  );

  useEffect(() => {
    if (!isScanningMode) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      clearAllHighlights();
      currentIndexRef.current = 0;
      return;
    }

    step();
    intervalRef.current = setInterval(step, SCAN_INTERVAL_MS);

    document.addEventListener("pointerdown", handlePointerDown, { capture: true });
    document.addEventListener("touchstart", handlePointerDown, {
      capture: true,
      passive: false,
    } as EventListenerOptions);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      clearAllHighlights();
      document.removeEventListener("pointerdown", handlePointerDown, { capture: true });
      document.removeEventListener("touchstart", handlePointerDown, { capture: true });
    };
  }, [isScanningMode, step, handlePointerDown]);

  const activateScanning = useCallback(() => setIsScanningMode(true), []);
  const deactivateScanning = useCallback(() => setIsScanningMode(false), []);

  return (
    <ScanningContext.Provider value={{ isScanningMode, activateScanning, deactivateScanning }}>
      {children}
    </ScanningContext.Provider>
  );
}

export function useScanning() {
  return useContext(ScanningContext);
}
