// ─────────────────────────────────────────────────────────────────────────────
// Capa de corrección por movimiento de cabeza — COMPLEMENTO opcional.
//
// Este módulo NO sustituye al tracker principal (use-webgazer.ts). Solo
// detecta cuánto se ha desplazado la cabeza del paciente respecto a una
// posición de referencia y expone una función pura que ajusta cualquier
// coordenada (x, y) generada por la app.
//
// Diseño sin invasión:
//   • No modifica use-webgazer.ts ni ningún componente .tsx.
//   • Reutiliza el elemento <video id="gaze-video"> que ya crea el tracker
//     principal — no abre una segunda cámara.
//   • Se controla manualmente desde consola o desde el código del usuario:
//
//        import "@/lib/headOffsetCorrector";   // 1 línea para cargarlo
//        await window.headOffsetCorrector.start();
//        window.headOffsetCorrector.calibrateBaseline();
//        window.headOffsetCorrector.setStrength(0.6);
//        window.headOffsetCorrector.setDebugOverlayVisible(true);
//
//        const { x, y } = applyHeadOffsetCorrection(rawX, rawY);
//
// La ventana de depuración es un canvas pequeño anclado en la esquina
// inferior derecha (160×120 px, z-index 99998 — debajo del cursor 99999),
// que NUNCA tapa los botones de mirada y se puede ocultar en caliente.
// ─────────────────────────────────────────────────────────────────────────────

import {
  FaceLandmarker,
  FilesetResolver,
  type NormalizedLandmark,
} from "@mediapipe/tasks-vision";

const WASM_PATH = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.32/wasm";
const MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task";

// Índice del landmark "punta de la nariz" en el modelo MediaPipe FaceLandmarker.
// Es el punto más estable para medir el desplazamiento de la cabeza.
const NOSE_TIP = 1;

// Factor empírico: una cabeza que se mueve un 1% del ancho del video equivale
// aproximadamente a SCALE×1% de desplazamiento aparente del punto de mirada
// en pantalla. Se modula además por `strength` (0..1) para que el cuidador
// pueda calibrar la agresividad.
const HEAD_TO_SCREEN_SCALE = 2.5;

// Suavizado exponencial del offset para que las correcciones se vean fluidas
// y no temblorosas frame a frame.
const SMOOTHING_ALPHA = 0.25;

class HeadOffsetCorrector {
  private landmarker: FaceLandmarker | null = null;
  private video:      HTMLVideoElement   | null = null;

  private rafId         = 0;
  private lastVideoTime = -1;
  private running       = false;
  private initializing  = false;

  // Posición normalizada (0..1) de la nariz en el frame de cámara.
  private baseline: { x: number; y: number } | null = null;
  private current:  { x: number; y: number } | null = null;

  // Offset suavizado en píxeles de pantalla, listo para aplicarse.
  private smoothDx = 0;
  private smoothDy = 0;

  private strength     = 0.5;
  private debugVisible = false;
  private debugCanvas: HTMLCanvasElement | null = null;

  // ────────────────────────── Ciclo de vida ──────────────────────────
  /**
   * Carga el modelo MediaPipe (1 sola vez), localiza el video del tracker
   * principal y arranca el bucle de detección. Idempotente.
   */
  async start(): Promise<void> {
    if (this.running || this.initializing) return;
    this.initializing = true;

    try {
      if (!this.landmarker) {
        const resolver = await FilesetResolver.forVisionTasks(WASM_PATH);
        // Intenta GPU primero. Si no hay WebGL disponible (Chromebooks muy
        // antiguos, navegadores headless, modo software-only), recae en CPU
        // de forma silenciosa para no romper la app del paciente.
        try {
          this.landmarker = await FaceLandmarker.createFromOptions(resolver, {
            baseOptions: { modelAssetPath: MODEL_URL, delegate: "GPU" },
            runningMode: "VIDEO",
            numFaces:    1,
          });
        } catch (gpuErr) {
          console.warn("[HeadOffsetCorrector] GPU no disponible, usando CPU:", (gpuErr as Error).message);
          this.landmarker = await FaceLandmarker.createFromOptions(resolver, {
            baseOptions: { modelAssetPath: MODEL_URL, delegate: "CPU" },
            runningMode: "VIDEO",
            numFaces:    1,
          });
        }
      }

      // Reutiliza el video del tracker principal — no abre otra cámara.
      this.video = document.getElementById("gaze-video") as HTMLVideoElement | null;
      if (!this.video) {
        console.warn(
          "[HeadOffsetCorrector] No se encontró #gaze-video. " +
          "Activa la mirada antes (gazeTracker.startCamera()).",
        );
        return;
      }

      this.running = true;
      this.tick();
      console.log("[HeadOffsetCorrector] Corrector activo.");
    } finally {
      this.initializing = false;
    }
  }

  /** Detiene el bucle (no libera el modelo — start() lo reactiva al instante). */
  stop(): void {
    this.running = false;
    if (this.rafId) cancelAnimationFrame(this.rafId);
    this.rafId = 0;
  }

  // ────────────────────────── Bucle de detección ──────────────────────────
  private tick = (): void => {
    if (!this.running || !this.video || !this.landmarker) return;

    if (this.video.readyState >= 2 && this.video.currentTime !== this.lastVideoTime) {
      this.lastVideoTime = this.video.currentTime;

      try {
        const result = this.landmarker.detectForVideo(this.video, performance.now());
        const face   = result.faceLandmarks?.[0];
        if (face && face[NOSE_TIP]) {
          // Espejado horizontal: el video del paciente va en modo "selfie",
          // así que invertimos X para que coincida con el sistema de coords
          // del tracker principal.
          this.current = { x: 1 - face[NOSE_TIP].x, y: face[NOSE_TIP].y };

          // Actualiza el offset suavizado.
          const target = this.computeRawOffsetPx();
          this.smoothDx = this.smoothDx + SMOOTHING_ALPHA * (target.dx - this.smoothDx);
          this.smoothDy = this.smoothDy + SMOOTHING_ALPHA * (target.dy - this.smoothDy);

          if (this.debugVisible) this.drawDebug(face);
        }
      } catch (err) {
        // detectForVideo puede fallar si el modelo aún no está listo; ignoramos.
        if ((err as Error).message?.includes("ROI")) return;
      }
    }

    this.rafId = requestAnimationFrame(this.tick);
  };

  // ────────────────────────── API pública ──────────────────────────
  /**
   * Marca la pose actual de la cabeza como "centro" — el offset será cero
   * en este instante y crecerá según el paciente se desvíe. Llamar cuando
   * el paciente esté mirando al frente con la cabeza neutra.
   */
  calibrateBaseline(): void {
    if (!this.current) {
      console.warn("[HeadOffsetCorrector] Sin detección de cara todavía.");
      return;
    }
    this.baseline = { ...this.current };
    this.smoothDx = 0;
    this.smoothDy = 0;
    console.log("[HeadOffsetCorrector] Baseline:", this.baseline);
  }

  /** Borra la baseline → la corrección queda inactiva (devuelve 0,0). */
  resetBaseline(): void {
    this.baseline = null;
    this.smoothDx = 0;
    this.smoothDy = 0;
  }

  /**
   * Devuelve el offset (en píxeles) que habría que SUMAR a las coordenadas
   * de mirada para compensar el movimiento de cabeza. Si no hay baseline o
   * el corrector no está activo, devuelve {0, 0}.
   */
  getOffsetPx(): { dx: number; dy: number } {
    if (!this.baseline || !this.running) return { dx: 0, dy: 0 };
    return { dx: this.smoothDx, dy: this.smoothDy };
  }

  /**
   * Función pura — toma (x, y) tal cual los genera la app y devuelve la
   * versión corregida con el offset de cabeza aplicado.
   */
  apply(x: number, y: number): { x: number; y: number } {
    const { dx, dy } = this.getOffsetPx();
    return { x: x + dx, y: y + dy };
  }

  /** 0 = sin corrección, 1 = corrección completa. Default 0.5. */
  setStrength(s: number): void {
    this.strength = Math.max(0, Math.min(1, s));
  }

  /** Muestra (true) u oculta (false) la ventanita de depuración. */
  setDebugOverlayVisible(visible: boolean): void {
    this.debugVisible = visible;
    if (visible) this.ensureDebugCanvas();
    else         this.removeDebugCanvas();
  }

  /** Estado actual para inspección (consola/debug). */
  status() {
    return {
      running:        this.running,
      hasBaseline:    !!this.baseline,
      strength:       this.strength,
      offsetPx:       this.getOffsetPx(),
      debugVisible:   this.debugVisible,
      videoConnected: !!this.video,
    };
  }

  // ────────────────────────── Internos ──────────────────────────
  private computeRawOffsetPx(): { dx: number; dy: number } {
    if (!this.baseline || !this.current) return { dx: 0, dy: 0 };
    const rawDx = this.current.x - this.baseline.x;
    const rawDy = this.current.y - this.baseline.y;
    // Cabeza a la derecha (rawDx > 0) → mirada parece desviada a la derecha →
    // restamos para devolver el cursor a su intención original.
    const dx = -rawDx * window.innerWidth  * HEAD_TO_SCREEN_SCALE * this.strength;
    const dy = -rawDy * window.innerHeight * HEAD_TO_SCREEN_SCALE * this.strength;
    return { dx, dy };
  }

  // ────────────────────────── Visualización de depuración ──────────────────────────
  private ensureDebugCanvas(): void {
    if (this.debugCanvas) return;
    const c = document.createElement("canvas");
    c.id = "head-offset-debug";
    c.width  = 160;
    c.height = 120;
    c.style.cssText = `
      position: fixed !important;
      bottom: 12px !important;
      right: 12px !important;
      width: 160px !important;
      height: 120px !important;
      border: 2px solid rgba(20,184,166,0.85) !important;
      border-radius: 10px !important;
      background: rgba(0,0,0,0.55) !important;
      pointer-events: none !important;
      z-index: 99998 !important;
      box-shadow: 0 4px 18px rgba(0,0,0,0.35) !important;
    `;
    (document.body ?? document.documentElement).appendChild(c);
    this.debugCanvas = c;
  }

  private removeDebugCanvas(): void {
    this.debugCanvas?.remove();
    this.debugCanvas = null;
  }

  private drawDebug(landmarks: NormalizedLandmark[]): void {
    const c = this.debugCanvas;
    if (!c) return;
    const ctx = c.getContext("2d");
    if (!ctx) return;

    const { width: W, height: H } = c;
    ctx.clearRect(0, 0, W, H);

    // Nube de landmarks (espejada).
    ctx.fillStyle = "rgba(125,211,168,0.85)";
    for (const p of landmarks) {
      const px = (1 - p.x) * W;
      const py = p.y * H;
      ctx.fillRect(px - 0.5, py - 0.5, 1.2, 1.2);
    }

    // Punta de la nariz (referencia del cálculo) — ámbar.
    const nose = landmarks[NOSE_TIP];
    if (nose) {
      ctx.fillStyle   = "rgba(251,191,36,0.95)";
      ctx.strokeStyle = "rgba(0,0,0,0.6)";
      ctx.lineWidth   = 1;
      const nx = (1 - nose.x) * W;
      const ny = nose.y * H;
      ctx.beginPath();
      ctx.arc(nx, ny, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }

    // Punto de baseline en blanco si está marcada.
    if (this.baseline) {
      const bx = (1 - this.baseline.x) * W;
      const by = this.baseline.y * H;
      ctx.strokeStyle = "rgba(255,255,255,0.9)";
      ctx.lineWidth   = 1.5;
      ctx.beginPath();
      ctx.arc(bx, by, 6, 0, Math.PI * 2);
      ctx.stroke();
    }

    // HUD numérico abajo a la izquierda.
    const { dx, dy } = this.getOffsetPx();
    ctx.fillStyle = "rgba(255,255,255,0.95)";
    ctx.font      = "10px ui-sans-serif, system-ui, sans-serif";
    ctx.fillText(`dx: ${dx.toFixed(0)} px`, 6, H - 18);
    ctx.fillText(`dy: ${dy.toFixed(0)} px`, 6, H - 6);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
export const headOffsetCorrector = new HeadOffsetCorrector();

/**
 * Atajo funcional para usar en cualquier parte de la app:
 *
 *   import { applyHeadOffsetCorrection } from "@/lib/headOffsetCorrector";
 *   const { x, y } = applyHeadOffsetCorrection(rawGazeX, rawGazeY);
 *
 * Si el corrector no está iniciado o no hay baseline, devuelve (x, y) sin tocar.
 */
export function applyHeadOffsetCorrection(x: number, y: number): { x: number; y: number } {
  return headOffsetCorrector.apply(x, y);
}

// Exposición global para depuración desde la consola del navegador,
// sin necesidad de tocar ningún componente:
//
//   window.headOffsetCorrector.calibrateBaseline()
//   window.headOffsetCorrector.setDebugOverlayVisible(true)
//   window.headOffsetCorrector.status()
//
if (typeof window !== "undefined") {
  (window as unknown as { headOffsetCorrector: HeadOffsetCorrector }).headOffsetCorrector =
    headOffsetCorrector;
}

// ─────────────────────────────────────────────────────────────────────────────
// Bootstrap automático.
//
// Política de arranque:
//   • Observa el DOM esperando a que aparezca <video id="gaze-video"> (creado
//     por el tracker principal cuando el paciente concede permiso de cámara).
//   • Engancha el evento `playing` del video → llama a start() solo cuando
//     el stream está reproduciendo frames de verdad. Nunca antes.
//   • Engancha `pause`, `emptied` y `ended` → llama a stop() para liberar la
//     CPU si la cámara se apaga.
//   • Si el elemento <video> desaparece del DOM → stop().
//   • Si la pestaña se oculta (visibilitychange.hidden) → stop().
//     Si vuelve a verse y el video sigue reproduciendo → start().
//
// El overlay de depuración permanece OCULTO por defecto (debugVisible=false).
// Solo se enciende manualmente con setDebugOverlayVisible(true) desde consola.
// ─────────────────────────────────────────────────────────────────────────────
function installAutoBootstrap(): void {
  if (typeof window === "undefined" || typeof document === "undefined") return;
  // Idempotencia frente a Hot Module Reload de Vite en desarrollo: si el
  // módulo se re-evalúa, no queremos duplicar MutationObservers ni listeners.
  const w = window as unknown as { __headOffsetBootstrapInstalled?: boolean };
  if (w.__headOffsetBootstrapInstalled) return;
  w.__headOffsetBootstrapInstalled = true;

  let attachedVideo: HTMLVideoElement | null = null;
  let pageHidden = document.hidden;

  const tryStart = () => {
    if (pageHidden) return;
    if (!attachedVideo || attachedVideo.paused || attachedVideo.readyState < 2) return;
    // Silenciamos cualquier rechazo: si MediaPipe no puede arrancar (sin
    // WebGL, sin red, etc.) la app del paciente debe seguir funcionando
    // SIN overlays de error rojos. El corrector simplemente queda inactivo.
    headOffsetCorrector.start().catch((err) => {
      console.warn("[HeadOffsetCorrector] Auto-start fallido (modo silencioso):", err);
    });
  };

  const tryStop = () => {
    headOffsetCorrector.stop();
  };

  const onPlaying  = () => tryStart();
  const onPause    = () => tryStop();
  const onEmptied  = () => tryStop();
  const onEnded    = () => tryStop();

  const detachVideo = () => {
    if (!attachedVideo) return;
    attachedVideo.removeEventListener("playing", onPlaying);
    attachedVideo.removeEventListener("pause",   onPause);
    attachedVideo.removeEventListener("emptied", onEmptied);
    attachedVideo.removeEventListener("ended",   onEnded);
    attachedVideo = null;
    tryStop();
  };

  const attachVideo = (video: HTMLVideoElement) => {
    if (attachedVideo === video) return;
    detachVideo();
    attachedVideo = video;
    video.addEventListener("playing", onPlaying);
    video.addEventListener("pause",   onPause);
    video.addEventListener("emptied", onEmptied);
    video.addEventListener("ended",   onEnded);
    console.log("[HeadOffsetCorrector] Video del tracker detectado, esperando a 'playing'.");
    // Si ya estaba reproduciendo cuando lo encontramos, dispara el arranque.
    if (!video.paused && video.readyState >= 2) tryStart();
  };

  const sweep = () => {
    const v = document.getElementById("gaze-video") as HTMLVideoElement | null;
    if (v && v !== attachedVideo)        attachVideo(v);
    else if (!v && attachedVideo)        detachVideo();
  };

  const observer = new MutationObserver(sweep);

  const boot = () => {
    observer.observe(document.body, { childList: true, subtree: true });
    sweep();
  };

  if (document.body) boot();
  else document.addEventListener("DOMContentLoaded", boot, { once: true });

  document.addEventListener("visibilitychange", () => {
    pageHidden = document.hidden;
    if (pageHidden) tryStop();
    else            tryStart();
  });
}

installAutoBootstrap();
