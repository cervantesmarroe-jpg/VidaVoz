import { create } from 'zustand';

// ─── Modo de acceso — VidaVoz ──────────────────────────────────────────────────
//
// Control EXCLUSIVO del cuidador (selector en FullscreenLayout.tsx, excluido
// de data-gaze-target y marcado data-scan-panel="true" — el paciente no puede
// alcanzarlo ni por mirada ni por escaneo GUIADO). El modo elegido gobierna
// GLOBALMENTE la mirada, el parpadeo y el escaneo GUIADO en las cuatro
// pantallas de la app (sustituye al antiguo forzado de GUIADO específico de
// Teclado). Se recuerda durante toda la sesión vía sessionStorage — mismo
// convenio que WELCOME_KEY/AUTOSTART_KEY en FullscreenLayout.tsx — y se
// resetea al cerrar la pestaña.
export type AccessMode = 'mirada' | 'pulsador' | 'parpadeo' | 'combinado';

export const ACCESS_MODES: { id: AccessMode; label: string; description: string }[] = [
  {
    id: 'mirada',
    label: 'Solo mirada',
    description: 'Cursor de mirada con activación por dwell. Sin parpadeo ni escaneo.',
  },
  {
    id: 'pulsador',
    label: 'Solo pulsador',
    description: 'Escaneo secuencial (GUIADO). El paciente confirma tocando la pantalla o con un pulsador externo. Cámara apagada.',
  },
  {
    id: 'parpadeo',
    label: 'Solo parpadeo',
    description: 'Sin cursor visible. Un parpadeo intencional (>300 ms) activa el botón que estaría bajo la mirada.',
  },
  {
    id: 'combinado',
    label: 'Combinado',
    description: 'Mirada, parpadeo y GUIADO activos a la vez — el paciente usa el método que mejor le funcione en cada momento.',
  },
];

export interface AccessModeFlags {
  /** Cursor de mirada visible + activación por dwell (mirar y mantener). */
  cursorEnabled: boolean;
  /** Parpadeo intencional (>300 ms, ver INTENTIONAL_BLINK_MAX_MS) activa el botón bajo la mirada. */
  blinkEnabled: boolean;
  /** Escaneo secuencial (GUIADO) activo. */
  guiadoEnabled: boolean;
  /** La cámara / detección de mirada debe estar corriendo (aunque el cursor no se muestre). */
  eyeTrackingNeeded: boolean;
}

export function deriveAccessFlags(mode: AccessMode): AccessModeFlags {
  switch (mode) {
    case 'mirada':
      return { cursorEnabled: true, blinkEnabled: false, guiadoEnabled: false, eyeTrackingNeeded: true };
    case 'pulsador':
      return { cursorEnabled: false, blinkEnabled: false, guiadoEnabled: true, eyeTrackingNeeded: false };
    case 'parpadeo':
      return { cursorEnabled: false, blinkEnabled: true, guiadoEnabled: false, eyeTrackingNeeded: true };
    case 'combinado':
      return { cursorEnabled: true, blinkEnabled: true, guiadoEnabled: true, eyeTrackingNeeded: true };
  }
}

const STORAGE_KEY = 'vozuci-access-mode-v1';
const DEFAULT_MODE: AccessMode = 'combinado';

function isAccessMode(v: string | null): v is AccessMode {
  return v === 'mirada' || v === 'pulsador' || v === 'parpadeo' || v === 'combinado';
}

function readStoredMode(): AccessMode {
  try {
    const v = sessionStorage.getItem(STORAGE_KEY);
    if (isAccessMode(v)) return v;
  } catch { /* sessionStorage no disponible */ }
  return DEFAULT_MODE;
}

interface AccessModeState {
  mode: AccessMode;
  setMode: (mode: AccessMode) => void;
}

export const useAccessModeStore = create<AccessModeState>((set) => ({
  mode: readStoredMode(),
  setMode: (mode) => {
    try { sessionStorage.setItem(STORAGE_KEY, mode); } catch { /* noop */ }
    set({ mode });
  },
}));

// Lectura no reactiva, para código fuera de React (use-webgazer.ts: la
// clasificación de parpadeo corre dentro del loop RAF de GazeTracker, no en
// un componente).
export function getAccessFlags(): AccessModeFlags {
  return deriveAccessFlags(useAccessModeStore.getState().mode);
}
