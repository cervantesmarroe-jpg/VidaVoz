import { useState, useCallback, useEffect } from "react";
import { CheckCircle, Eye, Camera, CameraOff, AlertTriangle } from "lucide-react";
import { useWebGazerStore } from "@/hooks/use-webgazer";

const CLICKS_NEEDED = 5;

const CALIBRATION_POINTS = [
  { id: 0, x: 10, y: 15 },
  { id: 1, x: 50, y: 15 },
  { id: 2, x: 90, y: 15 },
  { id: 3, x: 10, y: 50 },
  { id: 4, x: 50, y: 50 },
  { id: 5, x: 90, y: 50 },
  { id: 6, x: 10, y: 85 },
  { id: 7, x: 50, y: 85 },
  { id: 8, x: 90, y: 85 },
];

type CameraStatus = 'loading' | 'ok' | 'denied' | 'unavailable';

export function CalibrationOverlay() {
  const { finishCalibration, deactivate } = useWebGazerStore();
  const [clicks, setClicks] = useState<number[]>(CALIBRATION_POINTS.map(() => 0));
  const [lastClicked, setLastClicked] = useState<number | null>(null);
  const [cameraStatus, setCameraStatus] = useState<CameraStatus>('loading');

  // Request camera permission directly to give user feedback
  useEffect(() => {
    let cancelled = false;
    navigator.mediaDevices?.getUserMedia({ video: true })
      .then((stream) => {
        if (cancelled) { stream.getTracks().forEach(t => t.stop()); return; }
        setCameraStatus('ok');
        stream.getTracks().forEach(t => t.stop()); // release immediately, WebGazer will open its own

        // Now try starting WebGazer since camera is available
        startWebGazer();
      })
      .catch(() => {
        if (!cancelled) setCameraStatus('denied');
      });

    return () => { cancelled = true; };
  }, []);

  const totalClicks = clicks.reduce((a, b) => a + b, 0);
  const totalNeeded = CALIBRATION_POINTS.length * CLICKS_NEEDED;
  const allDone = clicks.every((c) => c >= CLICKS_NEEDED);
  const overallProgress = Math.round((totalClicks / totalNeeded) * 100);

  const handlePointClick = useCallback(
    (index: number, screenX: number, screenY: number) => {
      setLastClicked(index);
      setTimeout(() => setLastClicked(null), 300);

      setClicks((prev) => {
        if (prev[index] >= CLICKS_NEEDED) return prev;
        const next = [...prev];
        next[index] = next[index] + 1;
        return next;
      });

      try { window.webgazer?.recordScreenPosition?.(screenX, screenY, 'click'); } catch (_) {}
    },
    []
  );

  const cameraLabel = {
    loading: 'Solicitando cámara…',
    ok: 'Cámara activa',
    denied: 'Sin acceso a cámara — solo táctil',
    unavailable: 'Cámara no disponible',
  }[cameraStatus];

  const cameraIcon = cameraStatus === 'ok'
    ? <Camera className="w-5 h-5" />
    : cameraStatus === 'loading'
    ? <Camera className="w-5 h-5 animate-pulse" />
    : <CameraOff className="w-5 h-5" />;

  return (
    <div className="fixed inset-0 z-[9999] bg-stone-900/95 flex flex-col select-none">

      {/* Header */}
      <div className="flex items-center justify-between px-6 pt-6 pb-3 shrink-0">
        <div className="flex items-center gap-3">
          <Eye className="w-9 h-9 text-teal-400 shrink-0" />
          <div>
            <h2 className="text-2xl md:text-3xl font-black text-white">
              Calibración de Mirada
            </h2>
            <p className="text-lg text-stone-300">
              Pulse cada punto <strong className="text-teal-300">{CLICKS_NEEDED} veces</strong> hasta que se ponga verde
            </p>
          </div>
        </div>
        <button
          onClick={deactivate}
          className="text-stone-400 hover:text-white font-bold px-5 py-3 rounded-2xl border-2 border-stone-600 hover:border-stone-400 transition-colors text-lg shrink-0 ml-4"
        >
          CANCELAR
        </button>
      </div>

      {/* Camera status + progress bar */}
      <div className="px-6 pb-3 shrink-0 flex items-center gap-4">
        <span className={`flex items-center gap-2 text-sm font-semibold px-3 py-1 rounded-full ${
          cameraStatus === 'ok' ? 'bg-teal-900/60 text-teal-300' :
          cameraStatus === 'loading' ? 'bg-stone-800 text-stone-300' :
          'bg-amber-900/60 text-amber-300'
        }`}>
          {cameraIcon} {cameraLabel}
        </span>
        <div className="flex-1 h-3 bg-stone-700 rounded-full overflow-hidden">
          <div
            className="h-full bg-teal-400 rounded-full transition-all duration-300"
            style={{ width: `${overallProgress}%` }}
          />
        </div>
        <span className="text-xl font-bold text-teal-300 w-14 text-right">
          {overallProgress}%
        </span>
      </div>

      {/* Camera denied warning */}
      {(cameraStatus === 'denied' || cameraStatus === 'unavailable') && (
        <div className="mx-6 mb-3 bg-amber-900/40 border border-amber-500/50 rounded-2xl px-4 py-3 flex items-start gap-3 shrink-0">
          <AlertTriangle className="w-6 h-6 text-amber-400 shrink-0 mt-0.5" />
          <p className="text-amber-200 text-base leading-snug">
            Sin acceso a la cámara. Puede completar la calibración pulsando los puntos, pero el seguimiento de mirada no estará disponible. Abra la app en un navegador real con permiso de cámara para activar el eye-tracking.
          </p>
        </div>
      )}

      {/* Calibration dot area */}
      <div className="flex-1 relative">
        {CALIBRATION_POINTS.map((point, index) => {
          const count = clicks[index];
          const done = count >= CLICKS_NEEDED;
          const progress = count / CLICKS_NEEDED;
          const justClicked = lastClicked === index;

          return (
            <button
              key={point.id}
              onPointerDown={(e) => {
                e.currentTarget.setPointerCapture(e.pointerId);
                const rect = e.currentTarget.getBoundingClientRect();
                handlePointClick(index, rect.left + rect.width / 2, rect.top + rect.height / 2);
              }}
              style={{
                position: 'absolute',
                left: `${point.x}%`,
                top: `${point.y}%`,
                transform: `translate(-50%, -50%) scale(${justClicked ? 0.82 : done ? 1.12 : 1})`,
                transition: 'transform 0.15s ease, background-color 0.2s',
              }}
              className={`
                w-20 h-20 md:w-24 md:h-24 rounded-full flex items-center justify-center
                focus:outline-none border-4 shadow-2xl touch-manipulation
                ${done
                  ? 'bg-teal-500 border-teal-300'
                  : 'bg-stone-700 border-amber-400 hover:border-amber-200 active:bg-stone-600'
                }
              `}
            >
              {done ? (
                <CheckCircle className="w-10 h-10 text-white" />
              ) : (
                <div
                  className="w-11 h-11 rounded-full flex items-center justify-center"
                  style={{
                    background: `conic-gradient(#f59e0b ${progress * 360}deg, #44403c ${progress * 360}deg)`,
                  }}
                >
                  <div className="w-8 h-8 rounded-full bg-stone-700 flex items-center justify-center text-base font-black text-amber-400">
                    {CLICKS_NEEDED - count}
                  </div>
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Footer */}
      <div className="px-6 pb-8 shrink-0 text-center">
        {allDone ? (
          <button
            onClick={finishCalibration}
            className="bg-teal-500 hover:bg-teal-400 text-white font-black text-2xl md:text-3xl px-12 py-5 rounded-3xl shadow-2xl flex items-center gap-4 mx-auto transition-all active:scale-95"
          >
            <Eye className="w-8 h-8" />
            ACTIVAR SEGUIMIENTO DE MIRADA
          </button>
        ) : (
          <p className="text-stone-400 text-lg">
            Quedan{" "}
            <span className="text-amber-400 font-bold text-xl">{totalNeeded - totalClicks}</span>
            {" "}pulsaciones para completar
          </p>
        )}
      </div>
    </div>
  );
}

async function startWebGazer() {
  try {
    if (document.getElementById('webgazer-script')) return;
    Object.keys(localStorage)
      .filter((k) => k.toLowerCase().includes('webgazer'))
      .forEach((k) => localStorage.removeItem(k));

    await new Promise<void>((resolve, reject) => {
      const s = document.createElement('script');
      s.id = 'webgazer-script';
      s.src = 'https://webgazer.cs.brown.edu/webgazer.js';
      s.async = true;
      s.onload = () => resolve();
      s.onerror = () => reject();
      document.body.appendChild(s);
    });

    if (!window.webgazer) return;
    if (window.webgazer.params) {
      window.webgazer.params.showFaceOverlay = false;
      window.webgazer.params.showFaceFeedbackBox = true;
    }
    window.webgazer.showVideoPreview(true);
    window.webgazer.begin();
  } catch (_) {}
}
