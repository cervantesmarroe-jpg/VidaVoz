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
// Estos valores son la "fábrica" del dispositivo. El QuickSync de 3 s ajusta
// el offset individual (alpha) sin tocar la pendiente (beta) del perfil.
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
   * Coeficientes maestros grabados de fábrica con el sistema de 10 muestras.
   * Si están presentes, el QuickSync los usa como punto de partida en lugar
   * de partir desde cero; solo ajusta el offset individual (alphaX/Y).
   */
  model?: {
    alphaX: number;
    betaX:  number;
    alphaY: number;
    betaY:  number;
  };
}

export const GAZE_PROFILES: Record<ProfileId, GazeProfile> = {
  tablet: {
    id:           'tablet',
    label:        'Modo Tablet',
    distanceCm:   40,
    sensitivityX: -1.45,
    sensitivityY:  1.25,
  },
  mobile: {
    id:          'mobile',
    label:       'Modo Móvil',
    distanceCm:  25,
    sensitivityX: -2.40,
    sensitivityY: 2.00,
    // Este es el ADN que acabas de generar con las 10 muestras:
    model: {
      alphaX: 314.6914,
      betaX: -864,
      alphaY: 321.5056,
      betaY: -1328
    }
  },
};

// Perfil por defecto si el usuario no elige (genérico, distancia media)
export const DEFAULT_PROFILE_ID: ProfileId = 'mobile';
