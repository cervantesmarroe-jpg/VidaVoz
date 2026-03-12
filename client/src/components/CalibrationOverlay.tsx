import { useState, useEffect } from "react";
import { CheckCircle, Eye, Camera, CameraOff, MousePointer2 } from "lucide-react";
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

type CameraStatus = 'checking' | 'active' | 'denied' | 'unavailable';

export function CalibrationOverlay() {
  const { finishCalibration, deactivate } = useWebGazerStore();
  const [clicks, setClicks] = useState<number[]>(CALIBRATION_POINTS.map(() => 0));
  const [lastClicked, setLastClicked] = useState<number | null>(null);
  const [cameraStatus, setCameraStatus] = useState<CameraStatus>('checking');

  // Detect whether WebGazer + camera is working
  useEffect(() => {
    const wg = window.webgazer;
    if (!wg) { setCameraStatus('unavailable'); return; }

    // WebGazer was already started by the calibration effect in use-webgazer.
    // Poll briefly to see if camera stream was obtained.
    const timer = setTimeout(() => {
      try {
        const video = document.querySelector('#webgazerVideoContainer video') as HTMLVideoElement;
        if (video && video.readyState >= 2) {
          setCameraStatus('active');
        } else {
          setCameraStatus('denied');
        }
      } catch (_) {
        setCameraStatus('denied');
      }
    }, 1500);

    return () => clearTimeout(timer);
  }, []);

  const totalClicks = clicks.reduce((a, b) => a + b, 0);
  const totalNeeded = CALIBRATION_POINTS.length * CLICKS_NEEDED;
  const allDone = clicks.every((c) => c >= CLICKS_NEEDED);
  const overallProgress = Math.round((totalClicks / totalNeeded) * 100);

  const handlePointClick = (index: number, screenX: number, screenY: number) => {
    setLastClicked(index);
    setTimeout(() => setLastClicked(null), 250);

    setClicks((prev) => {
      if (prev[index] >= CLICKS_NEEDED) return prev;
      const next = [...prev];
      next[index] = next[index] + 1;
      return next;
    });

    // Record calibration data in WebGazer
    try { window.webgazer?.recordScreenPosition?.(screenX, screenY, 'click'); } catch (_) {}
  };

  const statusConfig = {
    checking:    { label: 'Iniciando cámara…',         icon: <Camera className="w-4 h-4 animate-pulse" />, color: 'bg-stone-800 text-stone-300' },
    active:      { label: 'Cámara activa — eye tracking ON', icon: <Camera className="w-4 h-4" />, color: 'bg-teal-900/60 text-teal-300' },
    denied:      { label: 'Cámara no disponible — modo puntero', icon: <CameraOff className="w-4 h-4" />, color: 'bg-amber-900/50 text-amber-300' },
    unavailable: { label: 'Modo puntero (sin cámara)',  icon: <MousePointer2 className="w-4 h-4" />, color: 'bg-stone-800 text-stone-300' },
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

      {/* Camera status + progress */}
      <div className="px-6 pb-3 shrink-0 flex items-center gap-3">
        <span className={`flex items-center gap-2 text-sm font-semibold px-3 py-1.5 rounded-full shrink-0 ${statusConfig.color}`}>
          {statusConfig.icon} {statusConfig.label}
        </span>
        <div className="flex-1 h-3 bg-stone-700 rounded-full overflow-hidden">
          <div
            className="h-full bg-teal-400 rounded-full transition-all duration-300"
            style={{ width: `${overallProgress}%` }}
          />
        </div>
        <span className="text-lg font-bold text-teal-300 w-12 text-right shrink-0">
          {overallProgress}%
        </span>
      </div>

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
                const rect = e.currentTarget.getBoundingClientRect();
                handlePointClick(
                  index,
                  rect.left + rect.width / 2,
                  rect.top + rect.height / 2
                );
              }}
              style={{
                position: 'absolute',
                left: `${point.x}%`,
                top: `${point.y}%`,
                transform: `translate(-50%, -50%) scale(${justClicked ? 0.8 : done ? 1.15 : 1})`,
                transition: 'transform 0.15s ease',
              }}
              className={`
                w-20 h-20 md:w-24 md:h-24 rounded-full flex items-center justify-center
                focus:outline-none border-4 shadow-2xl touch-manipulation
                ${done
                  ? 'bg-teal-500 border-teal-300'
                  : 'bg-stone-700 border-amber-400 hover:bg-stone-600 active:bg-stone-500'
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
