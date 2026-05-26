import { ReactNode, useRef, useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { Link, useLocation } from "wouter";
import {
  Eye, EyeOff, ClipboardCopy,
} from "lucide-react";
import {
  SirenColor as AlertTriangle,
  ChatColor as MessageSquareText,
  BarsColor as ActivitySquare,
  KeyboardColor as KeyboardIcon,
} from "@/components/icons/ColorIcons";

import logoPath from "@assets/VidaVoz_1775644489589.png";
import { ConsentModal, useConsent } from "@/components/ConsentModal";
import { useWebGazer, gazeTracker } from "@/hooks/use-webgazer";
import { CalibrationScreen } from "@/components/CalibrationScreen";
import { MasterTrainingOverlay } from "@/components/MasterTrainingOverlay";
import WelcomePatient from "@/components/WelcomePatient";

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

import { DWELL_MS as TAB_DWELL_MS } from "@/lib/dwell";

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
        filter: active ? "none" : "grayscale(0.7) opacity(0.55)",
        transition: "filter 0.2s",
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

// ── Layout principal ──────────────────────────────────────────────────────────
export function FullscreenLayout({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  const isPortrait = useIsPortrait();
  const { accepted, mode, accept, decline } = useConsent();
  const {
    isActive, isCalibrating,
    activateFromProfile, deactivate,
  } = useWebGazer();

  // ── Estado de activación ──────────────────────────────────────────────────
  // "loading" = cargando modelo ML y/o cámara por primera vez / tras parar
  const [loading, setLoading] = useState(false);

  // ── Entrenamiento Maestro ─────────────────────────────────────────────────
  const [showTraining, setShowTraining] = useState(false);

  // ── Pantalla de bienvenida + autoajuste silencioso de centro (4 s) ─────────
  // Se muestra UNA SOLA VEZ por sesión (flag en sessionStorage) cuando la
  // mirada se activa por primera vez tras aceptar el consentimiento. Como
  // FullscreenLayout se remonta en cada cambio de página, el flag impide que
  // la pantalla "Bienvenido a VidaVoz" reaparezca al navegar entre las 4
  // pantallas. La calibración obtenida se mantiene durante toda la sesión.
  const WELCOME_KEY = "vozuci-welcome-shown-v1";
  const [showWelcome, setShowWelcome] = useState(false);
  useEffect(() => {
    if (isActive && !sessionStorage.getItem(WELCOME_KEY)) {
      sessionStorage.setItem(WELCOME_KEY, "1");
      setShowWelcome(true);
    }
  }, [isActive]);

  // ── Log periódico cuando la mirada está activa ────────────────────────────
  useEffect(() => {
    if (!isActive) return;
    gazeTracker.logDebugInfo('GazeTracker: seguimiento activo');
    const iv = setInterval(() => gazeTracker.logDebugInfo('GazeTracker: estado en vivo'), 4000);
    return () => clearInterval(iv);
  }, [isActive]);

  // Modo táctil: persistimos la decisión en localStorage. El paciente usa
  // toque directo sobre los botones sin que la cámara se active. Tras esto,
  // el modal NO debe volver a aparecer en ninguna navegación de la sesión.
  const handleDecline = () => { decline(); };

  // ── "Activar / Desactivar Mirada" ─────────────────────────────────────────
  //
  //  • Perfil Maestro: loadProfile() ya cargó alpha/beta de fábrica al elegir
  //    dispositivo → no hay QuickSync ni calibración visual.
  //  • Primera activación (o tras parar cámara): init modelo + startCamera → active.
  //    El modelo MediaPipe se descarga una sola vez y persiste en memoria.
  //  • Segunda activación (modelo+cámara ya listos): solo startCamera si hace
  //    falta → Efecto D arranca detección de inmediato.
  //
  const handleGazeToggle = useCallback(async () => {
    // Desactivar si ya está activa / calibrando
    if (isActive || isCalibrating) {
      deactivate();
      return;
    }

    // Si modelo Y cámara ya están listos, activar sin espera
    if (gazeTracker.hasFaceModel && gazeTracker.hasCamera) {
      activateFromProfile();
      return;
    }

    // Necesitamos inicializar (primera vez o tras parar cámara)
    setLoading(true);
    try {
      if (!gazeTracker.hasFaceModel) await gazeTracker.init();
      if (!gazeTracker.hasCamera)    await gazeTracker.startCamera();
      activateFromProfile();
    } catch (err) {
      console.error('[VidaVoz] Error iniciando cámara/modelo:', err);
      // Re-lanza para que el efecto de auto-activación reciba el error y
      // pueda limpiar el flag — si no, la app quedaría sin mirada y sin
      // posibilidad de reintento automático en futuras navegaciones.
      throw err;
    } finally {
      setLoading(false);
    }
  }, [isActive, isCalibrating, deactivate, activateFromProfile]);

  // ── Auto-activación de la mirada al aceptar consentimientos ────────────────
  // En cuanto el cuidador acepta la cámara, arrancamos el seguimiento ocular
  // automáticamente — sin pulsar "Activar Mirada". El toque sigue funcionando
  // siempre (lo gestiona globalCursor.ts en paralelo). Si el cuidador eligió
  // "modo táctil" (handleDecline), no arrancamos la cámara.
  // El flag de sesión garantiza que el arranque automático sucede UNA sola vez:
  // si el cuidador desactiva luego la mirada manualmente, no se reactiva sola.
  const AUTOSTART_KEY = "vozuci-gaze-autostarted-v1";
  useEffect(() => {
    if (!accepted) return;
    // En modo táctil NUNCA arrancamos la cámara, aunque el componente se
    // remonte al navegar entre pantallas.
    if (mode === "tactile") return;
    if (isActive || isCalibrating || loading) return;
    if (sessionStorage.getItem(AUTOSTART_KEY)) return;

    sessionStorage.setItem(AUTOSTART_KEY, "1");
    handleGazeToggle().catch(() => {
      // Si arranque falla, limpiamos el flag para que el cuidador pueda
      // reintentar manualmente con el botón sin que el efecto se vuelva
      // a disparar automáticamente y bloquee la UI.
      sessionStorage.removeItem(AUTOSTART_KEY);
    });
  }, [accepted, mode, isActive, isCalibrating, loading, handleGazeToggle]);

  // ── Estilo del botón según estado ─────────────────────────────────────────
  const btnStyle: React.CSSProperties = (() => {
    if (isActive)
      return { background: "#D5F5E3", color: "#145A30", borderColor: "#A8E6C8",
               boxShadow: "0 0 10px rgba(20,150,70,0.15)" };
    if (isCalibrating || loading)
      return { background: "#FCF3CF", color: "#6B4C00", borderColor: "#F0DC80" };
    return { background: "#F5F5F5", color: "#555555", borderColor: "#E0E0E0" };
  })();

  const btnLabel = isActive
    ? "Mirada activa"
    : isCalibrating
    ? "Calibrando…"
    : loading
    ? "Iniciando…"
    : "Activar mirada";

  return (
    <div className="flex flex-col overflow-hidden" style={{ height: "100dvh", background: "#FAFAFA" }}>

      {/* Calibración 9 puntos (solo si algo externo llama startCalibration) */}
      {isCalibrating && <CalibrationScreen />}

      {/* Bienvenida del paciente + autoajuste silencioso de centro (4 s) */}
      {showWelcome && <WelcomePatient onDone={() => setShowWelcome(false)} />}

      {/* Consent modal */}
      {!accepted && <ConsentModal onAccept={accept} onDecline={handleDecline} />}

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <header style={{
        height: "48px",
        marginTop: "0",
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
            disabled={loading}
            style={{
              display: "flex", alignItems: "center", gap: 6,
              padding: "5px 12px", borderRadius: 12,
              fontFamily: "'Lexend',sans-serif", fontWeight: 700, fontSize: "0.78rem",
              cursor: loading ? "wait" : "pointer",
              border: "1.5px solid", transition: "all 0.2s",
              ...btnStyle,
            }}
          >
            {/* Spinner cuando carga, icono de ojo en otro caso */}
            {loading ? (
              <span style={{
                display: "inline-block", width: 12, height: 12,
                border: "2px solid rgba(107,76,0,0.3)",
                borderTop: "2px solid #6B4C00",
                borderRadius: "50%",
                animation: "spin 0.8s linear infinite",
                flexShrink: 0,
              }} />
            ) : isActive || isCalibrating ? (
              <Eye style={{ width: 14, height: 14, flexShrink: 0 }} />
            ) : (
              <EyeOff style={{ width: 14, height: 14, flexShrink: 0 }} />
            )}
            <span>{btnLabel}</span>
          </button>

          {/* Calibrar ADN */}
          <button
            data-testid="button-master-training"
            onClick={() => setShowTraining(true)}
            title="Abrir sistema de entrenamiento maestro"
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

      {/* Keyframes para el spinner del botón */}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
