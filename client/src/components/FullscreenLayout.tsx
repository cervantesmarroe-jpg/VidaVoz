import { ReactNode, useRef, useCallback, useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import {
  Eye, EyeOff, ClipboardCopy,
  AlertTriangle, MessageSquareText, ActivitySquare, Keyboard as KeyboardIcon,
} from "lucide-react";
import { ConsentModal, useConsent } from "@/components/ConsentModal";
import { useScanning } from "@/context/ScanningContext";
import { useWebGazer, gazeTracker } from "@/hooks/use-webgazer";
import { CalibrationScreen } from "@/components/CalibrationScreen";
import { MasterTrainingOverlay } from "@/components/MasterTrainingOverlay";

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
        background: active ? `${color}18` : "transparent",
        border: active ? `1px solid ${color}55` : "1px solid transparent",
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
      <Icon style={{ width: 22, height: 22, color: active ? color : "#AAAAAA", position: "relative", zIndex: 1 }} />
      <span style={{
        fontSize: "0.5rem", fontWeight: 800, letterSpacing: "0.06em",
        textTransform: "uppercase", color: active ? color : "#AAAAAA",
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
  const {
    isActive, isCalibrating, hasCompletedInitialSync,
    startCalibration, activateFromProfile, deactivate,
  } = useWebGazer();

  // ── Entrenamiento Maestro (10 muestras) ──────────────────────────────────
  const [showTraining, setShowTraining] = useState(false);

  // ── Log periódico en consola cuando la mirada está activa (cada 4 s) ─────
  useEffect(() => {
    if (!isActive) return;
    gazeTracker.logDebugInfo('GazeTracker: seguimiento activo');
    const iv = setInterval(() => {
      gazeTracker.logDebugInfo('GazeTracker: estado en vivo');
    }, 4000);
    return () => clearInterval(iv);
  }, [isActive]);

  const handleDecline = () => { accept(); activateScanning(); };

  // Si el sync inicial ya está hecho, "Activar mirada" carga el perfil guardado
  // directamente (sin CalibrationScreen). Solo la primera vez usaría startCalibration.
  const handleGazeToggle = () => {
    if (isActive || isCalibrating) {
      deactivate();
    } else if (hasCompletedInitialSync) {
      activateFromProfile();
    } else {
      startCalibration();
    }
  };

  return (
    <div className="flex flex-col overflow-hidden" style={{ height: "100dvh", background: "#FAFAFA" }}>

      {/* Pantalla de calibración — bloqueada permanentemente una vez hecho el sync inicial */}
      {isCalibrating && !hasCompletedInitialSync && <CalibrationScreen />}

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
        style={{
          height: "48px",
          marginTop: isScanningMode ? "40px" : "0",
          background: "#FFFFFF",
          borderBottom: "1px solid #E0E0E0",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          paddingLeft: "16px",
          paddingRight: "16px",
          flexShrink: 0,
          zIndex: 50,
        }}
      >
        {/* Activar/desactivar mirada */}
        <button
          data-testid="button-toggle-eyetracking"
          onClick={handleGazeToggle}
          style={{
            display: "flex", alignItems: "center", gap: 8,
            padding: "6px 16px", borderRadius: 12,
            fontFamily: "'Lexend',sans-serif", fontWeight: 700, fontSize: "0.82rem",
            cursor: "pointer", border: "1.5px solid",
            transition: "all 0.2s",
            ...(isActive
              ? { background: "#D5F5E3", color: "#145A30", borderColor: "#A8E6C8", boxShadow: "0 0 10px rgba(20,150,70,0.15)" }
              : isCalibrating
              ? { background: "#FCF3CF", color: "#6B4C00", borderColor: "#F0DC80" }
              : { background: "#F5F5F5", color: "#555555", borderColor: "#E0E0E0" }
            ),
          }}
        >
          {isActive || isCalibrating
            ? <Eye style={{ width: 15, height: 15, flexShrink: 0 }} />
            : <EyeOff style={{ width: 15, height: 15, flexShrink: 0 }} />}
          <span>{isActive ? "Mirada activa" : isCalibrating ? "Calibrando…" : "Activar mirada"}</span>
        </button>

        {/* Entrenamiento Maestro — botón temporal (calibración de fábrica) */}
        <button
          data-testid="button-master-training"
          onClick={() => setShowTraining(true)}
          title="Abrir sistema de entrenamiento maestro (10 muestras)"
          style={{
            display: "flex", alignItems: "center", gap: 6,
            padding: "5px 12px", borderRadius: 10,
            fontFamily: "'Lexend',sans-serif", fontWeight: 700, fontSize: "0.72rem",
            cursor: "pointer", border: "1.5px solid",
            transition: "all 0.2s",
            background: "#F0F4FF", color: "#4455AA", borderColor: "#C8D4F8",
          }}
        >
          <ClipboardCopy style={{ width: 13, height: 13 }} />
          <span>Calibrar ADN</span>
        </button>
      </header>

      {/* ── Cuerpo: sidebar + contenido ─────────────────────────────── */}
      <div className="flex flex-1 min-h-0">

        {/* Barra lateral de navegación */}
        <nav
          style={{
            width: "64px", flexShrink: 0,
            background: "#FFFFFF",
            borderRight: "1px solid #E0E0E0",
            display: "flex", flexDirection: "column",
            alignItems: "center", justifyContent: "center",
            gap: 4, padding: "12px 0",
          }}
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

      {/* ── Overlay de Entrenamiento Maestro ─────────────────────────── */}
      {showTraining && (
        <MasterTrainingOverlay onClose={() => setShowTraining(false)} />
      )}
    </div>
  );
}
