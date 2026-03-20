import { ReactNode, useRef, useCallback } from "react";
import { Link, useLocation } from "wouter";
import {
  AlertTriangle,
  MessageSquareText,
  ActivitySquare,
  Keyboard as KeyboardIcon,
  Eye,
  EyeOff,
  ChevronUp,
  ChevronDown,
} from "lucide-react";
import { useWebGazer } from "@/hooks/use-webgazer";
import { CalibrationOverlay } from "@/components/CalibrationOverlay";

const NAV_ITEMS = [
  { path: "/",         label: "URGENTE",  icon: AlertTriangle,    color: "text-rose-600",   activeBg: "bg-rose-100" },
  { path: "/mensajes", label: "MENSAJES", icon: MessageSquareText, color: "text-sky-600",    activeBg: "bg-sky-100" },
  { path: "/escalas",  label: "ESCALAS",  icon: ActivitySquare,   color: "text-amber-600",  activeBg: "bg-amber-100" },
  { path: "/teclado",  label: "TECLADO",  icon: KeyboardIcon,     color: "text-violet-600", activeBg: "bg-violet-100" },
];

// Cantidad de scroll por activación (px)
const SCROLL_STEP = 220;

export function Layout({ children }: { children: ReactNode }) {
  const [location]  = useLocation();
  const mainRef     = useRef<HTMLElement>(null);
  const { isActive, isCalibrating, startCalibration, deactivate } = useWebGazer();

  const handleToggle = () => {
    if (isActive || isCalibrating) deactivate();
    else startCalibration();
  };

  const scrollUp   = useCallback(() => {
    mainRef.current?.scrollBy({ top: -SCROLL_STEP, behavior: "smooth" });
  }, []);

  const scrollDown = useCallback(() => {
    mainRef.current?.scrollBy({ top: SCROLL_STEP, behavior: "smooth" });
  }, []);

  return (
    <div className="flex flex-col h-screen max-h-screen bg-amber-50 overflow-hidden">

      {isCalibrating && <CalibrationOverlay />}

      {/* Header */}
      <header className="h-24 flex items-center justify-between px-6 md:px-12 bg-white border-b-2 border-amber-100 shrink-0 z-50 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-teal-100 rounded-2xl flex items-center justify-center">
            <MessageSquareText className="w-8 h-8 text-teal-600" />
          </div>
          <h1 className="text-3xl font-black tracking-tight text-stone-800 hidden md:block">
            VozUCI
          </h1>
        </div>

        <button
          onClick={handleToggle}
          data-testid="button-toggle-eyetracking"
          className={`
            flex items-center gap-4 px-6 py-4 rounded-2xl font-bold text-xl transition-all border-2
            ${isActive
              ? "bg-teal-100 text-teal-700 border-teal-400 shadow-[0_0_20px_rgba(20,184,166,0.25)]"
              : isCalibrating
              ? "bg-amber-100 text-amber-700 border-amber-400 animate-pulse"
              : "bg-stone-100 text-stone-600 border-stone-300 hover:bg-stone-200"
            }
          `}
        >
          {isActive || isCalibrating ? <Eye className="w-8 h-8" /> : <EyeOff className="w-8 h-8" />}
          {isActive ? "MIRADA ACTIVA" : isCalibrating ? "CALIBRANDO…" : "ACTIVAR MIRADA"}
        </button>
      </header>

      {/* Main content */}
      <main ref={mainRef} className="flex-1 overflow-y-auto no-scrollbar relative z-10">
        {children}

        {/* ── Flechas de scroll por mirada ── */}
        {isActive && (
          <>
            {/* SUBIR */}
            <button
              data-gaze-target="true"
              onClick={scrollUp}
              aria-label="Subir"
              data-testid="button-scroll-up"
              className="gaze-target fixed right-0 z-40 w-20 flex flex-col items-center justify-center gap-2 py-5 bg-teal-600/90 hover:bg-teal-500 text-white rounded-l-3xl shadow-2xl border-2 border-teal-400 touch-manipulation transition-colors select-none"
              style={{ top: "calc(96px + (100dvh - 96px - 128px) * 0.22)" }}
            >
              <ChevronUp className="w-10 h-10 shrink-0" strokeWidth={3} />
              <span className="text-xs font-black tracking-widest [writing-mode:vertical-rl] rotate-180">
                SUBIR
              </span>
              <div className="gaze-progress-bar" />
            </button>

            {/* BAJAR */}
            <button
              data-gaze-target="true"
              onClick={scrollDown}
              aria-label="Bajar"
              data-testid="button-scroll-down"
              className="gaze-target fixed right-0 z-40 w-20 flex flex-col items-center justify-center gap-2 py-5 bg-teal-600/90 hover:bg-teal-500 text-white rounded-l-3xl shadow-2xl border-2 border-teal-400 touch-manipulation transition-colors select-none"
              style={{ top: "calc(96px + (100dvh - 96px - 128px) * 0.58)" }}
            >
              <ChevronDown className="w-10 h-10 shrink-0" strokeWidth={3} />
              <span className="text-xs font-black tracking-widest [writing-mode:vertical-rl] rotate-180">
                BAJAR
              </span>
              <div className="gaze-progress-bar" />
            </button>
          </>
        )}
      </main>

      {/* Bottom Navigation */}
      <nav className="h-32 md:h-40 bg-white border-t-2 border-amber-100 flex shrink-0 z-50 p-2 md:p-4 gap-2 shadow-[0_-4px_16px_rgba(0,0,0,0.06)]">
        {NAV_ITEMS.map((item) => {
          const isActiveTab = location === item.path;
          const Icon = item.icon;
          return (
            <Link
              key={item.path}
              href={item.path}
              className={`
                flex-1 flex flex-col items-center justify-center gap-2 md:gap-4 rounded-3xl
                transition-all duration-300 border-2
                ${isActiveTab
                  ? `${item.activeBg} border-current ${item.color}`
                  : "border-transparent text-stone-400 hover:bg-amber-50 hover:text-stone-600"
                }
              `}
            >
              <Icon className={`w-10 h-10 md:w-16 md:h-16 ${isActiveTab ? "" : "opacity-60"}`} />
              <span className={`font-bold text-lg md:text-2xl tracking-wide ${isActiveTab ? "" : "opacity-60"}`}>
                {item.label}
              </span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
