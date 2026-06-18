// ─── Perfiles Maestros de Mirada — VozUCI/Vidavoz ────────────────────────────
//
// Parámetros derivados de la física del seguimiento ocular:
//
//   betaX = sensitivityX * window.innerWidth
//   betaY = sensitivityY * window.innerHeight  (negativo → corrige eje Y invertido)
//   alphaX = cx - betaX * avgEyeX_en_centro
//   alphaY = cy - betaY * avgEyeY_en_centro
//
// Distancia de uso:
//   Tablet   40 cm — pantalla grande, necesita menos amplificación angular
//   Móvil    25 cm — pantalla pequeña, el ojo cubre menos píxeles por grado
//
// Estos valores son el "ADN de fábrica" del dispositivo. Al pulsar "Activar Mirada"
// la cámara arranca directamente con estos coeficientes, sin ninguna calibración visual.
// El auto-ajuste continuo (nudge 8% por toque/blink) corrige el offset individual
// del paciente en segundo plano mientras usa la app.
// ─────────────────────────────────────────────────────────────────────────────

export type ProfileId = 'tablet' | 'mobile';

export interface GazeProfile {
  id:           ProfileId;
  label:        string;
  distanceCm:   number;
  /** Multiplicador horizontal. Negativo corrige el espejo de la cámara frontal. */
  sensitivityX: number;
  /** Multiplicador vertical. Positivo = arriba es positivo en blendshapes. */
  sensitivityY: number;
  /**
   * Corrección de offset vertical en píxeles. Se aplica al rawY inmediatamente
   * después del modelo de regresión, antes del ring-buffer.
   * Valor negativo → desplaza el cursor hacia ARRIBA (corrige sesgo hacia abajo).
   * Valor positivo → desplaza hacia abajo.
   * Principalmente para cámara frontal de móvil, cuyo ángulo provoca que el
   * cursor aparezca más abajo de donde se mira.
   */
  verticalOffsetPx?: number;
  /** ADN de fábrica: coeficientes de regresión grabados en fábrica para este dispositivo. */
  model?: {
    alphaX: number;
    betaX:  number;
    alphaY: number;
    betaY:  number;
  };
}

export const GAZE_PROFILES: Record<ProfileId, GazeProfile> = {
  tablet: {
    id: 'tablet',
    label: 'Modo Tablet',
    distanceCm: 40, // Distancia estándar para tablet en soporte
    // Sensibilidades calculadas con tus 30 muestras
    sensitivityX: -2.4092,
    sensitivityY: 0.9633,
    model: {
      alphaX: 1491.2707,
      betaX: -4625.5720,
      alphaY: 749.6392,
      betaY: -1040.3134
    }
  },
  mobile: {
    id: 'mobile',
    label: 'Modo Móvil',
    distanceCm: 25,
    sensitivityX: -1.80, // Menos nervioso, más control
    sensitivityY: 1.50,
    verticalOffsetPx: -80, // La cámara frontal del móvil introduce un sesgo hacia abajo; −80 px lo compensa
    model: {
      alphaX: 180.00, // Punto central equilibrado
      betaX: -750.00, // Recorrido estándar para 360px de ancho
      alphaY: 150.00, 
      betaY: -1100.00 // Recorrido estándar para 664px de alto
    }
  },
};

// Perfil por defecto si el usuario no elige (genérico, distancia media)
export const DEFAULT_PROFILE_ID: ProfileId = 'mobile';
