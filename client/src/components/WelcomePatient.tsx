import { useEffect } from "react";
import { gazeTracker } from "@/hooks/use-webgazer";

interface WelcomePatientProps {
  onDone: () => void;
}

const TOTAL_MS         = 4000;
const STABILIZATION_MS = 2000;
const SAMPLING_HZ      = 10;
const VALID_RATE_MIN   = 0.5;

// ─────────────────────────────────────────────────────────────────────────────
// Pantalla de bienvenida del paciente — "Hola" sobre fondo oscuro.
//
// Aparece cuando el cuidador activa la mirada y el tracker confirma detección.
// Dura 4 s exactos, no es interrumpible y mientras está visible ejecuta un
// autoajuste silencioso del offset alpha:
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
        background: "#0E1116",
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
          color: "#FFFFFF",
          fontFamily: "'Lexend', sans-serif",
          fontWeight: 700,
          fontSize: "clamp(120px, 22vw, 280px)",
          letterSpacing: "0.02em",
          textShadow: "0 4px 40px rgba(125,211,168,0.35)",
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
