import { ReactNode, useRef, useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { Link, useLocation } from "wouter";
import {
  Eye, EyeOff, ClipboardCopy,
  AlertTriangle, MessageSquareText, ActivitySquare, Keyboard as KeyboardIcon,
} from "lucide-react";

import logoPath from "@assets/VidaVoz_1775644489589.png";
import { ConsentModal, useConsent } from "@/components/ConsentModal";
import { useScanning } from "@/context/ScanningContext";
import { useWebGazer, gazeTracker } from "@/hooks/use-webgazer";
import { CalibrationScreen } from "@/components/CalibrationScreen";
import { MasterTrainingOverlay } from "@/components/MasterTrainingOverlay";

// ── Hook: portrait vs landscape en tiempo real ────────────────────────────────
function useIsPortrait() {
  const mq = typeof window !== "undefined"
    ? window.matchMedia("(orientation: portrait)")
    : null;
  return useSyncExternalStore(
    (cb) => { mq?.addEventListener("change", cb); return () => mq?.removeEventListener("change", cb); },
    () => mq?.matches ?? true,
    () => true,
  );
}

const TAB_DWELL_MS = 1500;

const TABS = [
  { path: "/",         Icon: AlertTriangle,    label: "URGENTE",  color: "#f87171" },
  { path: "/mensajes", Icon: MessageSquareText, label: "MENSAJES", color: "#38bdf8" },
  { path: "/escalas",  Icon: ActivitySquare,   label: "ESCALAS",  color: "#fbbf24" },
  { path: "/teclado",  Icon: KeyboardIcon,     label: "TECLADO",  color: "#a78bfa" },
];

// ── Pestaña de navegación (sidebar vertical o barra inferior horizontal) ──────
interface SideTabProps {
  path: string;
  Icon: React.ElementType;
  label: string;
  color: string;
  active: boolean;
  isPortrait: boolean;
}

function SideTab({ path, Icon, label, color, active, isPortrait }: SideTabProps) {
  const [, navigate] = useLocation();
  const timerRef  = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fillRef   = useRef<HTMLDivElement>(null);

  const startDwell = useCallback(() => {
    if (timerRef.current || active) return;
    const fill = fillRef.current;
    if (fill) {
      fill.style.transition = "none";
      // Portrait: barra crece de izquierda a derecha; Landscape: de abajo a arriba
      if (isPortrait) {
        fill.style.width = "0%"; fill.style.height = "100%";
        void fill.getBoundingClientRect();
        fill.style.transition = `width ${TAB_DWELL_MS}ms linear`;
        fill.style.width = "100%";
      } else {
        fill.style.height = "0%"; fill.style.width = "100%";
        void fill.getBoundingClientRect();
        fill.style.transition = `height ${TAB_DWELL_MS}ms linear`;
        fill.style.height = "100%";
      }
    }
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      navigate(path);
    }, TAB_DWELL_MS);
  }, [active, path, navigate, isPortrait]);

  const cancelDwell = useCallback(() => {
    if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
    const fill = fillRef.current;
    if (fill) {
      fill.style.transition = "none";
      fill.style.height = "0%"; fill.style.width = "0%";
    }
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
        // Portrait (bottom bar): icon + label en fila; Landscape (sidebar): columna
        flexDirection: isPortrait ? "row" : "column",
        alignItems: "center",
        justifyContent: "center",
        gap: isPortrait ? "6px" : "4px",
        // Portrait: flex:1 para llenar igualmente los 4 huecos; Landscape: ancho completo del sidebar
        flex: isPortrait ? 1 : undefined,
        width: isPortrait ? undefined : "100%",
        height: isPortrait ? "100%" : undefined,
        padding: isPortrait ? "8px 4px" : "10px 4px",
        borderRadius: isPortrait ? "8px" : "10px",
        overflow: "hidden",
        background: active ? `${color}18` : "transparent",
        border: active ? `1px solid ${color}55` : "1px solid transparent",
        cursor: "pointer",
        transition: "background 0.2s",
        textDecoration: "none",
        flexShrink: 0,
      }}
    >
      {/* Dwell fill: en portrait crece →; en landscape crece ↑ */}
      <div
        ref={fillRef}
        style={{
          position: "absolute",
          ...(isPortrait
            ? { top: 0, bottom: 0, left: 0, width: "0%", height: "100%" }
            : { bottom: 0, left: 0, right: 0, height: "0%", width: "100%" }),
          background: `${color}33`, pointerEvents: "none",
        }}
      />
      <Icon style={{
        width: isPortrait ? 20 : 22, height: isPortrait ? 20 : 22,
        color: active ? color : "#AAAAAA", position: "relative", zIndex: 1, flexShrink: 0,
      }} />
      <span style={{
        fontSize: isPortrait ? "0.58rem" : "0.5rem",
        fontWeight: 800, letterSpacing: "0.06em",
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
  const isPortrait = useIsPortrait();
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
          paddingLeft: "12px",
          paddingRight: "12px",
          flexShrink: 0,
          zIndex: 50,
          gap: 8,
        }}
      >
        {/* ── Logo VidaVoz — izquierda ──────────────────────────────── */}
        <img
          src={logoPath}
          alt="VidaVoz"
          draggable={false}
          style={{
            height: "36px",
            width: "auto",
            objectFit: "contain",
            flexShrink: 0,
            userSelect: "none",
            WebkitUserSelect: "none" as const,
          }}
        />

        {/* ── Botones de control — derecha ─────────────────────────── */}
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginLeft: "auto" }}>
          {/* Activar/desactivar mirada */}
          <button
            data-testid="button-toggle-eyetracking"
            onClick={handleGazeToggle}
            style={{
              display: "flex", alignItems: "center", gap: 6,
              padding: "5px 12px", borderRadius: 12,
              fontFamily: "'Lexend',sans-serif", fontWeight: 700, fontSize: "0.78rem",
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
              ? <Eye style={{ width: 14, height: 14, flexShrink: 0 }} />
              : <EyeOff style={{ width: 14, height: 14, flexShrink: 0 }} />}
            <span>{isActive ? "Mirada activa" : isCalibrating ? "Calibrando…" : "Activar mirada"}</span>
          </button>

          {/* Entrenamiento Maestro */}
          <button
            data-testid="button-master-training"
            onClick={() => setShowTraining(true)}
            title="Abrir sistema de entrenamiento maestro (10 muestras)"
            style={{
              display: "flex", alignItems: "center", gap: 5,
              padding: "5px 10px", borderRadius: 10,
              fontFamily: "'Lexend',sans-serif", fontWeight: 700, fontSize: "0.7rem",
              cursor: "pointer", border: "1.5px solid",
              transition: "all 0.2s",
              background: "#F0F4FF", color: "#4455AA", borderColor: "#C8D4F8",
            }}
          >
            <ClipboardCopy style={{ width: 12, height: 12 }} />
            <span>Calibrar ADN</span>
          </button>
        </div>
      </header>

      {/* ── Cuerpo: nav + contenido (layout adapta a orientación) ──── */}
      {/*  Portrait  → columna: contenido arriba, barra nav abajo   */}
      {/*  Landscape → fila:   sidebar izquierda, contenido derecha */}
      <div style={{
        display: "flex", flex: 1, minHeight: 0,
        flexDirection: isPortrait ? "column" : "row",
      }}>

        {/* Contenido principal — en portrait va ANTES del nav (orden DOM) */}
        <main
          id={location === "/" ? "emergencias" : location.slice(1)}
          style={{ flex: 1, minHeight: 0, minWidth: 0, overflow: "hidden" }}
        >
          {children}
        </main>

        {/* Barra de navegación: sidebar lateral (landscape) o barra inferior (portrait) */}
        <nav
          style={isPortrait ? {
            // Barra inferior — portrait
            width: "100%", height: "58px", flexShrink: 0,
            background: "#FFFFFF",
            borderTop: "1px solid #E0E0E0",
            display: "flex", flexDirection: "row",
            alignItems: "stretch",
            gap: 4, padding: "4px 6px",
          } : {
            // Sidebar izquierdo — landscape
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
              isPortrait={isPortrait}
            />
          ))}
        </nav>
      </div>

      {/* ── Overlay de Entrenamiento Maestro ─────────────────────────── */}
      {showTraining && (
        <MasterTrainingOverlay onClose={() => setShowTraining(false)} />
      )}
    </div>
  );
}
