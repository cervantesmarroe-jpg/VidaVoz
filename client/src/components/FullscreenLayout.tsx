import { ReactNode, useRef, useCallback, useEffect } from "react";
import { Link, useLocation } from "wouter";
import {
  Eye, EyeOff,
  AlertTriangle, MessageSquareText, ActivitySquare, Keyboard as KeyboardIcon,
} from "lucide-react";
import { ConsentModal, useConsent } from "@/components/ConsentModal";
import { useScanning } from "@/context/ScanningContext";
import { useWebGazer } from "@/hooks/use-webgazer";
import { CalibrationScreen } from "@/components/CalibrationScreen";

const TAB_DWELL_MS = 1500;

const TABS = [
  { path: "/",         Icon: AlertTriangle,    label: "URGENTE",  color: "#f87171" },
  { path: "/mensajes", Icon: MessageSquareText, label: "MENSAJES", color: "#38bdf8" },
  { path: "/escalas",  Icon: ActivitySquare,   label: "ESCALAS",  color: "#fbbf24" },
  { path: "/teclado",  Icon: KeyboardIcon,     label: "TECLADO",  color: "#a78bfa" },
];

// ── Cursor de mirada ─────────────────────────────────────────────────────────
function GazeCursor() {
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    const onMove = (e: PointerEvent) => {
      wrap.style.transform = `translate(${e.clientX - 22}px, ${e.clientY - 22}px)`;
      wrap.style.opacity = "1";
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => window.removeEventListener("pointermove", onMove);
  }, []);

  return (
    <div
      ref={wrapRef}
      className="fixed top-0 left-0 pointer-events-none z-[9997]"
      style={{ opacity: 0, transition: "transform 0.09s linear, opacity 0.4s", willChange: "transform" }}
    >
      <div style={{
        width: 44, height: 44, borderRadius: "50%",
        background: "rgba(255,255,255,0.22)",
        border: "3px solid #fbbf24",
        boxShadow: "0 0 16px rgba(251,191,36,0.6), inset 0 0 8px rgba(255,255,255,0.1)",
      }} />
    </div>
  );
}

// ── Pestaña lateral con dwell ────────────────────────────────────────────────
interface SideTabProps {
  path: string;
  Icon: React.ElementType;
  label: string;
  color: string;
  active: boolean;
}

function SideTab({ path, Icon, label, color, active }: SideTabProps) {
  const [, navigate] = useLocation();
  const timerRef  = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fillRef   = useRef<HTMLDivElement>(null);

  const startDwell = useCallback(() => {
    if (timerRef.current || active) return;
    const fill = fillRef.current;
    if (fill) {
      fill.style.transition = "none";
      fill.style.height = "0%";
      void fill.getBoundingClientRect();
      fill.style.transition = `height ${TAB_DWELL_MS}ms linear`;
      fill.style.height = "100%";
    }
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      navigate(path);
    }, TAB_DWELL_MS);
  }, [active, path, navigate]);

  const cancelDwell = useCallback(() => {
    if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
    const fill = fillRef.current;
    if (fill) { fill.style.transition = "none"; fill.style.height = "0%"; }
  }, []);

  return (
    <Link
      href={path}
      onPointerEnter={startDwell}
      onPointerLeave={cancelDwell}
      data-testid={`sidetab-${label.toLowerCase()}`}
      style={{
        position: "relative",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: "4px",
        width: "100%",
        padding: "10px 4px",
        borderRadius: "10px",
        overflow: "hidden",
        background: active ? "rgba(255,255,255,0.12)" : "transparent",
        border: active ? `1px solid ${color}44` : "1px solid transparent",
        cursor: "pointer",
        transition: "background 0.2s",
        textDecoration: "none",
        flexShrink: 0,
      }}
    >
      {/* Dwell fill bar */}
      <div
        ref={fillRef}
        style={{
          position: "absolute", bottom: 0, left: 0, right: 0,
          height: "0%", background: `${color}33`, pointerEvents: "none",
        }}
      />
      <Icon style={{ width: 22, height: 22, color: active ? color : "rgba(255,255,255,0.35)", position: "relative", zIndex: 1 }} />
      <span style={{
        fontSize: "0.5rem", fontWeight: 800, letterSpacing: "0.06em",
        textTransform: "uppercase", color: active ? color : "rgba(255,255,255,0.3)",
        position: "relative", zIndex: 1, lineHeight: 1.2, textAlign: "center",
      }}>
        {label}
      </span>
    </Link>
  );
}

// ── Layout principal ─────────────────────────────────────────────────────────
export function FullscreenLayout({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  const { accepted, accept } = useConsent();
  const { isScanningMode, activateScanning, deactivateScanning } = useScanning();
  const { isActive, isCalibrating, startCalibration, deactivate } = useWebGazer();

  const handleDecline = () => { accept(); activateScanning(); };
  const handleGazeToggle = () => { if (isActive || isCalibrating) deactivate(); else startCalibration(); };

  return (
    <div className="flex flex-col bg-black overflow-hidden" style={{ height: "100dvh" }}>

      {/* Pantalla de calibración (overlay de pantalla completa) */}
      {isCalibrating && <CalibrationScreen />}

      {/* Consent modal */}
      {!accepted && <ConsentModal onAccept={accept} onDecline={handleDecline} />}

      {/* Scanning banner */}
      {isScanningMode && (
        <div className="fixed top-0 left-0 right-0 z-[9990] flex items-center justify-between gap-4 px-5 py-2 bg-amber-400 text-amber-950">
          <span className="font-bold text-sm">👆 MODO BARRIDO — Toque para seleccionar el botón resaltado</span>
          <button data-testid="button-stop-scanning" onClick={deactivateScanning}
            className="text-xs font-black px-3 py-1 rounded-lg bg-amber-950/20 border border-amber-950/30">
            ✕ Detener
          </button>
        </div>
      )}

      {/* Cursor de mirada */}
      <GazeCursor />

      {/* ── Header ─────────────────────────────────────────────────── */}
      <header
        className="shrink-0 bg-black flex items-center px-4 z-50 border-b border-white/10"
        style={{ height: "48px", marginTop: isScanningMode ? "40px" : "0" }}
      >
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
            : <EyeOff className="w-4 h-4 shrink-0" />}
          <span>{isActive ? "Mirada activa" : isCalibrating ? "Calibrando…" : "Activar mirada"}</span>
        </button>
      </header>

      {/* ── Cuerpo: sidebar + contenido ─────────────────────────────── */}
      <div className="flex flex-1 min-h-0">

        {/* Barra lateral de navegación */}
        <nav
          className="shrink-0 bg-black flex flex-col items-center justify-center gap-2 border-r border-white/10 py-3"
          style={{ width: "64px" }}
          aria-label="Navegación"
        >
          {TABS.map((tab) => (
            <SideTab
              key={tab.path}
              path={tab.path}
              Icon={tab.Icon}
              label={tab.label}
              color={tab.color}
              active={location === tab.path}
            />
          ))}
        </nav>

        {/* Contenido */}
        <main id={location === "/" ? "emergencias" : location.slice(1)} className="flex-1 min-h-0 overflow-hidden">
          {children}
        </main>
      </div>
    </div>
  );
}
