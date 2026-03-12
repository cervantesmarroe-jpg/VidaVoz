import { useState, useEffect, useCallback } from "react";
import { CheckCircle, Eye, Camera, CameraOff, Loader2 } from "lucide-react";
import { useWebGazerStore, gazeTracker } from "@/hooks/use-webgazer";

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

type CameraStatus = 'loading' | 'active' | 'denied';

export function CalibrationOverlay() {
  const { finishCalibration, deactivate } = useWebGazerStore();
  const [clicks, setClicks]     = useState<number[]>(CALIBRATION_POINTS.map(() => 0));
  const [lastClicked, setLastClicked] = useState<number | null>(null);
  const [cameraStatus, setCameraStatus] = useState<CameraStatus>('loading');

  // Wire up GazeTracker camera status callbacks
  useEffect(() => {
    gazeTracker.onCameraReady = () => setCameraStatus('active');
    gazeTracker.onCameraError = () => setCameraStatus('denied');
    return () => {
      gazeTracker.onCameraReady = null;
      gazeTracker.onCameraError = null;
    };
  }, []);

  const totalClicks = clicks.reduce((a, b) => a + b, 0);
  const totalNeeded = CALIBRATION_POINTS.length * CLICKS_NEEDED;
  const allDone     = clicks.every((c) => c >= CLICKS_NEEDED);
  const progress    = Math.round((totalClicks / totalNeeded) * 100);

  const handlePointClick = useCallback((index: number, clientX: number, clientY: number) => {
    setLastClicked(index);
    setTimeout(() => setLastClicked(null), 220);

    setClicks((prev) => {
      if (prev[index] >= CLICKS_NEEDED) return prev;
      const next = [...prev];
      next[index]++;
      return next;
    });

    // Record current eye position for this screen coordinate
    gazeTracker.recordCalibrationPoint(clientX, clientY);
  }, []);

  const handleFinish = useCallback(() => {
    gazeTracker.computeCalibration();
    finishCalibration();
  }, [finishCalibration]);

  const statusBadge = {
    loading: {
      label: 'Iniciando IA de mirada…',
      icon:  <Loader2 className="w-4 h-4 animate-spin" />,
      cls:   'bg-stone-800 text-stone-300',
    },
    active: {
      label: 'Cámara activa — MediaPipe AI',
      icon:  <Camera className="w-4 h-4" />,
      cls:   'bg-teal-900/60 text-teal-300',
    },
    denied: {
      label: 'Cámara no disponible',
      icon:  <CameraOff className="w-4 h-4" />,
      cls:   'bg-rose-900/50 text-rose-300',
    },
  }[cameraStatus];

  return (
    <div className="fixed inset-0 z-[9999] bg-stone-900/96 flex flex-col select-none">

      {/* Header */}
      <div className="flex items-center justify-between px-6 pt-5 pb-2 shrink-0">
        <div className="flex items-center gap-3">
          <Eye className="w-9 h-9 text-teal-400 shrink-0" />
          <div>
            <h2 className="text-2xl md:text-3xl font-black text-white">
              Calibración de Mirada
            </h2>
            <p className="text-base text-stone-300">
              Mire cada punto y púlselo{" "}
              <strong className="text-teal-300">{CLICKS_NEEDED} veces</strong>{" "}
              hasta que se ponga verde
            </p>
          </div>
        </div>
        <button
          onClick={deactivate}
          className="text-stone-400 hover:text-white font-bold px-4 py-3 rounded-2xl border-2 border-stone-600 hover:border-stone-400 transition-colors text-base shrink-0 ml-4"
        >
          CANCELAR
        </button>
      </div>

      {/* Status badge + progress bar */}
      <div className="px-6 pb-3 shrink-0 flex items-center gap-3">
        <span className={`flex items-center gap-2 text-sm font-semibold px-3 py-1.5 rounded-full shrink-0 ${statusBadge.cls}`}>
          {statusBadge.icon} {statusBadge.label}
        </span>
        <div className="flex-1 h-3 bg-stone-700 rounded-full overflow-hidden">
          <div
            className="h-full bg-teal-400 rounded-full transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
        <span className="text-lg font-bold text-teal-300 w-12 text-right shrink-0">
          {progress}%
        </span>
      </div>

      {/* 9 calibration dots */}
      <div className="flex-1 relative">
        {CALIBRATION_POINTS.map((pt, idx) => {
          const count    = clicks[idx];
          const done     = count >= CLICKS_NEEDED;
          const fraction = count / CLICKS_NEEDED;
          const popped   = lastClicked === idx;

          return (
            <button
              key={pt.id}
              data-testid={`calibration-dot-${idx}`}
              onPointerDown={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                handlePointClick(
                  idx,
                  rect.left + rect.width / 2,
                  rect.top  + rect.height / 2
                );
              }}
              style={{
                position:  'absolute',
                left:      `${pt.x}%`,
                top:       `${pt.y}%`,
                transform: `translate(-50%, -50%) scale(${popped ? 0.78 : done ? 1.15 : 1})`,
                transition: 'transform 0.15s ease, box-shadow 0.15s',
              }}
              className={[
                'w-20 h-20 md:w-24 md:h-24 rounded-full flex items-center justify-center',
                'focus:outline-none border-4 shadow-2xl touch-manipulation',
                done
                  ? 'bg-teal-500 border-teal-300'
                  : 'bg-stone-700 border-amber-400 hover:bg-stone-600 active:bg-stone-500',
              ].join(' ')}
            >
              {done ? (
                <CheckCircle className="w-10 h-10 text-white" />
              ) : (
                <div
                  className="w-11 h-11 rounded-full flex items-center justify-center"
                  style={{
                    background: `conic-gradient(#f59e0b ${fraction * 360}deg, #44403c ${fraction * 360}deg)`,
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
            onClick={handleFinish}
            data-testid="button-finish-calibration"
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
