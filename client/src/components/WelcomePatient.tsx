import { useEffect, useMemo } from "react";
import { gazeTracker } from "@/hooks/use-webgazer";

interface WelcomePatientProps {
  onDone: () => void;
}

const TOTAL_MS         = 4000;
const STABILIZATION_MS = 2000;
const SAMPLING_HZ      = 10;
const VALID_RATE_MIN   = 0.5;

// Color del texto "Hola" según el modo seleccionado:
//   tablet → verde profundo (acento principal de la app)
//   mobile → azul profundo (alto contraste sobre crema)
const TEXT_COLOR_BY_PROFILE: Record<string, string> = {
  tablet: "#15803D",
  mobile: "#1D4ED8",
};

// ─────────────────────────────────────────────────────────────────────────────
// Pantalla de bienvenida del paciente — "Hola" sobre fondo crema cálido.
// El color del texto cambia según el modo: verde en tablet, azul en móvil.
//
// Aparece UNA SOLA VEZ por sesión, justo después de aceptar el consentimiento
// de cámara y de que el tracker confirme detección. Dura 4 s exactos, no es
// interrumpible y mientras está visible ejecuta un autoajuste silencioso del
// offset alpha:
//
//   • Primeros 2 s : estabilización del tracker (no se muestrea).
//   • Últimos 2 s  : se recogen muestras a 10 Hz mientras el paciente mira el
//                    centro ("Hola"). Si el rostro y los dos ojos abiertos
//                    están presentes en >50 % de los intentos, se aplica la
//                    corrección de centro al estado de SESIÓN del tracker.
//                    En caso contrario las muestras se descartan y el perfil
//                    de fábrica queda intacto.
//
// La pantalla cubre toda la interfaz (z-index 9998), bloquea cualquier toque y
// no contiene ningún elemento interactivo ni .gaze-target — el cursor de
// mirada queda visible pero no puede activar nada por debajo.
// ─────────────────────────────────────────────────────────────────────────────
export default function WelcomePatient({ onDone }: WelcomePatientProps) {
  // Color del texto fijado al montar — el perfil no cambia durante los 4 s.
  const textColor = useMemo(() => {
    const id = gazeTracker.currentProfile?.id ?? "tablet";
    return TEXT_COLOR_BY_PROFILE[id] ?? TEXT_COLOR_BY_PROFILE.tablet;
  }, []);

  useEffect(() => {
    let validSamples = 0;
    let attempts     = 0;
    const start      = performance.now();

    // Reseteo defensivo: limpia cualquier muestra acumulada de fases previas.
    gazeTracker.discardSilentSamples();

    const sampler = setInterval(() => {
      // Descartar los primeros 2 s de estabilización.
      if (performance.now() - start < STABILIZATION_MS) return;

      attempts++;
      const status = gazeTracker.getFaceStatus();
      if (status.detected && status.bothEyesOpen) {
        if (gazeTracker.collectSilentCenterSample()) validSamples++;
      }
    }, 1000 / SAMPLING_HZ);

    const finish = setTimeout(() => {
      clearInterval(sampler);

      const validRate = attempts > 0 ? validSamples / attempts : 0;
      if (validRate >= VALID_RATE_MIN) {
        gazeTracker.applySilentCenterCalibration();
      } else {
        console.log(
          `[Bienvenida] Rostro inestable (${(validRate * 100).toFixed(0)}% válido) — sin corrección`,
        );
        gazeTracker.discardSilentSamples();
      }
      onDone();
    }, TOTAL_MS);

    return () => {
      clearInterval(sampler);
      clearTimeout(finish);
    };
  }, [onDone]);

  return (
    <div
      data-testid="welcome-patient"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9998,
        background: "#FFF8E7",       // crema cálido en línea con la app
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        pointerEvents: "all",
        userSelect: "none",
        WebkitUserSelect: "none" as const,
      }}
    >
      <span
        style={{
          color: textColor,
          fontFamily: "'Lexend', sans-serif",
          fontWeight: 800,
          fontSize: "clamp(140px, 26vw, 320px)",
          letterSpacing: "0.02em",
          lineHeight: 1,
          textShadow: `0 4px 28px ${textColor}33`,
          animation: "welcome-fade 4s ease-in-out forwards",
        }}
      >
        Hola
      </span>

      <style>{`
        @keyframes welcome-fade {
          0%   { opacity: 0; transform: scale(0.94); }
          10%  { opacity: 1; transform: scale(1); }
          85%  { opacity: 1; transform: scale(1); }
          100% { opacity: 0; transform: scale(1.02); }
        }
      `}</style>
    </div>
  );
}
