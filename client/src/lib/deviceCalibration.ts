// ── Identificador de dispositivo ─────────────────────────────────────────────
// Usa dimensiones físicas del panel + pixel ratio, independiente de orientación.
export function deviceKey(): string {
  return `${screen.width}x${screen.height}@${devicePixelRatio}`;
}

const SESSIONS_KEY = 'vozuci-calibration-sessions-v1';

// ── Tipos ─────────────────────────────────────────────────────────────────────

// Parámetros normalizados de una sesión de calibración (independientes del
// tamaño del viewport en el momento de calibrar).
interface CalibrationSession {
  sensitivityX: number;   // betaX / screenW  (negativo)
  sensitivityY: number;   // -betaY / screenH (positivo)
  alphaNormX:   number;   // alphaX / screenW  (fracción del ancho)
  alphaNormY:   number;   // alphaY / screenH  (fracción del alto)
  screenW:      number;
  screenH:      number;
  trainedAt:    string;   // ISO 8601
}

interface AccumulatedCalibration {
  deviceKey: string;
  sessions:  CalibrationSession[];
  updatedAt: string;
}

export interface CalibrationModel {
  alphaX:       number;
  betaX:        number;
  alphaY:       number;
  betaY:        number;
  sensitivityX: number;
  sensitivityY: number;
}

// ── Lectura interna ───────────────────────────────────────────────────────────
function loadRaw(): AccumulatedCalibration | null {
  try {
    const raw = localStorage.getItem(SESSIONS_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as AccumulatedCalibration;
    if (data.deviceKey !== deviceKey()) {
      console.log(
        '[Calibración] Dispositivo diferente — sesiones ignoradas',
        `| guardado=${data.deviceKey}  actual=${deviceKey()}`,
      );
      return null;
    }
    return data;
  } catch {
    return null;
  }
}

// ── API pública ───────────────────────────────────────────────────────────────

/** Número de calibraciones de 9 puntos completadas en este dispositivo. */
export function getSessionCount(): number {
  return loadRaw()?.sessions.length ?? 0;
}

/** true si hay al menos una calibración de 9 puntos completa en este dispositivo. */
export function hasRealCalibration(): boolean {
  return getSessionCount() > 0;
}

/**
 * Añade la nueva sesión de calibración a la lista acumulada.
 * No reemplaza — agrega. Cuantas más sesiones, más estable el modelo promedio.
 */
export function saveCalibrationSession(model: CalibrationModel): void {
  const W = window.innerWidth;
  const H = window.innerHeight;

  const session: CalibrationSession = {
    sensitivityX: +(model.betaX / W).toFixed(5),
    sensitivityY: +(-model.betaY / H).toFixed(5),
    alphaNormX:   +(model.alphaX / W).toFixed(5),
    alphaNormY:   +(model.alphaY / H).toFixed(5),
    screenW: W,
    screenH: H,
    trainedAt: new Date().toISOString(),
  };

  const existing = loadRaw();
  const sessions = existing ? [...existing.sessions, session] : [session];

  try {
    localStorage.setItem(SESSIONS_KEY, JSON.stringify({
      deviceKey: deviceKey(),
      sessions,
      updatedAt: new Date().toISOString(),
    } satisfies AccumulatedCalibration));
    console.log(
      `%c[Calibración] Sesión ${sessions.length} guardada ✓`,
      'color:#7DD3A8;font-weight:800',
      `| sX=${session.sensitivityX.toFixed(4)}  sY=${session.sensitivityY.toFixed(4)}`,
      `| aNX=${session.alphaNormX.toFixed(3)}  aNY=${session.alphaNormY.toFixed(3)}`,
    );
  } catch {
    // Modo privado o cuota agotada
  }
}

/**
 * Devuelve el modelo de regresión resultante de promediar todas las sesiones
 * acumuladas, adaptado al viewport actual.
 * Devuelve null si no hay sesiones.
 */
export function getMergedModel(): CalibrationModel | null {
  const data = loadRaw();
  if (!data || data.sessions.length === 0) return null;

  const W = window.innerWidth;
  const H = window.innerHeight;
  const n = data.sessions.length;

  const avgSensX  = data.sessions.reduce((s, r) => s + r.sensitivityX, 0) / n;
  const avgSensY  = data.sessions.reduce((s, r) => s + r.sensitivityY, 0) / n;
  const avgNormX  = data.sessions.reduce((s, r) => s + r.alphaNormX,   0) / n;
  const avgNormY  = data.sessions.reduce((s, r) => s + r.alphaNormY,   0) / n;

  return {
    alphaX:       avgNormX * W,
    betaX:        avgSensX * W,
    alphaY:       avgNormY * H,
    betaY:        -avgSensY * H,
    sensitivityX: avgSensX,
    sensitivityY: avgSensY,
  };
}
