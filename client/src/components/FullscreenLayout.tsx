import { ReactNode, useRef, useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { Link, useLocation } from "wouter";
import {
  Eye, EyeOff, ClipboardCopy,
  AlertTriangle, MessageSquareText, ActivitySquare, Keyboard as KeyboardIcon,
} from "lucide-react";

import logoPath from "@assets/VidaVoz_1775644489589.png";
import { ConsentModal, useConsent } from "@/components/ConsentModal";
import { useScanning } from "@/context/ScanningContext";
import { useWebGazer, useWebGazerStore, gazeTracker } from "@/hooks/use-webgazer";
import { CalibrationScreen } from "@/components/CalibrationScreen";
import { MasterTrainingOverlay } from "@/components/MasterTrainingOverlay";

// ── Parámetros QuickSync (mismo que el antiguo ProfileSelect) ─────────────────
const QS_DWELL_MS   = 3000;
const QS_WARMUP_MS  = 400;
const QS_COLLECT_MS = 50;
const QS_SUCCESS_MS = 1200;

const QS_R_RING = 52;
const QS_CIRCUMF = 2 * Math.PI * QS_R_RING;

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

// ── Anillo SVG de progreso (QuickSync) ────────────────────────────────────────
function QSSyncRing({ progress }: { progress: number }) {
  const offset = QS_CIRCUMF * (1 - Math.min(progress, 1));
  const sz     = (QS_R_RING + 14) * 2;
  return (
    <svg
      width={sz} height={sz}
      style={{
        position: "absolute",
        top: "50%", left: "50%",
        transform: "translate(-50%,-50%) rotate(-90deg)",
        pointerEvents: "none",
      }}
    >
      <circle cx={sz / 2} cy={sz / 2} r={QS_R_RING}
        fill="none" stroke="rgba(125,211,168,0.2)" strokeWidth={8} />
      <circle cx={sz / 2} cy={sz / 2} r={QS_R_RING}
        fill="none" stroke="#7DD3A8" strokeWidth={8}
        strokeLinecap="round"
        strokeDasharray={QS_CIRCUMF}
        strokeDashoffset={offset}
        style={{ transition: "stroke-dashoffset 0.06s linear" }}
      />
    </svg>
  );
}

const TAB_DWELL_MS = 1500;

const TABS = [
  { path: "/",         Icon: AlertTriangle,    label: "URGENTE",  color: "#f87171" },
  { path: "/mensajes", Icon: MessageSquareText, label: "MENSAJES", color: "#38bdf8" },
  { path: "/escalas",  Icon: ActivitySquare,   label: "ESCALAS",  color: "#fbbf24" },
  { path: "/teclado",  Icon: KeyboardIcon,     label: "TECLADO",  color: "#a78bfa" },
];

// ── Pestaña de navegación ─────────────────────────────────────────────────────
interface SideTabProps {
  path:      string;
  Icon:      React.ElementType;
  label:     string;
  color:     string;
  active:    boolean;
  isPortrait: boolean;
}

function SideTab({ path, Icon, label, color, active, isPortrait }: SideTabProps) {
  const [, navigate] = useLocation();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fillRef  = useRef<HTMLDivElement>(null);

  const startDwell = useCallback(() => {
    if (timerRef.current || active) return;
    const fill = fillRef.current;
    if (fill) {
      fill.style.transition = "none";
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
    timerRef.current = setTimeout(() => { timerRef.current = null; navigate(path); }, TAB_DWELL_MS);
  }, [active, path, navigate, isPortrait]);

  const cancelDwell = useCallback(() => {
    if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
    const fill = fillRef.current;
    if (fill) { fill.style.transition = "none"; fill.style.height = "0%"; fill.style.width = "0%"; }
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
        flexDirection: isPortrait ? "row" : "column",
        alignItems: "center",
        justifyContent: "center",
        gap: isPortrait ? "6px" : "4px",
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

// ── Overlay QuickSync inline (se muestra al pulsar "Activar Mirada") ───────────
type QSSyncPhase = null | "loading" | "sync" | "success" | "error";

// ── Layout principal ──────────────────────────────────────────────────────────
export function FullscreenLayout({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  const isPortrait = useIsPortrait();
  const { accepted, accept } = useConsent();
  const { isScanningMode, activateScanning, deactivateScanning } = useScanning();
  const {
    isActive, isCalibrating, hasCompletedInitialSync,
    activateFromProfile, deactivate,
  } = useWebGazer();

  // ── Estado del QuickSync inline ───────────────────────────────────────────
  const [syncPhase,    setSyncPhase]    = useState<QSSyncPhase>(null);
  const [syncProgress, setSyncProgress] = useState(0);
  const [syncError,    setSyncError]    = useState("");
  const syncTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const syncIvsRef    = useRef<ReturnType<typeof setInterval>[]>([]);

  const clearSyncTimers = useCallback(() => {
    syncTimersRef.current.forEach(clearTimeout);
    syncIvsRef.current.forEach(clearInterval);
    syncTimersRef.current = [];
    syncIvsRef.current    = [];
  }, []);

  // ── Entrenamiento Maestro ─────────────────────────────────────────────────
  const [showTraining, setShowTraining] = useState(false);

  // ── Log periódico cuando la mirada está activa ────────────────────────────
  useEffect(() => {
    if (!isActive) return;
    gazeTracker.logDebugInfo('GazeTracker: seguimiento activo');
    const iv = setInterval(() => gazeTracker.logDebugInfo('GazeTracker: estado en vivo'), 4000);
    return () => clearInterval(iv);
  }, [isActive]);

  const handleDecline = () => { accept(); activateScanning(); };

  // ── "Activar Mirada" ──────────────────────────────────────────────────────
  //  • Si ya está activo/calibrando → desactivar
  //  • Si ya completó el QuickSync   → reactivar directamente (cámara arranca sola en Efecto D)
  //  • Primera vez               → mostrar overlay QuickSync de 3 s
  const handleGazeToggle = useCallback(async () => {
    if (isActive || isCalibrating) {
      deactivate();
      return;
    }
    if (hasCompletedInitialSync) {
      // Segunda activación: Efecto D reinicia cámara y detección automáticamente
      activateFromProfile();
      return;
    }
    // Primera vez: QuickSync
    setSyncError("");
    setSyncPhase("loading");
    try {
      if (!gazeTracker.hasFaceModel) await gazeTracker.init();
      await gazeTracker.startCamera();
      gazeTracker.startDetection();
      gazeTracker.clearCalibration();
      setSyncPhase("sync");
    } catch (err) {
      console.error("[VidaVoz] Error iniciando cámara:", err);
      setSyncError("No se pudo acceder a la cámara. Comprueba los permisos.");
      setSyncPhase("error");
    }
  }, [isActive, isCalibrating, hasCompletedInitialSync, activateFromProfile, deactivate]);

  // ── Fase "sync": recoge 3 s de muestras en el centro ─────────────────────
  useEffect(() => {
    if (syncPhase !== "sync") return;
    setSyncProgress(0);
    const cx = window.innerWidth  / 2;
    const cy = window.innerHeight / 2;
    const t0 = Date.now();
    let collecting = false;

    const warmupT = setTimeout(() => { collecting = true; }, QS_WARMUP_MS);
    syncTimersRef.current.push(warmupT);

    const collectorIv = setInterval(() => {
      if (!collecting) return;
      gazeTracker.recordCalibrationPoint(cx, cy);
    }, QS_COLLECT_MS);
    syncIvsRef.current.push(collectorIv);

    const progressIv = setInterval(() => {
      setSyncProgress(Math.min((Date.now() - t0) / QS_DWELL_MS, 1));
    }, 40);
    syncIvsRef.current.push(progressIv);

    const doneT = setTimeout(() => {
      clearSyncTimers();
      gazeTracker.quickCenterCalibrate();
      setSyncPhase("success");
    }, QS_DWELL_MS);
    syncTimersRef.current.push(doneT);

    return clearSyncTimers;
  }, [syncPhase, clearSyncTimers]);

  // ── Fase "success": confirmar sync y activar gaze ─────────────────────────
  useEffect(() => {
    if (syncPhase !== "success") return;
    const t = setTimeout(() => {
      setSyncPhase(null);
      useWebGazerStore.getState().setSyncCompleted();
      activateFromProfile();
    }, QS_SUCCESS_MS);
    return () => clearTimeout(t);
  }, [syncPhase, activateFromProfile]);

  // ── Cancelar QuickSync ────────────────────────────────────────────────────
  const handleCancelSync = useCallback(() => {
    clearSyncTimers();
    setSyncPhase(null);
    deactivate();
    gazeTracker.stopCamera();
  }, [clearSyncTimers, deactivate]);

  return (
    <div className="flex flex-col overflow-hidden" style={{ height: "100dvh", background: "#FAFAFA" }}>

      {/* Calibración 9 puntos (solo si se invoca startCalibration desde otro lugar) */}
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

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <header style={{
        height: "48px",
        marginTop: isScanningMode ? "40px" : "0",
        background: "#FFFFFF",
        borderBottom: "1px solid #E0E0E0",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        paddingLeft: "12px", paddingRight: "12px",
        flexShrink: 0, zIndex: 50, gap: 8,
      }}>
        {/* Logo */}
        <img
          src={logoPath} alt="VidaVoz" draggable={false}
          style={{ height: "36px", width: "auto", objectFit: "contain", flexShrink: 0, userSelect: "none" }}
        />

        {/* Controles */}
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginLeft: "auto" }}>
          {/* Activar / desactivar mirada */}
          <button
            data-testid="button-toggle-eyetracking"
            onClick={handleGazeToggle}
            style={{
              display: "flex", alignItems: "center", gap: 6,
              padding: "5px 12px", borderRadius: 12,
              fontFamily: "'Lexend',sans-serif", fontWeight: 700, fontSize: "0.78rem",
              cursor: "pointer", border: "1.5px solid", transition: "all 0.2s",
              ...(isActive
                ? { background: "#D5F5E3", color: "#145A30", borderColor: "#A8E6C8", boxShadow: "0 0 10px rgba(20,150,70,0.15)" }
                : isCalibrating || syncPhase !== null
                ? { background: "#FCF3CF", color: "#6B4C00", borderColor: "#F0DC80" }
                : { background: "#F5F5F5", color: "#555555", borderColor: "#E0E0E0" }
              ),
            }}
          >
            {isActive || isCalibrating || syncPhase !== null
              ? <Eye style={{ width: 14, height: 14, flexShrink: 0 }} />
              : <EyeOff style={{ width: 14, height: 14, flexShrink: 0 }} />}
            <span>
              {isActive
                ? "Mirada activa"
                : isCalibrating
                ? "Calibrando…"
                : syncPhase === "loading"
                ? "Iniciando…"
                : syncPhase === "sync"
                ? "Sincronizando…"
                : syncPhase === "success"
                ? "¡Listo!"
                : "Activar mirada"}
            </span>
          </button>

          {/* Calibrar ADN */}
          <button
            data-testid="button-master-training"
            onClick={() => setShowTraining(true)}
            title="Abrir sistema de entrenamiento maestro (10 muestras)"
            style={{
              display: "flex", alignItems: "center", gap: 5,
              padding: "5px 10px", borderRadius: 10,
              fontFamily: "'Lexend',sans-serif", fontWeight: 700, fontSize: "0.7rem",
              cursor: "pointer", border: "1.5px solid", transition: "all 0.2s",
              background: "#F0F4FF", color: "#4455AA", borderColor: "#C8D4F8",
            }}
          >
            <ClipboardCopy style={{ width: 12, height: 12 }} />
            <span>Calibrar ADN</span>
          </button>
        </div>
      </header>

      {/* ── Cuerpo: nav + contenido ────────────────────────────────────── */}
      <div style={{ display: "flex", flex: 1, minHeight: 0, flexDirection: isPortrait ? "column" : "row" }}>
        <main
          id={location === "/" ? "emergencias" : location.slice(1)}
          style={{ flex: 1, minHeight: 0, minWidth: 0, overflow: "hidden" }}
        >
          {children}
        </main>

        {/* Barra navegación */}
        <nav
          style={isPortrait ? {
            width: "100%", height: "58px", flexShrink: 0,
            background: "#FFFFFF", borderTop: "1px solid #E0E0E0",
            display: "flex", flexDirection: "row", alignItems: "stretch",
            gap: 4, padding: "4px 6px",
          } : {
            width: "64px", flexShrink: 0,
            background: "#FFFFFF", borderRight: "1px solid #E0E0E0",
            display: "flex", flexDirection: "column", alignItems: "center",
            justifyContent: "center", gap: 4, padding: "12px 0",
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

      {/* ── Overlay Entrenamiento Maestro ─────────────────────────────── */}
      {showTraining && <MasterTrainingOverlay onClose={() => setShowTraining(false)} />}

      {/* ── Overlay QuickSync (Just-in-Time, al pulsar "Activar Mirada") ─ */}
      {syncPhase !== null && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 9998,
          background: "#000000",
          display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center",
          fontFamily: "'Lexend', sans-serif",
          userSelect: "none",
        }}>
          <style>{`
            @keyframes qs-heartbeat {
              0%,100% { transform: scale(1); }
              14%      { transform: scale(1.22); }
              28%      { transform: scale(1); }
              42%      { transform: scale(1.12); }
              70%      { transform: scale(1); }
            }
            @keyframes qs-pop {
              0%   { transform: scale(0.4); opacity: 0; }
              70%  { transform: scale(1.08); opacity: 1; }
              100% { transform: scale(1); opacity: 1; }
            }
            @keyframes qs-fade { from { opacity: 0 } to { opacity: 1 } }
          `}</style>

          {/* Botón Cancelar */}
          {syncPhase !== "success" && (
            <button
              onClick={handleCancelSync}
              style={{
                position: "absolute", top: 18, right: 18,
                background: "rgba(255,255,255,0.07)",
                border: "1px solid rgba(255,255,255,0.14)",
                borderRadius: 10, color: "rgba(255,255,255,0.45)",
                padding: "7px 14px", cursor: "pointer",
                fontSize: "0.75rem", fontWeight: 700,
              }}
            >
              Cancelar
            </button>
          )}

          {/* ── Loading: iniciando cámara ────────────────────────────── */}
          {syncPhase === "loading" && (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 20, animation: "qs-fade .3s ease both" }}>
              <div style={{
                width: 52, height: 52, borderRadius: "50%",
                border: "4px solid rgba(125,211,168,0.2)",
                borderTop: "4px solid #7DD3A8",
                animation: "spin 0.9s linear infinite",
              }} />
              <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
              <p style={{ fontSize: ".95rem", color: "rgba(255,255,255,0.5)", margin: 0, fontWeight: 600 }}>
                Iniciando cámara…
              </p>
              <p style={{ fontSize: ".75rem", color: "rgba(255,255,255,0.25)", margin: 0 }}>
                Acepta los permisos si el sistema lo solicita
              </p>
            </div>
          )}

          {/* ── Sync: punto verde pulsátil 3 s ──────────────────────── */}
          {syncPhase === "sync" && (
            <>
              <p style={{
                position: "absolute", top: "15%",
                left: 0, right: 0, textAlign: "center",
                fontSize: "clamp(1rem,3.5vw,1.3rem)",
                fontWeight: 700, color: "rgba(255,255,255,0.75)",
                animation: "qs-fade .4s ease both",
              }}>
                Sincronización Rápida
              </p>
              <p style={{
                position: "absolute", top: "calc(15% + 2.4rem)",
                left: 0, right: 0, textAlign: "center",
                fontSize: "clamp(.78rem,2.4vw,.95rem)",
                color: "rgba(255,255,255,0.35)",
                animation: "qs-fade .5s ease .08s both",
              }}>
                Mira el círculo verde sin mover la cabeza
              </p>

              {/* Punto + anillo */}
              <div style={{ position: "relative", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <QSSyncRing progress={syncProgress} />
                <div style={{
                  position: "absolute",
                  width: 120, height: 120, borderRadius: "50%",
                  background: "radial-gradient(circle, rgba(125,211,168,0.1) 0%, transparent 70%)",
                }} />
                <div style={{
                  width: 56, height: 56, borderRadius: "50%",
                  background: "radial-gradient(circle at 38% 38%, #a8e8c8 0%, #7DD3A8 55%, #4db88a 100%)",
                  boxShadow: "0 0 36px rgba(125,211,168,0.55), 0 0 8px rgba(125,211,168,0.3)",
                  animation: "qs-heartbeat 1.1s ease-in-out infinite",
                  position: "relative", zIndex: 2,
                }} />
              </div>
            </>
          )}

          {/* ── Error: no se pudo acceder a la cámara ───────────────── */}
          {syncPhase === "error" && (
            <div style={{
              display: "flex", flexDirection: "column",
              alignItems: "center", gap: 20, padding: "0 32px",
              animation: "qs-fade .3s ease both",
            }}>
              <div style={{
                width: 72, height: 72, borderRadius: "50%",
                background: "rgba(248,113,113,0.15)",
                border: "3px solid #f87171",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <svg width={32} height={32} viewBox="0 0 32 32" fill="none">
                  <line x1="8" y1="8" x2="24" y2="24" stroke="#f87171" strokeWidth={3} strokeLinecap="round" />
                  <line x1="24" y1="8" x2="8" y2="24" stroke="#f87171" strokeWidth={3} strokeLinecap="round" />
                </svg>
              </div>
              <p style={{ fontSize: "clamp(.9rem,3vw,1.1rem)", fontWeight: 800, color: "#f87171", margin: 0, textAlign: "center" }}>
                Error de cámara
              </p>
              <p style={{ fontSize: ".78rem", color: "rgba(255,255,255,0.35)", margin: 0, textAlign: "center", maxWidth: 280, lineHeight: 1.6 }}>
                {syncError}
              </p>
              <button
                onClick={handleCancelSync}
                style={{
                  padding: "10px 28px", borderRadius: 12, border: "none",
                  background: "rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.6)",
                  fontFamily: "'Lexend',sans-serif", fontWeight: 700, fontSize: ".88rem",
                  cursor: "pointer",
                }}
              >
                Cerrar
              </button>
            </div>
          )}

          {/* ── Success: ¡Listo! ─────────────────────────────────────── */}
          {syncPhase === "success" && (
            <div style={{
              display: "flex", flexDirection: "column",
              alignItems: "center", gap: 20,
              animation: "qs-pop .45s cubic-bezier(.34,1.56,.64,1) both",
            }}>
              <div style={{
                width: 88, height: 88, borderRadius: "50%",
                background: "radial-gradient(circle at 38% 38%, #a8e8c8 0%, #7DD3A8 60%, #4db88a 100%)",
                boxShadow: "0 0 40px rgba(125,211,168,0.6)",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <svg width={42} height={42} viewBox="0 0 42 42" fill="none">
                  <polyline points="7,22 17,32 35,11" stroke="#fff" strokeWidth={4.5} strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <p style={{ fontSize: "clamp(1.1rem,3vw,1.45rem)", fontWeight: 900, color: "#7DD3A8", margin: 0 }}>
                ¡Mirada activada!
              </p>
              <p style={{ fontSize: ".82rem", color: "rgba(255,255,255,0.35)", margin: 0 }}>
                El cursor de mirada ya está activo
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
