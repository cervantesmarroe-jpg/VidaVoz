import { ReactNode } from "react";
import { Link, useLocation } from "wouter";
import {
  Eye,
  EyeOff,
  AlertTriangle,
  MessageSquareText,
  ActivitySquare,
  Keyboard as KeyboardIcon,
} from "lucide-react";
import { ConsentModal, useConsent } from "@/components/ConsentModal";
import { useScanning } from "@/context/ScanningContext";
import { useWebGazer } from "@/hooks/use-webgazer";

const TABS = [
  { path: "/",         icon: AlertTriangle,    label: "URGENTE",  color: "text-rose-400"   },
  { path: "/mensajes", icon: MessageSquareText, label: "MENSAJES", color: "text-sky-400"    },
  { path: "/escalas",  icon: ActivitySquare,   label: "ESCALAS",  color: "text-amber-400"  },
  { path: "/teclado",  icon: KeyboardIcon,     label: "TECLADO",  color: "text-violet-400" },
];

export function FullscreenLayout({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  const { accepted, accept } = useConsent();
  const { isScanningMode, activateScanning, deactivateScanning } = useScanning();
  const { isActive, isCalibrating, startCalibration, deactivate } = useWebGazer();

  const handleDecline = () => {
    accept();
    activateScanning();
  };

  const handleGazeToggle = () => {
    if (isActive || isCalibrating) deactivate();
    else startCalibration();
  };

  return (
    <div className="flex flex-col bg-black overflow-hidden" style={{ height: "100dvh" }}>

      {/* Consent modal */}
      {!accepted && <ConsentModal onAccept={accept} onDecline={handleDecline} />}

      {/* Scanning banner */}
      {isScanningMode && (
        <div className="fixed top-0 left-0 right-0 z-[9990] flex items-center justify-between gap-4 px-5 py-2 bg-amber-400 text-amber-950">
          <span className="font-bold text-sm">👆 MODO BARRIDO — Toque para seleccionar el botón resaltado</span>
          <button
            data-testid="button-stop-scanning"
            onClick={deactivateScanning}
            className="text-xs font-black px-3 py-1 rounded-lg bg-amber-950/20 border border-amber-950/30"
          >✕ Detener</button>
        </div>
      )}

      {/* ── Barra de estado minimal ─────────────────────────────────────── */}
      <header
        className="shrink-0 bg-black flex items-center justify-between px-4 z-50 border-b border-white/10"
        style={{ height: "48px", marginTop: isScanningMode ? "40px" : "0" }}
      >
        {/* Botón activar/desactivar mirada */}
        <button
          data-testid="button-toggle-eyetracking"
          onClick={handleGazeToggle}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-sm transition-all border
            ${isActive
              ? "bg-green-500/20 text-green-400 border-green-500/50 shadow-[0_0_12px_rgba(74,222,128,0.3)]"
              : isCalibrating
              ? "bg-amber-500/20 text-amber-400 border-amber-500/50 animate-pulse"
              : "bg-white/8 text-white/70 border-white/20 hover:bg-white/15 hover:text-white"
            }`}
        >
          {isActive || isCalibrating
            ? <Eye className="w-4 h-4 shrink-0" />
            : <EyeOff className="w-4 h-4 shrink-0" />
          }
          <span>
            {isActive ? "Mirada activa" : isCalibrating ? "Calibrando…" : "Activar mirada"}
          </span>
        </button>

        {/* Navegación de pestañas */}
        <nav className="flex items-center gap-1" aria-label="Pestañas">
          {TABS.map(({ path, icon: Icon, label, color }) => {
            const active = location === path;
            return (
              <Link
                key={path}
                href={path}
                data-testid={`tab-${label.toLowerCase()}`}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors
                  ${active ? `bg-white/10 ${color}` : "text-white/40 hover:text-white/70 hover:bg-white/5"}`}
              >
                <Icon className="w-3.5 h-3.5 shrink-0" />
                <span className="hidden sm:inline">{label}</span>
              </Link>
            );
          })}
        </nav>
      </header>

      {/* ── Contenido principal ─────────────────────────────────────────── */}
      <main className="flex-1 min-h-0 overflow-hidden">
        {children}
      </main>
    </div>
  );
}
