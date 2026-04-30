// ─────────────────────────────────────────────────────────────────────────────
// Cursor de apoyo táctil — COMPLEMENTO opcional al cursor de mirada.
//
// Propósito:
//   Cuando el eye-tracking está activo, el cursor principal (#gaze-cursor)
//   sigue la mirada del paciente. Si alguien (paciente con motricidad
//   limitada o cuidador) toca la pantalla como apoyo, este módulo dibuja
//   un SEGUNDO cursor visualmente distinto en el punto del toque para que
//   se distinga claramente del cursor de mirada.
//
// Cuando NO se muestra:
//   • Si el eye-tracking no está activo (no existe <video id="gaze-video">
//     reproduciéndose), el cursor de apoyo NO aparece — el cursor único
//     del sistema ya cubre ese caso.
//   • Si la pestaña está oculta.
//
// Diseño sin invasión:
//   • No modifica globalCursor.ts ni use-webgazer.ts ni componentes .tsx.
//   • Crea un único elemento #touch-support-cursor en el DOM.
//   • Listeners pasivos a touchstart/touchmove/touchend en window.
//   • Z-index 99997 (debajo del #gaze-cursor que está en 99999, para que
//     el cursor de mirada siempre quede por encima).
//
// API (window.touchSupportCursor):
//   setEnabled(true|false)   — desactiva el cursor sin desinstalarlo.
//   setRequireGaze(bool)     — si false, aparece SIEMPRE al tocar (default true).
//   isVisible()              — true si está pintado en este momento.
//   status()                 — diagnóstico para consola.
// ─────────────────────────────────────────────────────────────────────────────

const CURSOR_SIZE  = 22;                          // px — más pequeño que #gaze-cursor (32)
const HALF         = CURSOR_SIZE / 2;
const FADE_OUT_MS  = 1200;                        // ms tras touchend antes de desaparecer
const Z_INDEX      = 99997;                       // por debajo de #gaze-cursor (99999) y del overlay del corrector (99998)

class TouchSupportCursor {
  private el: HTMLDivElement | null = null;
  private fadeTimer: number | null  = null;
  private enabled       = true;
  private requireGaze   = true;
  private lastTouchAt   = 0;
  private installed     = false;

  // ──────────────── Creación perezosa del elemento ────────────────
  private ensureElement(): HTMLDivElement | null {
    if (this.el) return this.el;
    if (typeof document === "undefined" || !document.body) return null;

    const existing = document.getElementById("touch-support-cursor") as HTMLDivElement | null;
    const el = existing ?? document.createElement("div");
    el.id = "touch-support-cursor";
    el.style.cssText = `
      position: fixed !important;
      top: 0 !important;
      left: 0 !important;
      width: ${CURSOR_SIZE}px !important;
      height: ${CURSOR_SIZE}px !important;
      border-radius: 50% !important;
      background: rgba(251, 146, 60, 0.85) !important;
      border: 2px solid rgba(255, 255, 255, 0.95) !important;
      box-shadow:
        0 0 0 2px rgba(194, 65, 12, 0.55),
        0 0 14px rgba(251, 146, 60, 0.55) !important;
      pointer-events: none !important;
      z-index: ${Z_INDEX} !important;
      opacity: 0 !important;
      display: block !important;
      will-change: transform, opacity !important;
      transition: opacity 0.18s ease-out !important;
      transform: translate(-9999px, -9999px) !important;
    `;
    if (!existing) document.body.appendChild(el);
    this.el = el;
    return el;
  }

  // ──────────────── Detección de eye-tracking activo ────────────────
  private isGazeActive(): boolean {
    const video = document.getElementById("gaze-video") as HTMLVideoElement | null;
    if (!video) return false;
    // El tracker está reproduciendo frames de verdad, no solo tiene el elemento.
    return !video.paused && video.readyState >= 2;
  }

  // ──────────────── Renderizado ────────────────
  private show(x: number, y: number): void {
    const el = this.ensureElement();
    if (!el) return;
    if (this.fadeTimer !== null) {
      clearTimeout(this.fadeTimer);
      this.fadeTimer = null;
    }
    el.style.transform = `translate(${x - HALF}px, ${y - HALF}px)`;
    el.style.setProperty("opacity", "1", "important");
  }

  private scheduleHide(): void {
    if (this.fadeTimer !== null) clearTimeout(this.fadeTimer);
    this.fadeTimer = window.setTimeout(() => {
      if (this.el) this.el.style.setProperty("opacity", "0", "important");
      this.fadeTimer = null;
    }, FADE_OUT_MS);
  }

  // ──────────────── Listeners ────────────────
  install(): void {
    if (typeof window === "undefined") return;
    if (this.installed) return;
    this.installed = true;

    window.addEventListener("touchstart", (e) => {
      if (!this.enabled) return;
      if (this.requireGaze && !this.isGazeActive()) return;
      const t = e.touches[0];
      if (!t) return;
      this.lastTouchAt = performance.now();
      this.show(t.clientX, t.clientY);
    }, { passive: true });

    window.addEventListener("touchmove", (e) => {
      if (!this.enabled) return;
      if (this.requireGaze && !this.isGazeActive()) return;
      const t = e.touches[0];
      if (!t) return;
      this.show(t.clientX, t.clientY);
    }, { passive: true });

    window.addEventListener("touchend", () => {
      if (!this.enabled) return;
      this.scheduleHide();
    }, { passive: true });

    window.addEventListener("touchcancel", () => {
      this.scheduleHide();
    }, { passive: true });

    // Si la pestaña se oculta, esconde inmediatamente (la próxima vez
    // que el usuario vuelva, se mostrará de nuevo al tocar).
    document.addEventListener("visibilitychange", () => {
      if (document.hidden && this.el) {
        this.el.style.setProperty("opacity", "0", "important");
      }
    });
  }

  // ──────────────── API pública ────────────────
  setEnabled(on: boolean): void {
    this.enabled = on;
    if (!on && this.el) this.el.style.setProperty("opacity", "0", "important");
  }

  setRequireGaze(req: boolean): void {
    this.requireGaze = req;
  }

  isVisible(): boolean {
    return this.el ? this.el.style.opacity === "1" : false;
  }

  status() {
    return {
      enabled:        this.enabled,
      requireGaze:    this.requireGaze,
      gazeActiveNow:  this.isGazeActive(),
      visibleNow:     this.isVisible(),
      lastTouchAt:    this.lastTouchAt,
      hasElement:     !!this.el,
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Singleton resistente a HMR.
//   La instancia se almacena en window. En cada re-evaluación del módulo
//   (HMR de Vite) se REUTILIZA la instancia anterior — que ya tiene sus
//   listeners atados — en lugar de crear una nueva huérfana. install() es
//   internamente idempotente (flag this.installed), por lo que llamarlo
//   varias veces es seguro.
// ─────────────────────────────────────────────────────────────────────────────
type WindowWithCursor = Window & {
  __touchSupportCursorInstance?: TouchSupportCursor;
  touchSupportCursor?: TouchSupportCursor;
};

export const touchSupportCursor: TouchSupportCursor = (() => {
  if (typeof window === "undefined") return new TouchSupportCursor();
  const w = window as WindowWithCursor;
  if (w.__touchSupportCursorInstance) {
    // HMR: misma instancia con sus listeners ya enganchados.
    return w.__touchSupportCursorInstance;
  }
  const instance = new TouchSupportCursor();
  w.__touchSupportCursorInstance = instance;
  w.touchSupportCursor = instance;
  instance.install();
  return instance;
})();

// Re-asegura la referencia global (por si una HMR previa la borró).
if (typeof window !== "undefined") {
  (window as WindowWithCursor).touchSupportCursor = touchSupportCursor;
}
