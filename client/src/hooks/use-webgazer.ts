import { useEffect } from 'react';
import { create } from 'zustand';
import { FaceLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';

// ─── MediaPipe ───────────────────────────────────────────────────────────────
const WASM_PATH = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.32/wasm';
const MODEL_URL = 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task';

const SENSITIVITY     = 1.5;   // cuánto se mueve el cursor respecto al ojo
const DWELL_MS        = 3000;  // 3 segundos manteniendo la mirada para activar
const ALPHA           = 0.2;   // filtro paso bajo: 0.8·prev + 0.2·nuevo
const BLINK_THRESHOLD = 0.55;  // umbral para detectar parpadeo deliberado (0–1)
const BLINK_COOLDOWN  = 1200;  // ms de bloqueo tras cada parpadeo detectado

// ─── Tipos ────────────────────────────────────────────────────────────────────
type BlendshapeCategory = { categoryName: string; score: number };
type DetectionCache     = { categories: BlendshapeCategory[] } | null;
type GazeCallback       = (x: number, y: number) => void;
type BlinkCallback      = (x: number, y: number) => void; // posición actual de mirada

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
  let sumX = 0, sumScreenX = 0, sumXX = 0, sumXSX = 0;
  let sumY = 0, sumScreenY = 0, sumYY = 0, sumYSY = 0;

  data.forEach(d => {
    sumX      += d.eyeX;   sumScreenX += d.screenX;
    sumXX     += d.eyeX * d.eyeX;   sumXSX += d.eyeX * d.screenX;
    sumY      += d.eyeY;   sumScreenY += d.screenY;
    sumYY     += d.eyeY * d.eyeY;   sumYSY += d.eyeY * d.screenY;
  });

  const denX = (n * sumXX - sumX * sumX) || 0.001;
  const betaX  = (n * sumXSX - sumX * sumScreenX) / denX;
  const alphaX = (sumScreenX - betaX * sumX) / n;

  const denY = (n * sumYY - sumY * sumY) || 0.001;
  const betaY  = (n * sumYSY - sumY * sumScreenY) / denY;
  const alphaY = (sumScreenY - betaY * sumY) / n;

  console.log(
    `GazeTracker: calibración OK (${n} muestras) —`,
    `X: α=${alphaX.toFixed(1)} β=${betaX.toFixed(1)}`,
    `Y: α=${alphaY.toFixed(1)} β=${betaY.toFixed(1)}`,
  );
  return { alphaX, betaX, alphaY, betaY };
}

// ─── predictUniversalGaze: fallback sin calibración ──────────────────────────
function predictUniversalGaze(lookX: number, lookY: number) {
  return {
    rawX: (window.innerWidth  / 2) + (lookX * window.innerWidth  * SENSITIVITY),
    rawY: (window.innerHeight / 2) - (lookY * window.innerHeight * SENSITIVITY),
  };
}

// ─── updateGazePoint: calibrado o fallback ───────────────────────────────────
function updateGazePoint(eyeX: number, eyeY: number, model: RegressionModel | null) {
  if (model) {
    return {
      rawX: model.alphaX + model.betaX * eyeX,
      rawY: model.alphaY + model.betaY * eyeY,
    };
  }
  return predictUniversalGaze(eyeX, eyeY);
}

// ─── GazeTracker (singleton) ─────────────────────────────────────────────────
class GazeTracker {
  private landmarker:     FaceLandmarker | null = null;
  private video:          HTMLVideoElement | null = null;
  private stream:         MediaStream | null = null;
  private rafId:          number = 0;
  private lastVideoTime:  number = -1;
  private lastMpTs:       number = 0;

  private smoothX = window.innerWidth  / 2;
  private smoothY = window.innerHeight / 2;

  // Caché del último frame detectado
  private currentResults: DetectionCache = null;

  // Calibración
  private trainingData:    TrainingPoint[]   = [];
  private isCalibrated     = false;
  private regressionModel: RegressionModel | null = null;

  // Parpadeo
  private wasBlinking   = false;
  private blinkOnCooldown = false;

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
    // Siempre detener el loop anterior — evita loops dobles y timestamps no crecientes
    this.stopDetection();
    if (!this.landmarker || !this.video) return;

    const loop = (rafTs: number) => {
      if (!this.video || this.video.readyState < 2) {
        this.rafId = requestAnimationFrame(loop);
        return;
      }

      if (this.video.currentTime !== this.lastVideoTime) {
        this.lastVideoTime = this.video.currentTime;

        // Timestamp siempre creciente para MediaPipe
        const mpTs = Math.max(rafTs, this.lastMpTs + 0.1);
        this.lastMpTs = mpTs;

        try {
          const results = this.landmarker!.detectForVideo(this.video!, mpTs);
          const cats    = results.faceBlendshapes?.[0]?.categories;

          if (cats) {
            this.currentResults = { categories: cats };

            const find = (name: string) => cats.find(s => s.categoryName === name)?.score ?? 0;

            // ── Mirada ──────────────────────────────────────────────────────
            const eyeX = find('eyeLookOutLeft') - find('eyeLookInLeft');
            const eyeY = find('eyeLookUpLeft')  - find('eyeLookDownLeft');

            const { rawX, rawY } = updateGazePoint(eyeX, eyeY, this.regressionModel);
            this.smoothX = ALPHA * rawX + (1 - ALPHA) * this.smoothX;
            this.smoothY = ALPHA * rawY + (1 - ALPHA) * this.smoothY;

            const gx = Math.max(0, Math.min(window.innerWidth,  this.smoothX));
            const gy = Math.max(0, Math.min(window.innerHeight, this.smoothY));
            this.gazeListeners.forEach(cb => cb(gx, gy));

            // ── Parpadeo deliberado ──────────────────────────────────────────
            // Promedio de ambos ojos — detecta un cierre firme, no el natural
            const blinkScore = (find('eyeBlinkLeft') + find('eyeBlinkRight')) / 2;
            const isBlink    = blinkScore > BLINK_THRESHOLD;

            if (isBlink && !this.wasBlinking && !this.blinkOnCooldown) {
              this.blinkOnCooldown = true;
              this.blinkListeners.forEach(cb => cb(gx, gy));
              setTimeout(() => { this.blinkOnCooldown = false; }, BLINK_COOLDOWN);
            }
            this.wasBlinking = isBlink;
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
    this.smoothX        = window.innerWidth  / 2;
    this.smoothY        = window.innerHeight / 2;
    this.currentResults = null;
    this.wasBlinking    = false;
    this.blinkOnCooldown = false;
  }

  // ── Calibración ─────────────────────────────────────────────────────────────
  // Devuelve true si grabó la muestra, false si no hay cara (safeRecord)
  recordCalibrationPoint(screenX: number, screenY: number): boolean {
    const shapes = this.currentResults?.categories;
    if (!shapes) return false;

    const find = (name: string) => shapes.find(s => s.categoryName === name)?.score ?? 0;
    const eyeX = find('eyeLookOutLeft') - find('eyeLookInLeft');
    const eyeY = find('eyeLookUpLeft')  - find('eyeLookDownLeft');

    this.trainingData.push({ eyeX, eyeY, screenX, screenY });

    if (this.trainingData.length >= 27) {
      this.calculateCalibration();
    }
    return true;
  }

  private calculateCalibration() {
    this.regressionModel = calculateRegression(this.trainingData);
    this.isCalibrated    = true;
  }

  computeCalibration() {
    if (this.trainingData.length >= 4) this.calculateCalibration();
    this.trainingData = [];
  }

  clearCalibration() {
    this.trainingData    = [];
    this.isCalibrated    = false;
    this.regressionModel = null;
    this.currentResults  = null;
    this.lastVideoTime   = -1;
    this.lastMpTs        = 0;
    this.wasBlinking     = false;
    this.blinkOnCooldown = false;
  }

  // ── Listeners ───────────────────────────────────────────────────────────────
  addGazeListener(cb: GazeCallback)    { this.gazeListeners.add(cb); }
  removeGazeListener(cb: GazeCallback) { this.gazeListeners.delete(cb); }
  addBlinkListener(cb: BlinkCallback)  { this.blinkListeners.add(cb); }
  removeBlinkListener(cb: BlinkCallback){ this.blinkListeners.delete(cb); }

  get hasFaceModel() { return this.landmarker !== null; }
  get hasCamera()    { return !!(this.video && this.video.readyState >= 2); }
}

export const gazeTracker = new GazeTracker();

// ─── Zustand store ────────────────────────────────────────────────────────────
interface WebGazerState {
  isActive:          boolean;
  isCalibrating:     boolean;
  startCalibration:  () => void;
  finishCalibration: () => void;
  deactivate:        () => void;
}

export const useWebGazerStore = create<WebGazerState>((set) => ({
  isActive:          false,
  isCalibrating:     false,
  startCalibration:  () => set({ isCalibrating: true,  isActive: false }),
  finishCalibration: () => set({ isCalibrating: false, isActive: true }),
  deactivate:        () => set({ isActive: false, isCalibrating: false }),
}));

// ─── React hook ───────────────────────────────────────────────────────────────
export function useWebGazer() {
  const { isActive, isCalibrating, startCalibration, finishCalibration, deactivate } =
    useWebGazerStore();

  useEffect(() => {
    if (!document.getElementById('gaze-cursor')) {
      const el = document.createElement('div');
      el.id = 'gaze-cursor';
      document.body.appendChild(el);
    }
    return () => { document.getElementById('gaze-cursor')?.remove(); };
  }, []);

  // Calibrando → cámara + detección (sin blink listener)
  useEffect(() => {
    if (!isCalibrating) return;
    gazeTracker.clearCalibration();
    (async () => {
      if (!gazeTracker.hasFaceModel) await gazeTracker.init();
      await gazeTracker.startCamera();
      gazeTracker.startDetection();
    })();
  }, [isCalibrating]);

  // Activo → dwell + parpadeo
  useEffect(() => {
    const cursor = document.getElementById('gaze-cursor');
    if (!isActive) {
      if (cursor) cursor.style.display = 'none';
      gazeTracker.stopDetection();
      return;
    }
    if (cursor) cursor.style.display = 'block';
    gazeTracker.startDetection();

    let targetEl:  HTMLElement | null = null;
    let enterTime  = 0;
    let dwellCooldown = false;

    // ── Helper: dispara click + efecto visual en el target ──────────────────
    function activateTarget(el: HTMLElement) {
      el.click();
      resetProgress(el);
      el.style.transform = 'scale(0.95)';
      setTimeout(() => { el.style.transform = ''; }, 150);
    }

    // ── Helper: hitTest oculta el cursor para que elementFromPoint funcione ─
    function hitTest(x: number, y: number): HTMLElement | null {
      if (cursor) cursor.style.visibility = 'hidden';
      const hit = document.elementFromPoint(x, y) as HTMLElement | null;
      if (cursor) cursor.style.visibility = '';
      return hit?.closest('[data-gaze-target="true"]') as HTMLElement | null;
    }

    // ── Listener de mirada: mueve cursor + dwell ─────────────────────────────
    const onGaze = (x: number, y: number) => {
      if (cursor) cursor.style.transform =
        `translate(calc(${x}px - 50%), calc(${y}px - 50%)) rotate(45deg)`;

      const target = hitTest(x, y);
      const now    = performance.now();

      if (target) {
        if (target !== targetEl) {
          if (targetEl) resetProgress(targetEl);
          targetEl  = target;
          enterTime = now;
          dwellCooldown = false;
        } else if (!dwellCooldown) {
          const progress = Math.min((now - enterTime) / DWELL_MS, 1);
          updateProgress(target, progress);
          if (progress >= 1) {
            activateTarget(target);
            dwellCooldown = true;
          }
        }
      } else if (targetEl) {
        resetProgress(targetEl);
        targetEl = null;
      }
    };

    // ── Listener de parpadeo: click inmediato + flash de cursor ──────────────
    const onBlink = (x: number, y: number) => {
      // Flash visual del cursor
      if (cursor) {
        cursor.classList.add('gaze-blink-flash');
        setTimeout(() => cursor.classList.remove('gaze-blink-flash'), 350);
      }
      // Click en el elemento bajo la mirada
      const target = hitTest(x, y);
      if (target) activateTarget(target);
    };

    gazeTracker.addGazeListener(onGaze);
    gazeTracker.addBlinkListener(onBlink);

    return () => {
      gazeTracker.removeGazeListener(onGaze);
      gazeTracker.removeBlinkListener(onBlink);
      if (cursor) cursor.style.display = 'none';
    };
  }, [isActive]);

  // Ni calibrando ni activo → apagar todo
  useEffect(() => {
    if (!isCalibrating && !isActive) gazeTracker.stopCamera();
  }, [isCalibrating, isActive]);

  return { isActive, isCalibrating, startCalibration, finishCalibration, deactivate };
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
