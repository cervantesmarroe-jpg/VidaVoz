// ──────────────────────────────────────────────────────────────────────────────
// Global Cursor Maestro
// Este módulo se ejecuta SINCRÓNICAMENTE al importarse, antes de cualquier
// render de React. Crea #gaze-cursor en el DOM de inmediato y lo mantiene
// visible con z-index 99999. Exporta moveGlobalCursor(x, y) como API única.
// ──────────────────────────────────────────────────────────────────────────────

const CURSOR_SIZE = 32; // px — diámetro del círculo
const HALF        = CURSOR_SIZE / 2;

// ── Crear (o reutilizar) el elemento en el DOM ────────────────────────────────
// Se hace fuera de cualquier función para garantizar ejecución síncrona en el
// momento del import, independientemente del ciclo de vida de React.
function createCursorElement(): HTMLDivElement {
  const existing = document.getElementById('gaze-cursor') as HTMLDivElement | null;
  if (existing) {
    applyBaseStyles(existing);
    return existing;
  }
  const el = document.createElement('div');
  el.id = 'gaze-cursor';
  applyBaseStyles(el);
  // Añadir al body si ya existe; si no (muy improbable), al documentElement
  (document.body ?? document.documentElement).appendChild(el);
  return el;
}

function applyBaseStyles(el: HTMLDivElement) {
  // Estilos inline completos — no dependen del CSS externo para máxima robustez.
  // El cursor arranca OCULTO (opacity:0) y solo se muestra tras la Splash Screen
  // mediante setCursorVisible(true) llamado desde App.tsx al salir de la fase splash.
  el.style.cssText = `
    position: fixed !important;
    top: 0 !important;
    left: 0 !important;
    width: ${CURSOR_SIZE}px !important;
    height: ${CURSOR_SIZE}px !important;
    border-radius: 50% !important;
    background: rgba(255, 255, 255, 0.95) !important;
    border: 3px solid rgba(15, 118, 110, 1) !important;
    box-shadow: 0 0 0 2px rgba(255,255,255,0.6), 0 0 18px rgba(20,184,166,0.7) !important;
    pointer-events: none !important;
    z-index: 99999 !important;
    opacity: 0 !important;
    display: block !important;
    will-change: transform !important;
    transition: box-shadow 0.18s, background 0.12s, opacity 0.3s !important;
  `;
  // Posición inicial: centro exacto de la pantalla
  const cx = typeof window !== 'undefined' ? window.innerWidth  / 2 : 0;
  const cy = typeof window !== 'undefined' ? window.innerHeight / 2 : 0;
  el.style.transform = `translate(${cx - HALF}px, ${cy - HALF}px)`;
}

// Inicialización síncrona — si el body aún no está (SSR-edge), esperar DOMContentLoaded
let _cursor: HTMLDivElement;
if (document.body) {
  _cursor = createCursorElement();
} else {
  // Fallback por si el módulo se importa antes de que el DOM esté listo
  _cursor = document.createElement('div');
  _cursor.id = 'gaze-cursor';
  document.addEventListener('DOMContentLoaded', () => {
    applyBaseStyles(_cursor);
    document.body.appendChild(_cursor);
  }, { once: true });
}

export const globalCursor = _cursor;

// ── API pública ───────────────────────────────────────────────────────────────

/** Mueve el cursor al punto (x, y) en coordenadas de viewport.
 *  Llamar desde eventos mousemove, touchmove y desde el pipeline de eye-tracking. */
export function moveGlobalCursor(x: number, y: number) {
  globalCursor.style.transform = `translate(${x - HALF}px, ${y - HALF}px)`;
}

/** Flash visual (blink o touch) — efecto visual de activación */
export function flashGlobalCursor() {
  globalCursor.classList.add('gaze-blink-flash');
  setTimeout(() => globalCursor.classList.remove('gaze-blink-flash'), 350);
}

/** Feedback verde inmediato: el cursor se vuelve verde brillante 600ms para
 *  confirmar al paciente que el parpadeo fue registrado como clic válido.
 *  Usa setProperty('…', '…', 'important') para sobreescribir el !important
 *  establecido en applyBaseStyles vía cssText. */
export function setCursorBlinkSuccess() {
  const el = globalCursor;
  el.style.setProperty('background',  'rgba(34, 197, 94, 0.95)',  'important');
  el.style.setProperty('border-color','#15803d',                   'important');
  el.style.setProperty('box-shadow',
    '0 0 0 3px rgba(255,255,255,0.85), 0 0 28px rgba(34,197,94,0.9)', 'important');
  setTimeout(() => {
    el.style.setProperty('background',  'rgba(255, 255, 255, 0.95)', 'important');
    el.style.setProperty('border-color','rgba(15, 118, 110, 1)',      'important');
    el.style.setProperty('box-shadow',
      '0 0 0 2px rgba(255,255,255,0.6), 0 0 18px rgba(20,184,166,0.7)', 'important');
  }, 600);
}

// ── Listeners siempre activos (ratón + touch) ─────────────────────────────────
// Cuando el eye-tracking está activo, llamará a moveGlobalCursor con mayor
// frecuencia, sobreescribiendo de forma natural la posición del ratón.
// No hay conflicto: la última llamada a moveGlobalCursor siempre gana.
let _gazePriority = false; // true cuando el eye-tracking está activo

window.addEventListener('mousemove', (e: MouseEvent) => {
  if (_gazePriority) return; // el gaze tiene prioridad: ignoramos el ratón
  moveGlobalCursor(e.clientX, e.clientY);
}, { passive: true });

window.addEventListener('touchmove', (e: TouchEvent) => {
  const t = e.touches[0];
  if (t) moveGlobalCursor(t.clientX, t.clientY);
}, { passive: true });

window.addEventListener('touchstart', (e: TouchEvent) => {
  const t = e.touches[0];
  if (t) moveGlobalCursor(t.clientX, t.clientY);
}, { passive: true });

/** Activa/desactiva la prioridad del eye-tracking sobre el ratón */
export function setGazePriority(active: boolean) {
  _gazePriority = active;
}

/** Muestra u oculta el cursor.
 *  Se llama desde App.tsx: false durante la Splash Screen, true al terminarla.
 *  El cursor arranca con opacity:0 por defecto. */
export function setCursorVisible(visible: boolean) {
  globalCursor.style.setProperty('opacity', visible ? '1' : '0', 'important');
}
