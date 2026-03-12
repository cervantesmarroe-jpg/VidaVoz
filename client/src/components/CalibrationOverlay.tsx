import { useState, useCallback } from "react";
import { CheckCircle, Eye } from "lucide-react";
import { useWebGazerStore } from "@/hooks/use-webgazer";

const CLICKS_NEEDED = 5;

// 9 calibration points as percentages of screen (col%, row%)
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

export function CalibrationOverlay() {
  const { finishCalibration, deactivate } = useWebGazerStore();
  const [clicks, setClicks] = useState<number[]>(CALIBRATION_POINTS.map(() => 0));

  const totalClicks = clicks.reduce((a, b) => a + b, 0);
  const totalNeeded = CALIBRATION_POINTS.length * CLICKS_NEEDED;
  const allDone = clicks.every((c) => c >= CLICKS_NEEDED);
  const overallProgress = Math.round((totalClicks / totalNeeded) * 100);

  const handlePointClick = useCallback(
    (index: number, screenX: number, screenY: number) => {
      if (clicks[index] >= CLICKS_NEEDED) return;

      // Record this click position in WebGazer as calibration data
      try {
        if (window.webgazer) {
          window.webgazer.recordScreenPosition(screenX, screenY, 'click');
        }
      } catch (_) {}

      setClicks((prev) => {
        const next = [...prev];
        next[index] = Math.min(next[index] + 1, CLICKS_NEEDED);
        return next;
      });
    },
    [clicks]
  );

  return (
    <div className="fixed inset-0 z-[9999] bg-stone-900/95 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-8 pt-8 pb-4">
        <div className="flex items-center gap-4">
          <Eye className="w-10 h-10 text-teal-400" />
          <div>
            <h2 className="text-3xl font-black text-white tracking-wide">
              Calibración de Mirada
            </h2>
            <p className="text-xl text-stone-300 mt-1">
              Mire cada punto y púlselo <strong className="text-teal-300">{CLICKS_NEEDED} veces</strong> hasta que se vuelva verde
            </p>
          </div>
        </div>
        <button
          onClick={deactivate}
          className="text-stone-400 hover:text-white text-xl font-bold px-6 py-3 rounded-2xl border-2 border-stone-600 hover:border-stone-400 transition-colors"
        >
          CANCELAR
        </button>
      </div>

      {/* Progress bar */}
      <div className="px-8 pb-4">
        <div className="flex items-center gap-4">
          <div className="flex-1 h-4 bg-stone-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-teal-400 rounded-full transition-all duration-300"
              style={{ width: `${overallProgress}%` }}
            />
          </div>
          <span className="text-2xl font-bold text-teal-300 w-20 text-right">
            {overallProgress}%
          </span>
        </div>
      </div>

      {/* Calibration area */}
      <div className="flex-1 relative">
        {CALIBRATION_POINTS.map((point, index) => {
          const count = clicks[index];
          const done = count >= CLICKS_NEEDED;
          const progress = count / CLICKS_NEEDED;

          return (
            <button
              key={point.id}
              onClick={(e) => {
                const rect = (e.target as HTMLElement).getBoundingClientRect();
                const cx = rect.left + rect.width / 2;
                const cy = rect.top + rect.height / 2;
                handlePointClick(index, cx, cy);
              }}
              style={{
                position: 'absolute',
                left: `${point.x}%`,
                top: `${point.y}%`,
                transform: 'translate(-50%, -50%)',
              }}
              className={`
                w-24 h-24 md:w-28 md:h-28 rounded-full flex items-center justify-center
                transition-all duration-200 active:scale-90 focus:outline-none
                border-4 shadow-2xl
                ${done
                  ? 'bg-teal-500 border-teal-300 scale-110'
                  : 'bg-stone-700 border-amber-400 hover:border-amber-300 hover:bg-stone-600'
                }
              `}
            >
              {done ? (
                <CheckCircle className="w-12 h-12 text-white" />
              ) : (
                <div className="flex flex-col items-center gap-1">
                  {/* Mini progress ring using conic-gradient */}
                  <div
                    className="w-12 h-12 rounded-full flex items-center justify-center text-white font-black text-xl"
                    style={{
                      background: `conic-gradient(#f59e0b ${progress * 360}deg, #44403c ${progress * 360}deg)`,
                    }}
                  >
                    <div className="w-9 h-9 rounded-full bg-stone-700 flex items-center justify-center text-lg font-black text-amber-400">
                      {CLICKS_NEEDED - count}
                    </div>
                  </div>
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Footer: Finish button */}
      {allDone && (
        <div className="px-8 pb-10 flex justify-center">
          <button
            onClick={finishCalibration}
            className="bg-teal-500 hover:bg-teal-400 text-white font-black text-3xl md:text-4xl px-16 py-6 rounded-3xl shadow-2xl flex items-center gap-4 transition-all active:scale-95"
          >
            <Eye className="w-10 h-10" />
            ACTIVAR SEGUIMIENTO DE MIRADA
          </button>
        </div>
      )}

      {!allDone && (
        <div className="px-8 pb-8 text-center">
          <p className="text-stone-400 text-xl">
            Quedan{" "}
            <span className="text-amber-400 font-bold text-2xl">
              {totalNeeded - totalClicks}
            </span>{" "}
            pulsaciones para completar la calibración
          </p>
        </div>
      )}
    </div>
  );
}
