import { useEffect } from "react";
import {
  gazeTracker,
  CALIBRATIONS_LIBRARY,
  type CalibrationLibraryEntry,
} from "@/hooks/use-webgazer";

interface WelcomePatientProps {
  onDone: () => void;
}

const TOTAL_MS         = 4000;
const STABILIZATION_MS = 2000;
const SAMPLING_HZ      = 10;
const VALID_RATE_MIN   = 0.5;

// ── Selector del mejor modelo ──────────────────────────────────────────────
// Recorre TODAS las entradas de la librería sin filtrar por profile. Para
// cada modelo predice (alpha + beta * eye) la posición de pantalla que
// produciría cada muestra ocular y compara con el centro real del viewport.
// El error final por modelo es MSE / score: a igual MSE gana el modelo con
// mayor score (más respaldado). Devuelve null si no hay muestras o librería.
function selectBestModel(
  library: ReadonlyArray<CalibrationLibraryEntry>,
  samples: ReadonlyArray<{ eyeX: number; eyeY: number }>,
  centerX: number,
  centerY: number,
): { entry: CalibrationLibraryEntry; mse: number; weightedError: number } | null {
  if (library.length === 0 || samples.length === 0) return null;

  let bestEntry:    CalibrationLibraryEntry | null = null;
  let bestWeighted = Infinity;
  let bestMse      = Infinity;

  for (const entry of library) {
    const m = entry.model;
    let sumSq = 0;
    for (const s of samples) {
      const px = m.alphaX + m.betaX * s.eyeX;
      const py = m.alphaY + m.betaY * s.eyeY;
      const dx = px - centerX;
      const dy = py - centerY;
      sumSq += dx * dx + dy * dy;
    }
    const mse      = sumSq / samples.length;
    const weight   = entry.score > 0 ? entry.score : 1;
    const weighted = mse / weight;
    if (weighted < bestWeighted) {
      bestWeighted = weighted;
      bestMse      = mse;
      bestEntry    = entry;
    }
  }
  return bestEntry ? { entry: bestEntry, mse: bestMse, weightedError: bestWeighted } : null;
}

const BRAND_BLUE = "#1D4ED8";
const CREAM_BG   = "#FFF8E7";

// ─────────────────────────────────────────────────────────────────────────────
// Pantalla de bienvenida del paciente — "Bienvenido a VidaVoz" sobre crema.
//
// Aparece UNA SOLA VEZ por sesión, justo después de que el cuidador acepte el
// consentimiento de cámara y se active el seguimiento ocular. Dura 4 s exactos,
// no es interrumpible y mientras está visible ejecuta un autoajuste silencioso
// del offset alpha del tracker:
//
//   • Primeros 2 s : estabilización (no se muestrea).
//   • Últimos 2 s  : muestreo a 10 Hz mirando el centro. Si el rostro y los dos
//                    ojos abiertos están presentes en >50 % de los intentos, se
//                    aplica la corrección al offset de SESIÓN del tracker.
//                    En caso contrario las muestras se descartan y el perfil de
//                    fábrica queda intacto.
//
// La pantalla cubre toda la interfaz (z-index 9998), bloquea cualquier toque y
// no contiene ningún elemento interactivo — el cursor de mirada queda visible
// pero no puede activar nada por debajo.
//
// Tipografía: 'Gliker' (display redondeada, igual que el branding del logo).
// Si la fuente no está instalada, cae a 'Lexend' (Google Fonts ya cargada).
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
        // 1) Elegir el modelo de la librería que mejor predice el centro
        //    de pantalla con las muestras oculares actuales del paciente.
        //    Se evalúan TODAS las entradas (mobile + tablet juntas); el
        //    perfil del modelo ganador no importa, solo su ajuste real.
        const samples = gazeTracker.getSilentSamples();
        const cx      = window.innerWidth  / 2;
        const cy      = window.innerHeight / 2;
        const winner  = selectBestModel(
          CALIBRATIONS_LIBRARY,
          samples,
          cx,
          cy,
        );
        if (winner) {
          gazeTracker.applyCalibrationModel(winner.entry.model);
          console.log(
            `%c[Bienvenida] Modelo elegido ✓`,
            'color:#7DD3A8;font-weight:800',
            `| id=${winner.entry.id}`,
            `| profile=${winner.entry.profile}`,
            `| score=${winner.entry.score}`,
            `| mse=${winner.mse.toFixed(0)}px²`,
            `| weighted=${winner.weightedError.toFixed(0)}`,
            `| n=${samples.length}`,
          );
        } else {
          console.log(
            `[Bienvenida] No se eligió modelo (librería vacía o sin muestras) — se mantiene el modelo activo del tracker; el ajuste de offset siguiente se aplicará sobre él`,
          );
        }

        // 2) Encima del modelo elegido, aplica la corrección de offset
        //    alpha calculada con las mismas muestras del centro. Esto deja
        //    los betas (sensibilidad) del modelo ganador y solo desplaza
        //    su origen al ojo real del paciente.
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
        background: CREAM_BG,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "0 6vw",
        textAlign: "center",
        pointerEvents: "all",
        userSelect: "none",
        WebkitUserSelect: "none" as const,
      }}
    >
      <span
        style={{
          color: BRAND_BLUE,
          fontFamily: "'Gliker', 'Lexend', sans-serif",
          fontWeight: 800,
          fontSize: "clamp(56px, 9vw, 140px)",
          letterSpacing: "0.01em",
          lineHeight: 1.05,
          textShadow: `0 4px 28px ${BRAND_BLUE}26`,
          animation: "welcome-fade 4s ease-in-out forwards",
        }}
      >
        Bienvenido a VidaVoz
      </span>

      <style>{`
        @keyframes welcome-fade {
          0%   { opacity: 0; transform: scale(0.96); }
          10%  { opacity: 1; transform: scale(1); }
          85%  { opacity: 1; transform: scale(1); }
          100% { opacity: 0; transform: scale(1.02); }
        }
      `}</style>
    </div>
  );
}
