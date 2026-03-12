import { useState } from "react";
import { CheckCircle, Eye, MousePointer2, Clock, Hand } from "lucide-react";
import { useWebGazerStore } from "@/hooks/use-webgazer";

const CLICKS_NEEDED = 3;

const CALIBRATION_POINTS = [
  { id: 0, x: 10, y: 20 },
  { id: 1, x: 50, y: 20 },
  { id: 2, x: 90, y: 20 },
  { id: 3, x: 10, y: 55 },
  { id: 4, x: 50, y: 55 },
  { id: 5, x: 90, y: 55 },
  { id: 6, x: 10, y: 88 },
  { id: 7, x: 50, y: 88 },
  { id: 8, x: 90, y: 88 },
];

export function CalibrationOverlay() {
  const { finishCalibration, deactivate } = useWebGazerStore();
  const [clicks, setClicks] = useState<number[]>(CALIBRATION_POINTS.map(() => 0));
  const [lastClicked, setLastClicked] = useState<number | null>(null);

  const totalClicks = clicks.reduce((a, b) => a + b, 0);
  const totalNeeded = CALIBRATION_POINTS.length * CLICKS_NEEDED;
  const allDone = clicks.every((c) => c >= CLICKS_NEEDED);
  const overallProgress = Math.round((totalClicks / totalNeeded) * 100);

  const handlePointClick = (index: number) => {
    setLastClicked(index);
    setTimeout(() => setLastClicked(null), 250);
    setClicks((prev) => {
      if (prev[index] >= CLICKS_NEEDED) return prev;
      const next = [...prev];
      next[index] = next[index] + 1;
      return next;
    });
  };

  return (
    <div className="fixed inset-0 z-[9999] bg-stone-900/96 flex flex-col select-none">

      {/* Header */}
      <div className="flex items-center justify-between px-6 pt-5 pb-2 shrink-0">
        <div className="flex items-center gap-3">
          <Eye className="w-9 h-9 text-teal-400 shrink-0" />
          <div>
            <h2 className="text-2xl md:text-3xl font-black text-white">
              Activar Control por Pausa
            </h2>
            <p className="text-base text-stone-300">
              Pulse cada punto <strong className="text-teal-300">{CLICKS_NEEDED} veces</strong> para verificar el área de pantalla
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

      {/* How it works info strip */}
      <div className="mx-6 mb-2 bg-teal-900/40 border border-teal-500/40 rounded-2xl px-4 py-2 flex items-center gap-6 shrink-0 flex-wrap">
        <span className="flex items-center gap-2 text-teal-200 text-sm font-semibold">
          <MousePointer2 className="w-4 h-4 shrink-0" /> Mueva el puntero sobre un botón
        </span>
        <span className="flex items-center gap-2 text-teal-200 text-sm font-semibold">
          <Clock className="w-4 h-4 shrink-0" /> Pause 2 segundos
        </span>
        <span className="flex items-center gap-2 text-teal-200 text-sm font-semibold">
          <Hand className="w-4 h-4 shrink-0" /> Se activa solo
        </span>
      </div>

      {/* Progress bar */}
      <div className="px-6 pb-2 shrink-0 flex items-center gap-3">
        <div className="flex-1 h-3 bg-stone-700 rounded-full overflow-hidden">
          <div
            className="h-full bg-teal-400 rounded-full transition-all duration-300"
            style={{ width: `${overallProgress}%` }}
          />
        </div>
        <span className="text-lg font-bold text-teal-300 w-12 text-right">
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
              onPointerDown={() => handlePointClick(index)}
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
            ACTIVAR CONTROL POR PAUSA
          </button>
        ) : (
          <p className="text-stone-400 text-lg">
            Quedan{" "}
            <span className="text-amber-400 font-bold text-xl">{totalNeeded - totalClicks}</span>
            {" "}pulsaciones
          </p>
        )}
      </div>
    </div>
  );
}
