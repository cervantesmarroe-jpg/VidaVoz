import { ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { 
  AlertTriangle, 
  MessageSquareText, 
  ActivitySquare, 
  Keyboard as KeyboardIcon, 
  Eye,
  EyeOff
} from "lucide-react";
import { useWebGazer } from "@/hooks/use-webgazer";
import { CalibrationOverlay } from "@/components/CalibrationOverlay";

const NAV_ITEMS = [
  { path: "/", label: "URGENTE", icon: AlertTriangle, color: "text-rose-600", activeBg: "bg-rose-100" },
  { path: "/mensajes", label: "MENSAJES", icon: MessageSquareText, color: "text-sky-600", activeBg: "bg-sky-100" },
  { path: "/escalas", label: "ESCALAS", icon: ActivitySquare, color: "text-amber-600", activeBg: "bg-amber-100" },
  { path: "/teclado", label: "TECLADO", icon: KeyboardIcon, color: "text-violet-600", activeBg: "bg-violet-100" },
];

export function Layout({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  const { isActive, isCalibrating, startCalibration, deactivate, isScriptLoaded } = useWebGazer();

  const handleToggle = () => {
    if (isActive || isCalibrating) {
      deactivate();
    } else {
      startCalibration();
    }
  };

  return (
    <div className="flex flex-col h-screen max-h-screen bg-amber-50 overflow-hidden">

      {/* Calibration overlay — shown on top of everything */}
      {isCalibrating && <CalibrationOverlay />}

      {/* Top Header / App Bar */}
      <header className="h-24 flex items-center justify-between px-6 md:px-12 bg-white border-b-2 border-amber-100 shrink-0 z-50 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-teal-100 rounded-2xl flex items-center justify-center">
            <MessageSquareText className="w-8 h-8 text-teal-600" />
          </div>
          <h1 className="text-3xl font-black tracking-tight text-stone-800 hidden md:block">
            VozUCI
          </h1>
        </div>

        {/* Eye Tracking Toggle */}
        <button
          onClick={handleToggle}
          disabled={!isScriptLoaded}
          data-testid="button-toggle-eyetracking"
          className={`
            flex items-center gap-4 px-6 py-4 rounded-2xl font-bold text-xl transition-all border-2
            ${isActive
              ? 'bg-teal-100 text-teal-700 border-teal-400 shadow-[0_0_20px_rgba(20,184,166,0.25)]'
              : isCalibrating
              ? 'bg-amber-100 text-amber-700 border-amber-400 animate-pulse'
              : 'bg-stone-100 text-stone-600 border-stone-300 hover:bg-stone-200'
            }
            disabled:opacity-50 disabled:cursor-not-allowed
          `}
        >
          {isActive || isCalibrating ? <Eye className="w-8 h-8" /> : <EyeOff className="w-8 h-8" />}
          {isActive ? "MIRADA ACTIVA" : isCalibrating ? "CALIBRANDO…" : "ACTIVAR MIRADA"}
        </button>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto no-scrollbar relative z-10">
        {children}
      </main>

      {/* Bottom Navigation Tabs */}
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
                  : 'border-transparent text-stone-400 hover:bg-amber-50 hover:text-stone-600'
                }
              `}
            >
              <Icon className={`w-10 h-10 md:w-16 md:h-16 ${isActiveTab ? '' : 'opacity-60'}`} />
              <span className={`font-bold text-lg md:text-2xl tracking-wide ${isActiveTab ? '' : 'opacity-60'}`}>
                {item.label}
              </span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
