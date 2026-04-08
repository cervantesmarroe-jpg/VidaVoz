import { useEffect } from 'react';
import { moveGlobalCursor, flashGlobalCursor, setGazePriority, setCursorBlinkSuccess } from '@/lib/globalCursor';
import { create } from 'zustand';
import { FaceLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';
import { GAZE_PROFILES, DEFAULT_PROFILE_ID, type GazeProfile } from '@/config/gazeProfiles';

// ─── MediaPipe ───────────────────────────────────────────────────────────────
const WASM_PATH = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.32/wasm';
const MODEL_URL = 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task';

const DWELL_MS        = 3000;
const SMOOTH_SAMPLES  = 30;    // tamaño fijo del ring-buffer MA
const SMOOTH_WARMUP   = 15;    // no emite hasta tener al menos estas muestras (sin saltos al arranque)
const BLINK_THRESHOLD = 0.85;
const BLINK_COOLDOWN  = 1200;  // periodo refractario entre blink-clicks (ms)
const BLINK_MIN_MS    = 200;   // parpadeo mínimo válido (ms) — ignora involuntarios
const BLINK_MAX_MS    = 500;   // parpadeo máximo válido (ms) — ignora sueño/mirada perdida

// ── Suavizado agresivo ────────────────────────────────────────────────────────
const SNAP_RADIUS_PX  = 50;    // imán: si el cursor está a <50 px de un botón, salta al centro
const DEAD_ZONE_PX    = 10;    // zona muerta: ignora movimientos < 10 px (anti-temblor)

// ── One-Euro: parámetros clínicos (máximo suavizado en reposo) ────────────────
const OEF_MIN_CUTOFF  = 0.20;  // Hz — más bajo = más inercial/pesado en reposo
const OEF_BETA        = 0.004; // baja sensibilidad a velocidad → más suave en transiciones
const OEF_D_CUTOFF    = 1.0;

// Sensibilidad de fábrica (fallback si no se carga perfil)
const SENSITIVITY_X = GAZE_PROFILES[DEFAULT_PROFILE_ID].sensitivityX;
const SENSITIVITY_Y = GAZE_PROFILES[DEFAULT_PROFILE_ID].sensitivityY;

// Aprendizaje continuo: recomputar modelo tras N clics bien distribuidos
const CONTINUOUS_MIN = 6;
const CONTINUOUS_MAX = 20;   // buffer FIFO

// ─── Tipos ────────────────────────────────────────────────────────────────────
type BlendshapeCategory  = { categoryName: string; score: number };
type NormalizedLandmark  = { x: number; y: number; z: number };

type DetectionCache = {
  categories: BlendshapeCategory[];
  landmarks:  NormalizedLandmark[];
} | null;

type GazeCallback  = (x: number, y: number) => void;
type BlinkCallback = (x: number, y: number) => void;

interface RegressionModel {
  alphaX: number; betaX: number;
  alphaY: number; betaY: number;
}

interface TrainingPoint {
  eyeX: number; eyeY: number;
  screenX: number; screenY: number;
}

// ─── calculateRegression ─────────────────────────────────────────────────────
function calculateRegression(data: TrainingPoint[]): RegressionModel {
  const n = data.length;
  let sumX = 0, sumSX = 0, sumXX = 0, sumXSX = 0;
  let sumY = 0, sumSY = 0, sumYY = 0, sumYSY = 0;

  data.forEach(d => {
    sumX  += d.eyeX;   sumSX  += d.screenX;
    sumXX += d.eyeX * d.eyeX;   sumXSX += d.eyeX * d.screenX;
    sumY  += d.eyeY;   sumSY  += d.screenY;
    sumYY += d.eyeY * d.eyeY;   sumYSY += d.eyeY * d.screenY;
  });

  const denX = (n * sumXX - sumX * sumX) || 0.001;
  const betaX  = (n * sumXSX - sumX * sumSX) / denX;
  const alphaX = (sumSX - betaX * sumX) / n;

  const denY = (n * sumYY - sumY * sumY) || 0.001;
  const betaY  = (n * sumYSY - sumY * sumSY) / denY;
  const alphaY = (sumSY - betaY * sumY) / n;

  return { alphaX, betaX, alphaY, betaY };
}

// ─── estimateGazeNoCalibration ────────────────────────────────────────────────
function estimateGazeNoCalibration(
  eyeLookOutL: number, eyeLookInL:   number,
  eyeLookUpL:  number, eyeLookDownL: number,
  headRotX:    number,
  sensX:       number,
  sensY:       number,
): { rawX: number; rawY: number } {
  const horizontalGaze = (eyeLookOutL - eyeLookInL) + (headRotX * 2);
  const verticalGaze   = (eyeLookUpL  - eyeLookDownL);
  return {
    rawX: (window.innerWidth  / 2) + (horizontalGaze * window.innerWidth  * sensX),
    rawY: (window.innerHeight / 2) - (verticalGaze   * window.innerHeight * sensY),
  };
}

function updateGazePoint(
  eyeLookOutL: number, eyeLookInL:   number,
  eyeLookUpL:  number, eyeLookDownL: number,
  headRotX:    number,
  model:       RegressionModel | null,
  sensX:       number,
  sensY:       number,
): { rawX: number; rawY: number } {
  if (model) {
    const eyeX = (eyeLookOutL - eyeLookInL) + (headRotX * 2);
    const eyeY = (eyeLookUpL  - eyeLookDownL);
    return {
      rawX: model.alphaX + model.betaX * eyeX,
      rawY: model.alphaY + model.betaY * eyeY,
    };
  }
  return estimateGazeNoCalibration(eyeLookOutL, eyeLookInL, eyeLookUpL, eyeLookDownL, headRotX, sensX, sensY);
}

// ─── One-Euro Filter (Casiez et al., 2012) ───────────────────────────────────
// Filtro adaptativo: suaviza fuerte cuando el movimiento es lento (mirada fija)
// y deja pasar rápido cuando el movimiento es intencionado (salto de botón).
// minCutoff bajo → más suavizado en reposo; beta alto → más responsivo al movimiento.
class OneEuroFilter {
  private xPrev: number | null = null;
  private dxPrev = 0;
  private tPrev:  number | null = null;

  constructor(
    private readonly minCutoff = 0.35,   // Hz — más bajo = más suave en reposo
    private readonly beta      = 0.006,  // velocidad de adaptación al movimiento
    private readonly dCutoff   = 1.0,
  ) {}

  private alpha(cutoff: number, dt: number) {
    const tau = 1 / (2 * Math.PI * cutoff);
    return 1 / (1 + tau / dt);
  }

  filter(x: number, tSec: number): number {
    if (this.xPrev === null || this.tPrev === null) {
      this.xPrev = x; this.tPrev = tSec; return x;
    }
    const dt    = Math.max(tSec - this.tPrev, 0.001);
    const dxRaw = (x - this.xPrev) / dt;
    const aD    = this.alpha(this.dCutoff, dt);
    const dxHat = aD * dxRaw + (1 - aD) * this.dxPrev;
    const cut   = this.minCutoff + this.beta * Math.abs(dxHat);
    const a     = this.alpha(cut, dt);
    const xHat  = a * x + (1 - a) * this.xPrev;
    this.xPrev  = xHat; this.dxPrev = dxHat; this.tPrev = tSec;
    return xHat;
  }

  reset() { this.xPrev = null; this.dxPrev = 0; this.tPrev = null; }
}

// ─── Snap-to-button ───────────────────────────────────────────────────────────
// Si el cursor filtrado está a menos de `radius` px del centro de algún elemento
// con clase .gaze-target, lo atrae exactamente a ese centro.
function snapToGazeTarget(x: number, y: number, radius: number): { x: number; y: number } {
  const targets = document.querySelectorAll<Element>('.gaze-target');
  let bestDist = radius;
  let bx = x, by = y;
  targets.forEach(el => {
    const r  = el.getBoundingClientRect();
    const cx = r.left + r.width  / 2;
    const cy = r.top  + r.height / 2;
    const d  = Math.hypot(x - cx, y - cy);
    if (d < bestDist) { bestDist = d; bx = cx; by = cy; }
  });
  return { x: bx, y: by };
}

// ─── hasGazeTarget ────────────────────────────────────────────────────────────
// Devuelve true si hay algún elemento .gaze-target dentro de `radius` px del punto.
// Usado para validar si un parpadeo apunta a un botón real (Confianza).
function hasGazeTarget(x: number, y: number, radius: number): boolean {
  return Array.from(document.querySelectorAll<Element>('.gaze-target')).some(el => {
    const r  = el.getBoundingClientRect();
    const cx = r.left + r.width  / 2;
    const cy = r.top  + r.height / 2;
    return Math.hypot(x - cx, y - cy) <= radius;
  });
}

// ─── Pop sound (Web Audio API — sin ficheros externos) ───────────────────────
function playPopSound() {
  try {
    const ctx  = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    const osc  = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.setValueAtTime(200, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(80, ctx.currentTime + 0.09);
    gain.gain.setValueAtTime(0.28, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.14);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.14);
    osc.onended = () => ctx.close();
  } catch (_) {}
}

// ─── GazeTracker (singleton) ─────────────────────────────────────────────────
class GazeTracker {
  private landmarker:    FaceLandmarker | null = null;
  private video:         HTMLVideoElement | null = null;
  private stream:        MediaStream | null = null;
  private rafId:         number = 0;
  private lastVideoTime: number = -1;
  private lastMpTs:      number = 0;

  // ── Perfil Maestro activo (sensibilidades de fábrica para este dispositivo)
  private profileSensX: number = SENSITIVITY_X;
  private profileSensY: number = SENSITIVITY_Y;
  private activeProfile: GazeProfile = GAZE_PROFILES[DEFAULT_PROFILE_ID];

  // ── Pipeline de suavizado de 3 etapas ────────────────────────────────────
  // Ring-buffer fijo de SMOOTH_SAMPLES slots. Empieza pre-relleno con ceros;
  // el puntero writeIdx avanza cíclicamente sin usar shift() (O(1) en lugar de O(n)).
  private smoothBuf: Array<{ x: number; y: number }> = Array.from({ length: SMOOTH_SAMPLES }, () => ({ x: 0, y: 0 }));
  private smoothIdx  = 0;                                         // puntero de escritura
  private smoothFill = 0;                                         // muestras reales escritas (0..30)
  private filterX = new OneEuroFilter(OEF_MIN_CUTOFF, OEF_BETA, OEF_D_CUTOFF);
  private filterY = new OneEuroFilter(OEF_MIN_CUTOFF, OEF_BETA, OEF_D_CUTOFF);
  private lastEmitX = -1;                                         // zona muerta
  private lastEmitY = -1;
  private debugLogAt = 0;                                         // para log periódico del buffer

  private currentResults: DetectionCache = null;

  // calibración rápida (punto central)
  private trainingData:    TrainingPoint[]    = [];
  private isCalibrated     = false;
  private regressionModel: RegressionModel | null = null;

  // aprendizaje continuo (clics de uso real)
  private continuousData: TrainingPoint[] = [];

  // parpadeo — máquina de estados con ventana de duración
  private wasBlinking     = false;
  private blinkStartTime: number | null = null;   // cuándo empezó el cierre
  private lastBlinkEnd    = 0;                    // cuándo acabó el último blink-click
  private blinkEnabled    = true;                 // false durante calibración
  // ── Congelación de cursor durante el parpadeo ─────────────────────────────
  // Al detectar el inicio de un parpadeo, se guardan las coordenadas del cursor.
  // El cursor permanece congelado hasta 100 ms después de que el ojo se reabre,
  // evitando que el ruido visual de los párpados desplace el punto de mira.
  private blinkFrozenX    = -1;
  private blinkFrozenY    = -1;
  private blinkUnfreezeAt = 0;

  private gazeListeners:  Set<GazeCallback>  = new Set();
  private blinkListeners: Set<BlinkCallback> = new Set();

  onCameraReady: (() => void) | null = null;
  onCameraError: (() => void) | null = null;

  async init() {
    try {
      const resolver = await FilesetResolver.forVisionTasks(WASM_PATH);
      this.landmarker = await FaceLandmarker.createFromOptions(resolver, {
        baseOptions:   { modelAssetPath: MODEL_URL, delegate: 'GPU' },
        runningMode:   'VIDEO',
        numFaces:      1,
        outputFaceBlendshapes: true,
        outputFacialTransformationMatrixes: false,
      });
    } catch (err) { console.warn('GazeTracker: init failed', err); }
  }

  async startCamera() {
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480, facingMode: 'user' },
        audio: false,
      });
      this.video = this.getOrCreateVideo();
      this.video.srcObject = this.stream;
      await this.video.play();
      this.onCameraReady?.();
    } catch (err) {
      console.warn('GazeTracker: camera error', err);
      this.onCameraError?.();
    }
  }

  private getOrCreateVideo(): HTMLVideoElement {
    let v = document.getElementById('gaze-video') as HTMLVideoElement | null;
    if (!v) {
      v = document.createElement('video');
      v.id = 'gaze-video';
      Object.assign(v, { muted: true });
      v.setAttribute('playsinline', '');
      v.setAttribute('autoplay', '');
      v.style.cssText = 'position:fixed;top:0;left:0;width:1px;height:1px;opacity:0;pointer-events:none;z-index:-1';
      document.body.appendChild(v);
    }
    return v;
  }

  startDetection() {
    this.stopDetection();
    if (!this.landmarker || !this.video) return;

    const loop = (rafTs: number) => {
      if (!this.video || this.video.readyState < 2) {
        this.rafId = requestAnimationFrame(loop);
        return;
      }

      if (this.video.currentTime !== this.lastVideoTime) {
        this.lastVideoTime = this.video.currentTime;

        const mpTs = Math.max(rafTs, this.lastMpTs + 0.1);
        this.lastMpTs = mpTs;

        try {
          const results   = this.landmarker!.detectForVideo(this.video!, mpTs);
          const cats      = results.faceBlendshapes?.[0]?.categories;
          const landmarks = results.faceLandmarks?.[0];

          if (cats && landmarks) {
            this.currentResults = { categories: cats, landmarks };

            const find = (name: string) => cats.find(s => s.categoryName === name)?.score ?? 0;

            const eyeLookOutL  = find('eyeLookOutLeft');
            const eyeLookInL   = find('eyeLookInLeft');
            const eyeLookUpL   = find('eyeLookUpLeft');
            const eyeLookDownL = find('eyeLookDownLeft');
            const headRotX     = landmarks[1].x - landmarks[4].x;

            const { rawX, rawY } = updateGazePoint(
              eyeLookOutL, eyeLookInL, eyeLookUpL, eyeLookDownL,
              headRotX, this.regressionModel,
              this.profileSensX, this.profileSensY,
            );

            // ── Etapa 1: Ring-buffer MA(30) fijo — O(1), sin shift() ─────────
            // Primera muestra: pre-rellena todo el buffer con rawX/rawY para
            // evitar que el cursor salte desde (0,0) mientras se llena.
            if (this.smoothFill === 0) {
              for (let i = 0; i < SMOOTH_SAMPLES; i++) {
                this.smoothBuf[i] = { x: rawX, y: rawY };
              }
              this.smoothFill = SMOOTH_SAMPLES;
            } else {
              this.smoothBuf[this.smoothIdx] = { x: rawX, y: rawY };
              this.smoothIdx = (this.smoothIdx + 1) % SMOOTH_SAMPLES;
              if (this.smoothFill < SMOOTH_SAMPLES) this.smoothFill++;
            }

            // Diagnóstico: muestra el tamaño real del buffer en consola cada 3 s
            const nowDebug = performance.now();
            if (nowDebug - this.debugLogAt > 3000) {
              console.log('[VozUCI] Buffer MA:', this.smoothFill, '/ 30 muestras | One-Euro minCutoff:', OEF_MIN_CUTOFF, 'Hz');
              this.debugLogAt = nowDebug;
            }

            // Barrera de calentamiento: no emite hasta tener SMOOTH_WARMUP muestras reales
            if (this.smoothFill < SMOOTH_WARMUP) return;

            // Media de los SMOOTH_SAMPLES slots (pre-relleno = son todos válidos)
            let sumX = 0, sumY = 0;
            for (let i = 0; i < SMOOTH_SAMPLES; i++) { sumX += this.smoothBuf[i].x; sumY += this.smoothBuf[i].y; }
            const maX = sumX / SMOOTH_SAMPLES;
            const maY = sumY / SMOOTH_SAMPLES;

            // ── Etapa 2: One-Euro Filter — suaviza, responde al movimiento ────
            const tSec = performance.now() / 1000;
            const fX   = this.filterX.filter(maX, tSec);
            const fY   = this.filterY.filter(maY, tSec);

            // ── Etapa 3: Zona muerta (10 px) — bloquea micro-temblores ───────
            const dx = fX - this.lastEmitX;
            const dy = fY - this.lastEmitY;
            let outX = (this.lastEmitX >= 0 && Math.hypot(dx, dy) < DEAD_ZONE_PX)
              ? this.lastEmitX : fX;
            let outY = (this.lastEmitY >= 0 && Math.hypot(dx, dy) < DEAD_ZONE_PX)
              ? this.lastEmitY : fY;

            // ── Clamp a pantalla ──────────────────────────────────────────────
            outX = Math.max(0, Math.min(window.innerWidth,  outX));
            outY = Math.max(0, Math.min(window.innerHeight, outY));

            // ── Snap-to-button (50 px) — imán hacia botones cercanos ─────────
            const snapped = snapToGazeTarget(outX, outY, SNAP_RADIUS_PX);
            const gx = snapped.x;
            const gy = snapped.y;

            this.lastEmitX = gx;
            this.lastEmitY = gy;

            // ── Detección de parpadeo deliberado ─────────────────────────────
            // Se ejecuta ANTES de emitir coords para que la congelación del cursor
            // ya esté activa en el mismo frame en que el parpadeo comienza.
            const blinkL  = find('eyeBlinkLeft');
            const blinkR  = find('eyeBlinkRight');
            const isBlink = blinkL > BLINK_THRESHOLD && blinkR > BLINK_THRESHOLD;
            const nowMs   = performance.now();

            if (isBlink && !this.wasBlinking) {
              // ── INICIO del cierre: CONGELAR coordenadas del cursor ────────
              // Las coords se guardan en este frame; el cursor NO se moverá
              // mientras los párpados estén cerrados ni 100 ms después de abrirse.
              this.blinkStartTime = nowMs;
              this.blinkFrozenX   = gx;
              this.blinkFrozenY   = gy;
            } else if (!isBlink && this.wasBlinking && this.blinkStartTime !== null) {
              // ── FIN del cierre: medir duración y programar descongelación ─
              const dur = nowMs - this.blinkStartTime;
              this.blinkStartTime  = null;
              this.blinkUnfreezeAt = nowMs + 100; // descongelar 100 ms tras abrir el ojo
              if (
                dur >= BLINK_MIN_MS &&
                dur <= BLINK_MAX_MS &&
                nowMs - this.lastBlinkEnd > BLINK_COOLDOWN &&
                this.blinkEnabled
              ) {
                this.lastBlinkEnd = nowMs;
                // Disparar con coords CONGELADAS (antes del ruido de párpado)
                this.fireBlinkClick(this.blinkFrozenX, this.blinkFrozenY);
              }
            }
            this.wasBlinking = isBlink;

            // ── Emitir coordenadas de gaze (congeladas durante/tras parpadeo) ─
            // Durante el parpadeo (isBlink) y los 100 ms de "rebote" post-blink,
            // se emiten las coords congeladas para que el cursor no salte.
            const freezeActive = isBlink || nowMs < this.blinkUnfreezeAt;
            const emitX = (freezeActive && this.blinkFrozenX >= 0) ? this.blinkFrozenX : gx;
            const emitY = (freezeActive && this.blinkFrozenY >= 0) ? this.blinkFrozenY : gy;
            this.gazeListeners.forEach(cb => cb(emitX, emitY));
          }
        } catch (_) {}
      }

      this.rafId = requestAnimationFrame(loop);
    };

    this.rafId = requestAnimationFrame(loop);
  }

  stopDetection() {
    if (this.rafId) { cancelAnimationFrame(this.rafId); this.rafId = 0; }
  }

  stopCamera() {
    this.stopDetection();
    this.stream?.getTracks().forEach(t => t.stop());
    this.stream = null;
    document.getElementById('gaze-video')?.remove();
    this.video          = null;
    this.lastVideoTime  = -1;
    this.lastMpTs       = 0;
    this.smoothFill     = 0;    // ring-buffer: la 1ª muestra real pre-rellena
    this.smoothIdx      = 0;
    this.debugLogAt     = 0;
    this.filterX.reset();
    this.filterY.reset();
    this.lastEmitX      = -1;
    this.lastEmitY      = -1;
    this.currentResults = null;
    this.wasBlinking    = false;
    this.blinkStartTime = null;
    this.lastBlinkEnd   = 0;
  }

  // ── Carga un Perfil Maestro de fábrica ───────────────────────────────────
  // Si el perfil incluye un ADN de fábrica (model), inicializa regressionModel
  // inmediatamente y marca isCalibrated = true: el tracker funciona sin esperar
  // al QuickSync. Si no hay ADN, el tracker queda en espera (null / uncalibrated).
  // En ambos casos se limpian los datos del perfil anterior para evitar mezclas.
  loadProfile(profile: GazeProfile) {
    this.activeProfile  = profile;
    this.profileSensX   = profile.sensitivityX;
    this.profileSensY   = profile.sensitivityY;
    // Limpiar siempre datos del perfil anterior (evita mezclar ADNs)
    this.trainingData   = [];
    this.continuousData = [];

    if (profile.model) {
      // ─ Perfil con ADN de fábrica: usar sus coeficientes directamente ────────
      // El QuickSync ajustará solo alphaX/Y (offset del paciente); betaX/Y
      // quedan bloqueados a los valores maestros grabados de fábrica.
      this.regressionModel = { ...profile.model };
      this.isCalibrated    = true;
      console.log(
        `%cGazeTracker: perfil "${profile.label}" cargado con ADN de fábrica ✓`,
        'color:#7DD3A8;font-weight:800',
        `| sensX=${profile.sensitivityX} sensY=${profile.sensitivityY}`,
        `| αX=${profile.model.alphaX.toFixed(1)} βX=${profile.model.betaX.toFixed(1)}`,
        `| αY=${profile.model.alphaY.toFixed(1)} βY=${profile.model.betaY.toFixed(1)}`,
      );
    } else {
      // ─ Sin ADN de fábrica: requiere QuickSync antes de estimar posición ─────
      this.regressionModel = null;
      this.isCalibrated    = false;
      console.log(
        `GazeTracker: perfil "${profile.label}" cargado (sin ADN; requiere QuickSync)`,
        `| sensX=${profile.sensitivityX} sensY=${profile.sensitivityY}`,
        `| distancia ~${profile.distanceCm} cm`,
      );
    }
  }

  get currentProfile() { return this.activeProfile; }

  // ── Debug: copia todo el estado de calibración ────────────────────────────
  getDebugInfo(): object {
    const model = this.regressionModel;
    return {
      timestamp:    new Date().toISOString(),
      profile: {
        id:           this.activeProfile.id,
        label:        this.activeProfile.label,
        distanceCm:   this.activeProfile.distanceCm,
        sensitivityX: this.activeProfile.sensitivityX,
        sensitivityY: this.activeProfile.sensitivityY,
      },
      calibrated: this.isCalibrated,
      model: model ? {
        alphaX: +model.alphaX.toFixed(4),
        betaX:  +model.betaX.toFixed(4),
        alphaY: +model.alphaY.toFixed(4),
        betaY:  +model.betaY.toFixed(4),
      } : null,
      screen: {
        widthPx:  window.innerWidth,
        heightPx: window.innerHeight,
        pixelRatio: window.devicePixelRatio,
      },
      continuousSamples: this.continuousData.length,
    };
  }

  // ── Estado en vivo del rostro detectado ──────────────────────────────────
  // Usado por CalibrationScreen para la validación previa al inicio.
  getFaceStatus(): { detected: boolean; bothEyesOpen: boolean; noseX: number } {
    const res = this.currentResults;
    if (!res) return { detected: false, bothEyesOpen: false, noseX: 0.5 };
    const find = (n: string) => res.categories.find(s => s.categoryName === n)?.score ?? 0;
    return {
      detected:     true,
      bothEyesOpen: find('eyeBlinkLeft') < 0.3 && find('eyeBlinkRight') < 0.3,
      noseX:        res.landmarks[1]?.x ?? 0.5,
    };
  }

  // Imprime el estado actual en consola (útil para calibración maestra)
  logDebugInfo(label = 'GazeTracker debug') {
    const info = this.getDebugInfo();
    console.groupCollapsed(`%c${label}`, 'color:#7DD3A8;font-weight:800;font-size:12px');
    console.log(JSON.stringify(info, null, 2));
    console.groupEnd();
  }

  // ── Calibración rápida: muestra al centro ────────────────────────────────
  recordCalibrationPoint(screenX: number, screenY: number): boolean {
    const shapes    = this.currentResults?.categories;
    const landmarks = this.currentResults?.landmarks;
    if (!shapes || !landmarks) return false;

    const find = (name: string) => shapes.find(s => s.categoryName === name)?.score ?? 0;
    const headRotX = landmarks[1].x - landmarks[4].x;
    const eyeX = (find('eyeLookOutLeft') - find('eyeLookInLeft')) + (headRotX * 2);
    const eyeY =  find('eyeLookUpLeft')  - find('eyeLookDownLeft');

    this.trainingData.push({ eyeX, eyeY, screenX, screenY });
    return true;
  }

  // ── Calibración instantánea: ancla centro + pendiente universal ──────────
  // Usa la media de los vectores oculares recogidos durante 3s mirando el centro
  // para corregir el offset individual (alphaX/Y) sin perder la sensibilidad.
  //
  // Si el perfil ya tiene un ADN de fábrica cargado, las pendientes (betaX/Y)
  // se preservan tal cual — son los valores maestros de 10 muestras y son más
  // precisos que la aproximación algebraica. Solo se recalcula el offset.
  //
  // Si no hay ADN previo, calcula las pendientes desde la sensibilidad del perfil
  // (comportamiento original, igual que antes).
  quickCenterCalibrate(): boolean {
    if (this.trainingData.length < 5) return false;

    const cx = window.innerWidth  / 2;
    const cy = window.innerHeight / 2;

    const n       = this.trainingData.length;
    const avgEyeX = this.trainingData.reduce((s, d) => s + d.eyeX, 0) / n;
    const avgEyeY = this.trainingData.reduce((s, d) => s + d.eyeY, 0) / n;

    // ── Pendientes (beta) ────────────────────────────────────────────────────
    // Prioridad: ADN de fábrica ya cargado > algebraica desde sensibilidad.
    // Los betas del ADN son más precisos (promedio de 10 sesiones reales).
    const betaX = this.regressionModel?.betaX  ?? this.profileSensX * window.innerWidth;
    const betaY = this.regressionModel?.betaY  ?? -this.profileSensY * window.innerHeight;

    // ── Offset (alpha): ajuste individual de este paciente/posición ──────────
    this.regressionModel = {
      alphaX: cx - betaX * avgEyeX,
      betaX,
      alphaY: cy - betaY * avgEyeY,
      betaY,
    };
    this.isCalibrated = true;
    this.trainingData = [];
    this.continuousData = [];

    this.logDebugInfo('GazeTracker: QuickSync completado ✓');
    return true;
  }

  // ── Aprendizaje continuo: registra cada clic exitoso en segundo plano ────
  recordClickCalibration(screenX: number, screenY: number) {
    const shapes    = this.currentResults?.categories;
    const landmarks = this.currentResults?.landmarks;
    if (!shapes || !landmarks || !this.isCalibrated) return;

    const find = (name: string) => shapes.find(s => s.categoryName === name)?.score ?? 0;
    const headRotX = landmarks[1].x - landmarks[4].x;
    const eyeX = (find('eyeLookOutLeft') - find('eyeLookInLeft')) + (headRotX * 2);
    const eyeY =  find('eyeLookUpLeft')  - find('eyeLookDownLeft');

    // FIFO buffer
    this.continuousData.push({ eyeX, eyeY, screenX, screenY });
    if (this.continuousData.length > CONTINUOUS_MAX) this.continuousData.shift();

    // Recomputar si tenemos suficientes datos con dispersión suficiente
    if (this.continuousData.length >= CONTINUOUS_MIN) {
      const xVals = this.continuousData.map(d => d.screenX);
      const spread = Math.max(...xVals) - Math.min(...xVals);
      if (spread > window.innerWidth * 0.15) {
        // Mezcla: puntos continuos + 3 anclajes sintéticos al centro
        const cx = window.innerWidth  / 2;
        const cy = window.innerHeight / 2;
        const anchor: TrainingPoint = { eyeX: 0, eyeY: 0, screenX: cx, screenY: cy };
        const mixed = [...this.continuousData, anchor, anchor, anchor];
        this.regressionModel = calculateRegression(mixed);
        console.log('GazeTracker: recalibración continua aplicada');
      }
    }
  }

  // Métodos legacy (UsaCalibrationOverlay los llama)
  computeCalibration() {
    if (this.trainingData.length >= 4) {
      this.regressionModel = calculateRegression(this.trainingData);
      this.isCalibrated    = true;
    }
    this.trainingData = [];
  }

  clearCalibration() {
    this.trainingData    = [];
    this.continuousData  = [];
    this.isCalibrated    = false;
    this.regressionModel = null;
    this.currentResults  = null;
    this.lastVideoTime   = -1;
    this.lastMpTs        = 0;
    this.smoothFill      = 0;   // ring-buffer reset: pre-relleno en 1ª muestra real
    this.smoothIdx       = 0;
    this.debugLogAt      = 0;
    this.wasBlinking     = false;
    this.blinkStartTime  = null;
    this.lastBlinkEnd    = 0;
  }

  // ── Activa / desactiva el blink-click (false durante calibración) ─────────
  setBlinkEnabled(v: boolean) { this.blinkEnabled = v; }

  // ── Dispara la acción de blink-click verificado ───────────────────────────
  // Mejoras de precisión:
  //   1. Validación de confianza: solo dispara si hay un botón en radio snap.
  //   2. Feedback verde inmediato en el cursor (setCursorBlinkSuccess).
  //   3. Sonido "pop".
  //   4. Flash del botón activado.
  //   5. Notifica blinkListeners.
  private fireBlinkClick(x: number, y: number) {
    // ── VALIDACIÓN DE CONFIANZA ───────────────────────────────────────────────
    // Si el cursor está en el vacío (sin ningún .gaze-target en el radio de
    // atracción), el parpadeo se ignora: el paciente no estaba mirando un botón.
    if (!hasGazeTarget(x, y, SNAP_RADIUS_PX + 20)) return;

    // Snap al centro exacto del botón más cercano
    const snapped = snapToGazeTarget(x, y, SNAP_RADIUS_PX + 20);

    // ── FEEDBACK VERDE INMEDIATO ──────────────────────────────────────────────
    // El cursor cambia a verde brillante para confirmar al paciente que su
    // parpadeo fue reconocido como un clic válido.
    setCursorBlinkSuccess();

    // Sonido de confirmación
    playPopSound();

    // Flash del botón activado
    const topEl  = document.elementFromPoint(snapped.x, snapped.y);
    const gazeEl = topEl?.closest<HTMLElement>('.gaze-target') ?? null;
    if (gazeEl) {
      gazeEl.classList.add('blink-activated');
      setTimeout(() => gazeEl.classList.remove('blink-activated'), 500);
    }

    // Notificar listeners (triggerClick en el hook ejecuta el onClick del botón)
    this.blinkListeners.forEach(cb => cb(snapped.x, snapped.y));
  }

  getModel(): (RegressionModel & { calibrated: boolean }) | null {
    if (!this.regressionModel) return null;
    return { ...this.regressionModel, calibrated: this.isCalibrated };
  }

  // ── Entrenamiento multi-punto: número de muestras acumuladas ─────────────
  getTrainingDataLength(): number {
    return this.trainingData.length;
  }

  // ── Entrenamiento multi-punto: descarta muestras añadidas después de `n` ─
  // Permite al overlay "Repetir" una ronda sin perder las anteriores.
  trimTrainingData(toLength: number) {
    this.trainingData = this.trainingData.slice(0, toLength);
  }

  // ── Entrenamiento multi-punto: corre regresión sobre todos los puntos ─────
  // Llamar cuando el usuario ha completado todas las rondas (9 posiciones × 4).
  // Devuelve el modelo calculado o null si hay < 30 puntos brutos o si los
  // datos son degenerados (varianza de eyeX o eyeY ≈ 0).
  finalizeTraining(): (RegressionModel & { sensitivityX: number; sensitivityY: number }) | null {
    const raw = this.trainingData;
    if (raw.length < 30) {
      console.warn(`[finalizeTraining] Datos insuficientes: ${raw.length} < 30`);
      return null;
    }

    // ── Diagnóstico de varianza ──────────────────────────────────────────────
    const n        = raw.length;
    const meanEyeX = raw.reduce((s, d) => s + d.eyeX, 0) / n;
    const meanEyeY = raw.reduce((s, d) => s + d.eyeY, 0) / n;
    const varX     = raw.reduce((s, d) => s + (d.eyeX - meanEyeX) ** 2, 0) / n;
    const varY     = raw.reduce((s, d) => s + (d.eyeY - meanEyeY) ** 2, 0) / n;
    console.groupCollapsed('%c[finalizeTraining] Diagnóstico de varianza', 'color:#7DD3A8;font-weight:700');
    console.log(`n=${n}  meanEyeX=${meanEyeX.toFixed(4)}  meanEyeY=${meanEyeY.toFixed(4)}`);
    console.log(`varEyeX=${varX.toFixed(6)}  varEyeY=${varY.toFixed(6)}`);
    console.groupEnd();

    // Si la varianza es casi nula el modelo sería betaX≈0, alphaX≈mean(screenX)
    // — completamente inútil. Devolvemos null para forzar reintento.
    if (varX < 1e-6 || varY < 1e-6) {
      console.error(
        '[finalizeTraining] Datos degenerados: varianza nula en eyeX o eyeY.\n' +
        '  Causas probables: blendshapes MediaPipe desactivados, cara inmóvil\n' +
        '  o dispositivo sin cámara frontal operativa.',
        { varX, varY, n }
      );
      this.trainingData   = [];
      this.continuousData = [];
      return null;
    }
    // ── FIN diagnóstico ──────────────────────────────────────────────────────

    const model = calculateRegression(raw);
    this.regressionModel = model;
    this.isCalibrated    = true;
    this.trainingData    = [];
    this.continuousData  = [];
    const W = window.innerWidth;
    const H = window.innerHeight;
    this.logDebugInfo('GazeTracker: entrenamiento multi-punto finalizado ✓');
    return {
      ...model,
      sensitivityX: +(model.betaX / W).toFixed(4),
      sensitivityY: +(-model.betaY / H).toFixed(4),
    };
  }

  addGazeListener(cb: GazeCallback)     { this.gazeListeners.add(cb); }
  removeGazeListener(cb: GazeCallback)  { this.gazeListeners.delete(cb); }
  addBlinkListener(cb: BlinkCallback)   { this.blinkListeners.add(cb); }
  removeBlinkListener(cb: BlinkCallback){ this.blinkListeners.delete(cb); }

  get hasFaceModel() { return this.landmarker !== null; }
  get hasCamera()    { return !!(this.video && this.video.readyState >= 2); }
}

export const gazeTracker = new GazeTracker();

// ─── Zustand store ────────────────────────────────────────────────────────────
interface WebGazerState {
  isActive:               boolean;
  isCalibrating:          boolean;
  /** true una vez que el flujo Splash→Perfil→QuickSync ha completado.
   *  Bloquea cualquier re-entrada al componente CalibrationScreen. */
  hasCompletedInitialSync: boolean;

  startCalibration:  () => void;
  finishCalibration: () => void;
  /** Activa la mirada directamente usando el perfil ya calibrado.
   *  No muestra CalibrationScreen. Usado tras hasCompletedInitialSync=true. */
  activateFromProfile: () => void;
  setSyncCompleted:  () => void;
  deactivate:        () => void;
}

export const useWebGazerStore = create<WebGazerState>((set) => ({
  isActive:               false,
  isCalibrating:          false,
  hasCompletedInitialSync: false,

  startCalibration:    () => set({ isCalibrating: true,  isActive: false }),
  finishCalibration:   () => set({ isCalibrating: false, isActive: true }),
  activateFromProfile: () => set({ isActive: true, isCalibrating: false }),
  setSyncCompleted:    () => set({ hasCompletedInitialSync: true }),
  deactivate:          () => set({ isActive: false, isCalibrating: false }),
}));

// ─── React hook ───────────────────────────────────────────────────────────────
export function useWebGazer() {
  const {
    isActive, isCalibrating, hasCompletedInitialSync,
    startCalibration, finishCalibration, activateFromProfile, deactivate,
  } = useWebGazerStore();

  // ── Efecto C: Calibrando → cámara + detección ────────────────────────────────
  // NOTA: el cursor #gaze-cursor lo crea globalCursor.ts en main.tsx,
  // sincrónicamente antes de React. No necesitamos crear ni destruir el elemento aquí.
  useEffect(() => {
    if (!isCalibrating) return;
    gazeTracker.clearCalibration();
    (async () => {
      if (!gazeTracker.hasFaceModel) await gazeTracker.init();
      await gazeTracker.startCamera();
      gazeTracker.startDetection();
    })();
  }, [isCalibrating]);

  // ── Efecto D: Activo → cursor unificado (gaze + touch + blink) ───────────────
  useEffect(() => {
    if (!isActive) {
      setGazePriority(false); // ceder control al listener de ratón/touch global
      gazeTracker.stopDetection();
      return;
    }

    setGazePriority(true); // gaze toma prioridad sobre el ratón

    // Asegurar cámara y modelo listos
    (async () => {
      if (!gazeTracker.hasFaceModel) await gazeTracker.init();
      if (!gazeTracker.hasCamera)    await gazeTracker.startCamera();
      gazeTracker.startDetection();
    })();

    let targetEl:      HTMLElement | null = null;
    let enterTime      = 0;
    let dwellCooldown  = false;
    let touchLockUntil = 0;

    // ── Helpers ──────────────────────────────────────────────────────────────
    function activateTarget(el: HTMLElement) {
      const rect = el.getBoundingClientRect();
      gazeTracker.recordClickCalibration(rect.left + rect.width / 2, rect.top + rect.height / 2);
      el.click();
      resetProgress(el);
      el.style.transform = 'scale(0.95)';
      setTimeout(() => { el.style.transform = ''; }, 150);
    }

    function hitTest(x: number, y: number): HTMLElement | null {
      // Ocultar temporalmente el cursor para que elementFromPoint no lo devuelva
      const cur = document.getElementById('gaze-cursor');
      if (cur) cur.style.visibility = 'hidden';
      const hit = document.elementFromPoint(x, y) as HTMLElement | null;
      if (cur) cur.style.visibility = '';
      return hit?.closest('[data-gaze-target="true"]') as HTMLElement | null;
    }

    // ── triggerClick: función unificada para BLINK y TOQUE ───────────────────
    function triggerClick(x: number, y: number) {
      flashGlobalCursor();
      const target = hitTest(x, y);
      if (target) {
        target.classList.add('blink-activated');
        setTimeout(() => target.classList.remove('blink-activated'), 500);
        activateTarget(target);
      }
    }

    // ── TOQUE FÍSICO: salta cursor al dedo + bloquea gaze 1 s ───────────────
    const onTouchStart = (e: TouchEvent) => {
      const t = e.touches[0];
      if (!t) return;
      e.preventDefault();
      const { clientX: x, clientY: y } = t;
      moveGlobalCursor(x, y);
      touchLockUntil = performance.now() + 1000;
      triggerClick(x, y);
    };

    // ── Helpers de hover-aim ──────────────────────────────────────────────────
    // Añade/quita la clase CSS .gaze-hover que ilumina el borde del botón
    // mientras el cursor de mirada está encima, ayudando al paciente a apuntar.
    function setAimGlow(el: HTMLElement | null, on: boolean) {
      if (!el) return;
      if (on) el.classList.add('gaze-hover');
      else    el.classList.remove('gaze-hover');
    }

    // ── MIRADA: gaze tiene prioridad salvo durante 1 s tras un toque ─────────
    const onGaze = (x: number, y: number) => {
      if (performance.now() < touchLockUntil) return;
      moveGlobalCursor(x, y);

      const target = hitTest(x, y);
      const now    = performance.now();

      if (target) {
        if (target !== targetEl) {
          // ── Cambio de botón: apagar glow del anterior, encender el nuevo ───
          if (targetEl) { resetProgress(targetEl); setAimGlow(targetEl, false); }
          targetEl = target; enterTime = now; dwellCooldown = false;
          setAimGlow(target, true);
        } else if (!dwellCooldown) {
          const progress = Math.min((now - enterTime) / DWELL_MS, 1);
          updateProgress(target, progress);
          if (progress >= 1) {
            // ── Activación por dwell: apagar glow antes de activar ───────────
            setAimGlow(target, false);
            activateTarget(target);
            dwellCooldown = true;
          }
        }
      } else if (targetEl) {
        // ── El cursor salió al vacío ──────────────────────────────────────────
        resetProgress(targetEl);
        setAimGlow(targetEl, false);
        targetEl = null;
      }
    };

    // ── PARPADEO ─────────────────────────────────────────────────────────────
    const onBlink = (x: number, y: number) => triggerClick(x, y);

    window.addEventListener('touchstart', onTouchStart, { passive: false, capture: true });
    gazeTracker.addGazeListener(onGaze);
    gazeTracker.addBlinkListener(onBlink);

    return () => {
      setGazePriority(false);
      // Limpiar glow pendiente al desmontar
      setAimGlow(targetEl, false);
      window.removeEventListener('touchstart', onTouchStart, { capture: true });
      gazeTracker.removeGazeListener(onGaze);
      gazeTracker.removeBlinkListener(onBlink);
    };
  }, [isActive]);

  useEffect(() => {
    if (!isCalibrating && !isActive) gazeTracker.stopCamera();
  }, [isCalibrating, isActive]);

  return {
    isActive, isCalibrating, hasCompletedInitialSync,
    startCalibration, finishCalibration, activateFromProfile, deactivate,
  };
}

// ─── Dwell helpers ────────────────────────────────────────────────────────────
function resetProgress(el: HTMLElement) {
  const bar = el.querySelector('.gaze-progress-bar') as HTMLElement | null;
  if (bar) bar.style.width = '0%';
}
function updateProgress(el: HTMLElement, progress: number) {
  const bar = el.querySelector('.gaze-progress-bar') as HTMLElement | null;
  if (bar) bar.style.width = `${progress * 100}%`;
}
