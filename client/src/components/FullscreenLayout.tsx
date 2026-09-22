import { ReactNode, useRef, useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { Link, useLocation } from "wouter";
import { CircleDot } from "lucide-react";
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

// ── Hook: ancho < 768 px (móvil + tablet pequeña) ────────────────────────────
function useIsMobile() {
  const [mobile, setMobile] = useState(
    () => typeof window !== "undefined" && window.innerWidth < 768,
  );
  useEffect(() => {
    const update = () => setMobile(window.innerWidth < 768);
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);
  return mobile;
}

import { DWELL_MS as TAB_DWELL_MS } from "@/lib/dwell";

// Controla SOLO la visibilidad del overlay "Bienvenido a VidaVoz" al activar
// la mirada. El autoajuste de calibración que corre durante esos 4 s
// (selección de modelo, escalado de beta, offset) NO depende de esta
// constante y sigue ejecutándose aunque se ponga en false.
const SHOW_SPLASH = true;

const TABS = [
  { path: "/",         Icon: AlertTriangle,    label: "URGENTE",  color: "#f87171" },
  { path: "/mensajes", Icon: MessageSquareText, label: "MENSAJES", color: "#38bdf8" },
  { path: "/escalas",  Icon: ActivitySquare,   label: "ESCALAS",  color: "#fbbf24" },
  { path: "/teclado",  Icon: KeyboardIcon,     label: "TECLADO",  color: "#a78bfa" },
];

// ── Pestaña de navegación ─────────────────────────────────────────────────────
interface SideTabProps {
  path:       string;
  Icon:       React.ElementType;
  label:      string;
  color:      string;
  active:     boolean;
  isPortrait: boolean;
  isMobile:   boolean;
}

function SideTab({ path, Icon, label, color, active, isPortrait, isMobile }: SideTabProps) {
  const [, navigate] = useLocation();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fillRef  = useRef<HTMLDivElement>(null);

  // En portrait + escritorio: layout horizontal (icon y texto en fila).
  // En portrait + móvil o en landscape: layout vertical (icon encima del texto).
  const useRow = isPortrait && !isMobile;

  const startDwell = useCallback(() => {
    if (timerRef.current || active) return;
    const fill = fillRef.current;
    if (fill) {
      fill.style.transition = "none";
      if (useRow) {
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
  }, [active, path, navigate, useRow]);

  const cancelDwell = useCallback(() => {
    if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
    const fill = fillRef.current;
    if (fill) { fill.style.transition = "none"; fill.style.height = "0%"; fill.style.width = "0%"; }
  }, []);

  return (
    <Link
      href={path}
      className="gaze-target"
      data-gaze-target="true"
      onPointerEnter={startDwell}
      onPointerLeave={cancelDwell}
      data-testid={`sidetab-${label.toLowerCase()}`}
      style={{
        position: "relative",
        display: "flex",
        flexDirection: useRow ? "row" : "column",
        alignItems: "center",
        justifyContent: "center",
        gap: useRow ? "6px" : "4px",
        flex: isPortrait ? 1 : undefined,
        width: isPortrait ? undefined : "100%",
        height: isPortrait ? "100%" : undefined,
        padding: useRow ? "8px 4px" : "10px 4px",
        borderRadius: useRow ? "8px" : "10px",
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
          ...(useRow
            ? { top: 0, bottom: 0, left: 0, width: "0%", height: "100%" }
            : { bottom: 0, left: 0, right: 0, height: "0%", width: "100%" }),
          background: `${color}33`, pointerEvents: "none",
        }}
      />
      <Icon style={{
        width:  isMobile ? 26 : (useRow ? 20 : 22),
        height: isMobile ? 26 : (useRow ? 20 : 22),
        color: active ? color : "#AAAAAA", position: "relative", zIndex: 1, flexShrink: 0,
        filter: active ? "none" : "grayscale(0.7) opacity(0.55)",
        transition: "filter 0.2s",
      }} />
      {!isMobile && (
        <span style={{
          fontSize: useRow ? "0.58rem" : "0.5rem",
          fontWeight: 800, letterSpacing: "0.06em",
          textTransform: "uppercase", color: active ? color : "#AAAAAA",
          position: "relative", zIndex: 1, lineHeight: 1.2, textAlign: "center",
        }}>
          {label}
        </span>
      )}
    </Link>
  );
}

// ── Botón informativo "modo pulsador" (control del cuidador, discreto) ───────
// Marcador de espacio para una futura función de acceso por pulsador externo.
// NO activa ningún escaneo ni modo — es puramente informativo. Fijo en una
// esquina, pequeño y de bajo contraste. Sin data-gaze-target: invisible para
// la mirada/dwell del paciente, así nunca puede activarse por accidente.
function PulsadorInfoButton() {
  const [open, setOpen] = useState(false);

  return (
    <div style={{ position: "absolute", top: 8, left: 8, zIndex: 220 }}>
      <button
        data-testid="button-pulsador-info"
        onClick={() => setOpen((o) => !o)}
        aria-label="Información sobre el modo pulsador (función futura)"
        style={{
          width: 30,
          height: 30,
          borderRadius: "50%",
          background: "rgba(100,116,139,0.12)",
          border: "1px solid rgba(100,116,139,0.25)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: "pointer",
          touchAction: "manipulation",
          WebkitTapHighlightColor: "transparent",
        }}
      >
        <CircleDot size={14} color="#64748B" />
      </button>

      {open && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 6px)", left: 0,
            width: 240,
            background: "#FFFFFF",
            border: "1px solid #E2E8F0",
            borderRadius: 10,
            boxShadow: "0 8px 20px rgba(0,0,0,0.15)",
            padding: "10px 12px",
          }}
        >
          <span style={{
            display: "block",
            fontFamily: "'Lexend',sans-serif",
            fontWeight: 800,
            fontSize: ".68rem",
            letterSpacing: ".05em",
            textTransform: "uppercase",
            color: "#334155",
            marginBottom: 4,
          }}>
            Modo pulsador (próximamente)
          </span>
          <span style={{
            display: "block",
            fontFamily: "'Lexend',sans-serif",
            fontWeight: 500,
            fontSize: ".72rem",
            color: "#64748B",
            lineHeight: 1.4,
          }}>
            Permitirá confirmar botones con un pulsador externo, sin cámara.
            Función en desarrollo — de momento use mirada o parpadeo.
          </span>
        </div>
      )}
    </div>
  );
}

// ── Layout principal ──────────────────────────────────────────────────────────
export function FullscreenLayout({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  const isPortrait = useIsPortrait();
  const isMobile   = useIsMobile();
  const { accepted, mode: consentMode, accept, decline } = useConsent();
  const {
    isActive, isCalibrating,
    activateFromProfile, deactivate,
  } = useWebGazer();

  // ── Estado de activación ──────────────────────────────────────────────────
  // "loading" = cargando modelo ML y/o cámara por primera vez / tras parar
  const [loading, setLoading] = useState(false);

  // ── Entrenamiento Maestro ─────────────────────────────────────────────────
  const [showTraining, setShowTraining] = useState(false);

  // ── Bienvenida + autoajuste silencioso de centro (4 s) ──────────────────
  // Se ejecuta UNA SOLA VEZ por sesión (flag en sessionStorage) cuando la
  // mirada se activa por primera vez tras aceptar el consentimiento. Esto
  // SIEMPRE debe montarse — WelcomePatient no es solo un splash visual: en
  // su efecto interno selecciona el mejor modelo de calibración, escala
  // beta para cubrir toda la pantalla y corrige el offset alpha. Sin este
  // paso el cursor queda comprimido/descentrado (ver SHOW_SPLASH abajo).
  // SHOW_SPLASH solo controla si esos 4 s se muestran visualmente al
  // paciente; la calibración corre igual con la pantalla oculta.
  const WELCOME_KEY = "vozuci-welcome-shown-v1";
  const [showWelcome, setShowWelcome] = useState(false);
  useEffect(() => {
    if (isActive && !sessionStorage.getItem(WELCOME_KEY)) {
      sessionStorage.setItem(WELCOME_KEY, "1");
      setShowWelcome(true);
    }
  }, [isActive]);

  // ── Estabilización al cambiar de pantalla ────────────────────────────────
  // Los buffers de suavizado (ring-buffer MA + One-Euro) acumulan muestras de
  // la pantalla anterior; al montar una nueva pantalla el cursor puede dispararse
  // a los extremos hasta que el buffer se "llena" con muestras válidas.
  // resetSmoothing() descarta el historial sin interrumpir el loop de detección
  // ni perder la calibración, de modo que el primer frame de la nueva pantalla
  // se toma como valor inicial limpio.
  useEffect(() => {
    if (!isActive) return;
    gazeTracker.resetSmoothing();
  }, [location, isActive]);

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

  // ── Cámara / mirada automáticas tras el consentimiento ────────────────────
  // Se enciende sola en cuanto el cuidador acepta la cámara (mirada +
  // parpadeo están siempre activos, sin depender de ningún selector de modo).
  // Si el cuidador eligió "modo táctil" (handleDecline, sin permiso de
  // cámara), nunca se enciende.
  useEffect(() => {
    if (!accepted) return;
    if (consentMode === "tactile") return;
    if (!isActive && !isCalibrating && !loading) handleGazeToggle().catch(() => {});
  }, [accepted, consentMode, isActive, isCalibrating, loading, handleGazeToggle]);

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
    <div className="flex flex-col overflow-hidden" style={{ height: "100dvh", background: "#FAFAFA", position: "relative" }}>

      {/* Calibración 9 puntos (solo si algo externo llama startCalibration) */}
      {isCalibrating && <CalibrationScreen />}

      {/* Bienvenida del paciente + autoajuste silencioso de centro (4 s) */}
      {showWelcome && <WelcomePatient visible={SHOW_SPLASH} onDone={() => setShowWelcome(false)} />}

      {/* Consent modal */}
      {!accepted && <ConsentModal onAccept={accept} onDecline={handleDecline} />}

      {/* Botón informativo "modo pulsador" — discreto, en una esquina, fuera
          del alcance de la mirada del paciente. No activa ningún escaneo. */}
      <PulsadorInfoButton />

      {/* ── Header eliminado ─────────────────────────────────────────────
          La cabecera blanca con logo + "Activar mirada" + "Calibrar ADN"
          se retiró por petición del usuario. Toda la lógica subyacente
          permanece intacta (handleGazeToggle, btnStyle, btnLabel, loading,
          isActive, isCalibrating, showTraining, MasterTrainingOverlay)
          para poder reactivar los controles desde otra pantalla sin
          tener que reescribir el comportamiento. La cuadrícula principal
          ocupa ahora el 100% del alto disponible.
       ──────────────────────────────────────────────────────────────── */}

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
            width: "100%",
            height: isMobile ? "68px" : "58px",
            flexShrink: 0,
            background: "#FFFFFF", borderTop: "1px solid #E0E0E0",
            display: "flex", flexDirection: "row", alignItems: "stretch",
            gap: 4,
            padding: isMobile
              ? "4px 4px calc(4px + env(safe-area-inset-bottom, 0px))"
              : "4px 6px",
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
              isMobile={isMobile}
            />
          ))}
        </nav>
      </div>

      {/* ── Overlay Entrenamiento Maestro ─────────────────────────────── */}
      {showTraining && <MasterTrainingOverlay onClose={() => setShowTraining(false)} />}

    </div>
  );
}
