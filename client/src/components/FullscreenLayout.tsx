import { ReactNode } from "react";
import { Link, useLocation } from "wouter";
import {
  Eye,
  AlertTriangle,
  MessageSquareText,
  ActivitySquare,
  Keyboard as KeyboardIcon,
} from "lucide-react";
import { ConsentModal, useConsent } from "@/components/ConsentModal";
import { useScanning } from "@/context/ScanningContext";

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

  const handleDecline = () => {
    accept();
    activateScanning();
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
        {/* Estado de mirada */}
        <div className="flex items-center gap-2">
          <div className="relative">
            <Eye className="w-5 h-5 text-green-400" />
            <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-green-400 rounded-full animate-pulse" />
          </div>
          <span className="text-green-400 font-black text-xs tracking-[0.2em] uppercase">
            Modo Asistido Activo
          </span>
        </div>

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
