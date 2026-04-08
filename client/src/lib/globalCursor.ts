// ──────────────────────────────────────────────────────────────────────────────
// Global Cursor Maestro — única fuente de verdad del cursor en pantalla
//
// ARQUITECTURA:
//   • Se importa sincrónicamente antes de React (ver main.tsx).
//   • Crea #gaze-cursor una sola vez y lo gestiona para siempre.
//   • Responde a TRES fuentes: ratón, toque y mirada (eye-tracking).
//   • Touch y gaze COEXISTEN: touch bloquea gaze 500 ms, luego el ojo retoma.
//   • El cursor arranca OCULTO (opacity:0) → setCursorVisible(true) en App.tsx.
//
// API EXPORTADA:
//   moveGlobalCursor(x,y)     – mueve el cursor (gaze + mouse; touch lo llama internamente)
//   flashGlobalCursor()       – flash de activación (blink / touch)
//   setCursorBlinkSuccess()   – feedback verde 600 ms para blink válido
//   setGazePriority(bool)     – mouse cede a gaze cuando true
//   setCursorVisible(bool)    – muestra/oculta el cursor
//   isTouchLocked()           – true durante los 500 ms post-toque (para que gaze ceda)
// ──────────────────────────────────────────────────────────────────────────────

const CURSOR_SIZE    = 32;   // px — diámetro del círculo
const HALF           = CURSOR_SIZE / 2;
const TOUCH_LOCK_MS  = 500;  // ms — cuánto tiempo el gaze cede al toque

// ── Crear (o reutilizar) el elemento ──────────────────────────────────────────
function applyBaseStyles(el: HTMLDivElement) {
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
  const cx = typeof window !== 'undefined' ? window.innerWidth  / 2 : 0;
  const cy = typeof window !== 'undefined' ? window.innerHeight / 2 : 0;
  el.style.transform = `translate(${cx - HALF}px, ${cy - HALF}px)`;
}

function createCursorElement(): HTMLDivElement {
  const existing = document.getElementById('gaze-cursor') as HTMLDivElement | null;
  if (existing) { applyBaseStyles(existing); return existing; }
  const el = document.createElement('div');
  el.id = 'gaze-cursor';
  applyBaseStyles(el);
  (document.body ?? document.documentElement).appendChild(el);
  return el;
}

let _cursor: HTMLDivElement;
if (document.body) {
  _cursor = createCursorElement();
} else {
  _cursor = document.createElement('div');
  _cursor.id = 'gaze-cursor';
  document.addEventListener('DOMContentLoaded', () => {
    applyBaseStyles(_cursor);
    document.body.appendChild(_cursor);
  }, { once: true });
}

export const globalCursor = _cursor;

// ── Estado interno ─────────────────────────────────────────────────────────────
let _gazePriority    = false;   // true cuando el eye-tracking está activo
let _touchLockUntil  = 0;       // timestamp hasta el que el gaze debe ceder al toque

// ── API pública ───────────────────────────────────────────────────────────────

/** Mueve el cursor a (x, y). Llamada desde gaze, mouse y touch. */
export function moveGlobalCursor(x: number, y: number) {
  globalCursor.style.transform = `translate(${x - HALF}px, ${y - HALF}px)`;
}

/** Flash de activación visual (blink o toque). */
export function flashGlobalCursor() {
  globalCursor.classList.add('gaze-blink-flash');
  setTimeout(() => globalCursor.classList.remove('gaze-blink-flash'), 350);
}

/** Feedback verde 600 ms — confirma al paciente que su parpadeo fue un clic válido. */
export function setCursorBlinkSuccess() {
  const el = globalCursor;
  el.style.setProperty('background',   'rgba(34, 197, 94, 0.95)',  'important');
  el.style.setProperty('border-color', '#15803d',                   'important');
  el.style.setProperty('box-shadow',
    '0 0 0 3px rgba(255,255,255,0.85), 0 0 28px rgba(34,197,94,0.9)', 'important');
  setTimeout(() => {
    el.style.setProperty('background',   'rgba(255, 255, 255, 0.95)', 'important');
    el.style.setProperty('border-color', 'rgba(15, 118, 110, 1)',      'important');
    el.style.setProperty('box-shadow',
      '0 0 0 2px rgba(255,255,255,0.6), 0 0 18px rgba(20,184,166,0.7)', 'important');
  }, 600);
}

/** Activa/desactiva la prioridad del eye-tracking sobre el ratón. */
export function setGazePriority(active: boolean) {
  _gazePriority = active;
}

/** Muestra u oculta el cursor (opacity). Oculto durante la Splash Screen. */
export function setCursorVisible(visible: boolean) {
  globalCursor.style.setProperty('opacity', visible ? '1' : '0', 'important');
}

/**
 * Devuelve true si un toque reciente está bloqueando el gaze.
 * El gaze debe ceder (no mover el cursor ni acumular dwell) mientras sea true.
 * Se activa 500 ms con cada touchstart.
 */
export function isTouchLocked(): boolean {
  return performance.now() < _touchLockUntil;
}

// ── Callback de auto-ajuste por toque ────────────────────────────────────────
// Cuando el paciente toca un botón de mirada, se notifica al tracker para que
// pueda reajustar suavemente el modelo en segundo plano (ver nudgeAlphaFromTouch).
let _onGazeTargetTouch: ((cx: number, cy: number) => void) | null = null;

/**
 * Registra una función que se llama cuando el dedo toca un elemento
 * con atributo [data-gaze-target="true"] o clase .gaze-target.
 * Pasar null para desregistrar.
 */
export function setGazeTargetTouchCallback(
  fn: ((cx: number, cy: number) => void) | null,
) {
  _onGazeTargetTouch = fn;
}

// ── Listeners permanentes (nunca se eliminan) ─────────────────────────────────

// RATÓN: solo cuando el gaze NO tiene prioridad
window.addEventListener('mousemove', (e: MouseEvent) => {
  if (_gazePriority) return;
  moveGlobalCursor(e.clientX, e.clientY);
}, { passive: true });

// TOQUE: siempre activo, PASSIVE (no bloquea eventos nativos de click en botones).
// 1. Mueve el cursor al dedo.
// 2. Congela el gaze 500 ms para que el cursor no salte.
// 3. Pulsa visual del cursor para feedback inmediato.
// 4. Notifica al tracker si el toque cae sobre un botón de mirada (auto-ajuste).
window.addEventListener('touchstart', (e: TouchEvent) => {
  const t = e.touches[0];
  if (!t) return;
  moveGlobalCursor(t.clientX, t.clientY);
  _touchLockUntil = performance.now() + TOUCH_LOCK_MS;
  flashGlobalCursor();

  // Auto-ajuste: si hay un botón de mirada bajo el dedo, notificar al tracker
  if (_onGazeTargetTouch) {
    const el = document.elementFromPoint(t.clientX, t.clientY) as HTMLElement | null;
    const gazeEl = el?.closest<HTMLElement>('[data-gaze-target="true"]')
                ?? el?.closest<HTMLElement>('.gaze-target');
    if (gazeEl) {
      const r = gazeEl.getBoundingClientRect();
      _onGazeTargetTouch(r.left + r.width / 2, r.top + r.height / 2);
    }
  }
}, { passive: true });

// TOUCHMOVE: actualiza posición durante arrastre
window.addEventListener('touchmove', (e: TouchEvent) => {
  const t = e.touches[0];
  if (t) moveGlobalCursor(t.clientX, t.clientY);
}, { passive: true });
