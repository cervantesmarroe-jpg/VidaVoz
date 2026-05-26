import { ReactNode, useRef, useCallback, useState } from "react";
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
  LogOut,
} from "lucide-react";
import { useWebGazer } from "@/hooks/use-webgazer";
import { CalibrationOverlay } from "@/components/CalibrationOverlay";
import { ConsentModal, useConsent } from "@/components/ConsentModal";

const NAV_ITEMS = [
  { path: "/",         label: "URGENTE",  icon: AlertTriangle,    color: "text-rose-600",   activeBg: "bg-rose-100" },
  { path: "/mensajes", label: "MENSAJES", icon: MessageSquareText, color: "text-sky-600",    activeBg: "bg-sky-100" },
  { path: "/escalas",  label: "ESCALAS",  icon: ActivitySquare,   color: "text-amber-600",  activeBg: "bg-amber-100" },
  { path: "/teclado",  label: "TECLADO",  icon: KeyboardIcon,     color: "text-violet-600", activeBg: "bg-violet-100" },
];

const SCROLL_STEP = 220;

export function Layout({ children }: { children: ReactNode }) {
  const [location]  = useLocation();
  const mainRef     = useRef<HTMLElement>(null);
  const { isActive, isCalibrating, startCalibration, deactivate } = useWebGazer();
  const { accepted, accept, decline, revoke } = useConsent();

  // Diálogo de confirmación para "Finalizar Sesión"
  const [showFinalizar, setShowFinalizar] = useState(false);

  const handleToggle = () => {
    if (isActive || isCalibrating) deactivate();
    else startCalibration();
  };

  const handleDecline = () => {
    decline();          // guarda "modo táctil" SOLO en memoria de sesión
  };

  const scrollUp   = useCallback(() => {
    mainRef.current?.scrollBy({ top: -SCROLL_STEP, behavior: "smooth" });
  }, []);

  const scrollDown = useCallback(() => {
    mainRef.current?.scrollBy({ top: SCROLL_STEP, behavior: "smooth" });
  }, []);

  // Finalizar sesión: para la mirada, purga el consentimiento y datos volátiles
  const finalizarSesion = () => {
    deactivate();
    // Limpiar datos volátiles de sesión
    sessionStorage.clear();
    // Limpiar cualquier caché del navegador que pueda haber quedado
    if ('caches' in window) {
      caches.keys().then(keys => keys.forEach(k => caches.delete(k)));
    }
    revoke(); // Muestra el modal de consentimiento de nuevo
    setShowFinalizar(false);
  };

  return (
    <div className="flex flex-col h-screen max-h-screen bg-amber-50 overflow-hidden">

      {/* Modal RGPD — siempre en primer plano si no hay consentimiento */}
      {!accepted && <ConsentModal onAccept={accept} onDecline={handleDecline} />}

      {/* Overlay de calibración */}
      {isCalibrating && <CalibrationOverlay />}

      {/* Diálogo "Finalizar Sesión" */}
      {showFinalizar && (
        <div className="fixed inset-0 z-[9998] flex items-center justify-center bg-stone-900/70 backdrop-blur-sm p-6">
          <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full p-8 flex flex-col gap-6">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 bg-rose-100 rounded-2xl flex items-center justify-center shrink-0">
                <LogOut className="w-8 h-8 text-rose-600" />
              </div>
              <div>
                <h2 className="text-2xl font-black text-stone-800 leading-tight">
                  ¿Finalizar sesión?
                </h2>
                <p className="text-stone-500 text-base mt-1">
                  Se detendrá el seguimiento ocular y se borrarán todos los datos de esta sesión de la memoria.
                </p>
              </div>
            </div>
            <div className="bg-amber-50 border border-amber-200 rounded-2xl px-5 py-4 text-sm text-stone-600 leading-relaxed">
              Los datos de mirada y calibración son volátiles (solo RAM). Se eliminarán completamente al confirmar.
            </div>
            <div className="flex gap-3">
              <button
                data-testid="button-finalizar-confirm"
                onClick={finalizarSesion}
                className="flex-1 bg-rose-600 hover:bg-rose-500 active:bg-rose-700 text-white font-black text-lg py-4 px-6 rounded-2xl transition-colors flex items-center justify-center gap-2"
              >
                <LogOut className="w-6 h-6" />
                Finalizar y borrar
              </button>
              <button
                data-testid="button-finalizar-cancel"
                onClick={() => setShowFinalizar(false)}
                className="flex-1 bg-stone-100 hover:bg-stone-200 text-stone-700 font-bold text-lg py-4 px-6 rounded-2xl transition-colors"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <header className="h-24 flex items-center justify-between px-4 md:px-8 bg-white border-b-2 border-amber-100 shrink-0 z-50 shadow-sm gap-3">
        {/* Logo */}
        <div className="flex items-center gap-3 shrink-0">
          <div className="w-12 h-12 bg-teal-100 rounded-2xl flex items-center justify-center">
            <MessageSquareText className="w-8 h-8 text-teal-600" />
          </div>
          <h1 className="text-3xl font-black tracking-tight text-stone-800 hidden md:block">
            VozUCI
          </h1>
        </div>

        <div className="flex items-center gap-2 md:gap-3 min-w-0">
          {/* Toggle Eye Tracking */}
          <button
            onClick={handleToggle}
            data-testid="button-toggle-eyetracking"
            className={`
              flex items-center gap-2 md:gap-4 px-4 md:px-6 py-3 md:py-4 rounded-2xl font-bold text-base md:text-xl transition-all border-2 shrink-0
              ${isActive
                ? "bg-teal-100 text-teal-700 border-teal-400 shadow-[0_0_20px_rgba(20,184,166,0.25)]"
                : isCalibrating
                ? "bg-amber-100 text-amber-700 border-amber-400 animate-pulse"
                : "bg-stone-100 text-stone-600 border-stone-300 hover:bg-stone-200"
              }
            `}
          >
            {isActive || isCalibrating ? <Eye className="w-7 h-7 md:w-8 md:h-8 shrink-0" /> : <EyeOff className="w-7 h-7 md:w-8 md:h-8 shrink-0" />}
            <span className="hidden sm:inline">
              {isActive ? "MIRADA ACTIVA" : isCalibrating ? "CALIBRANDO…" : "ACTIVAR MIRADA"}
            </span>
          </button>

          {/* Finalizar Sesión */}
          <button
            data-testid="button-finalizar-sesion"
            onClick={() => setShowFinalizar(true)}
            title="Finalizar sesión y borrar datos"
            className="flex items-center gap-2 px-4 py-3 md:py-4 rounded-2xl font-bold text-base md:text-lg border-2 border-rose-200 bg-rose-50 text-rose-600 hover:bg-rose-100 hover:border-rose-300 transition-colors shrink-0"
          >
            <LogOut className="w-6 h-6 md:w-7 md:h-7 shrink-0" />
            <span className="hidden lg:inline">Finalizar sesión</span>
          </button>
        </div>
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
