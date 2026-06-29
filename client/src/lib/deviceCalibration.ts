// Identificador de dispositivo: dimensiones físicas + pixel ratio.
// screen.width/height son constantes del panel (no cambian con la orientación
// en la mayoría de navegadores). devicePixelRatio distingue pantallas Retina
// de las mismas dimensiones CSS.
export function deviceKey(): string {
  return `${screen.width}x${screen.height}@${devicePixelRatio}`;
}

const STORAGE_KEY = 'vozuci-calibration-v1';

export interface DeviceCalibration {
  deviceKey:    string;
  screenW:      number;  // window.innerWidth en el momento de calibrar
  screenH:      number;  // window.innerHeight en el momento de calibrar
  alphaX:       number;
  betaX:        number;
  alphaY:       number;
  betaY:        number;
  sensitivityX: number;  // betaX / screenW (valor negativo)
  sensitivityY: number;  // -betaY / screenH (valor positivo)
  savedAt:      string;  // ISO 8601
  /** 'calibrationScreen' = calibración de 9 puntos completada por el cuidador.
   *  'welcomePatient'    = selección automática de librería (menos precisa).
   *  undefined           = datos legacy sin campo source.
   *  Solo 'calibrationScreen' es suficiente para omitir la calibración inicial. */
  source?: 'calibrationScreen' | 'welcomePatient';
}

export interface CalibrationModel {
  alphaX:       number;
  betaX:        number;
  alphaY:       number;
  betaY:        number;
  sensitivityX: number;
  sensitivityY: number;
}

export function saveDeviceCalibration(
  model: CalibrationModel,
  source: 'calibrationScreen' | 'welcomePatient' = 'welcomePatient',
): void {
  try {
    const entry: DeviceCalibration = {
      ...model,
      deviceKey: deviceKey(),
      screenW:   window.innerWidth,
      screenH:   window.innerHeight,
      savedAt:   new Date().toISOString(),
      source,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entry));
    console.log(
      `%c[Calibración] Guardada en dispositivo ✓`,
      'color:#7DD3A8;font-weight:800',
      `| clave=${entry.deviceKey}`,
      `| βX=${model.betaX.toFixed(1)} βY=${model.betaY.toFixed(1)}`,
      `| sX=${model.sensitivityX.toFixed(4)} sY=${model.sensitivityY.toFixed(4)}`,
    );
  } catch {
    // Modo privado o cuota de almacenamiento agotada — ignorar
  }
}

export function loadDeviceCalibration(): DeviceCalibration | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const entry = JSON.parse(raw) as DeviceCalibration;
    if (entry.deviceKey !== deviceKey()) {
      console.log(
        `[Calibración] Dispositivo diferente — calibración ignorada`,
        `| guardada=${entry.deviceKey}  actual=${deviceKey()}`,
      );
      return null;
    }
    console.log(
      `%c[Calibración] Cargada desde dispositivo ✓`,
      'color:#7DD3A8;font-weight:800',
      `| guardada=${entry.savedAt}`,
      `| βX=${entry.betaX.toFixed(1)} βY=${entry.betaY.toFixed(1)}`,
    );
    return entry;
  } catch {
    return null;
  }
}

export function clearDeviceCalibration(): void {
  try { localStorage.removeItem(STORAGE_KEY); } catch { /* noop */ }
}

// Devuelve true SOLO si la calibración de 9 puntos se completó en este
// dispositivo. Datos legacy (sin campo source) o guardados por WelcomePatient
// devuelven false → CalibrationScreen debe mostrarse igualmente.
export function hasRealCalibration(): boolean {
  return loadDeviceCalibration()?.source === 'calibrationScreen';
}

// Adapta la calibración guardada a la pantalla actual.
// Si las dimensiones del viewport coinciden, aplica el modelo tal cual.
// Si difieren (p. ej. cambio de orientación), recalcula los betas a partir
// de sensitivityX/Y que son independientes del tamaño de pantalla.
export function adaptCalibrationToScreen(saved: DeviceCalibration): CalibrationModel {
  const W = window.innerWidth;
  const H = window.innerHeight;

  if (W === saved.screenW && H === saved.screenH) {
    return {
      alphaX:       saved.alphaX,
      betaX:        saved.betaX,
      alphaY:       saved.alphaY,
      betaY:        saved.betaY,
      sensitivityX: saved.sensitivityX,
      sensitivityY: saved.sensitivityY,
    };
  }

  // Reconstruir betas desde la sensibilidad (independiente del viewport)
  return {
    alphaX:       W / 2,
    betaX:        saved.sensitivityX * W,
    alphaY:       H / 2,
    betaY:        -saved.sensitivityY * H,
    sensitivityX: saved.sensitivityX,
    sensitivityY: saved.sensitivityY,
  };
}
