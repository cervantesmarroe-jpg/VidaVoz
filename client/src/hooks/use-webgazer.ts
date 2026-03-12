import { useEffect } from 'react';
import { create } from 'zustand';
import { FaceLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';

// ─── MediaPipe ───────────────────────────────────────────────────────────────
const WASM_PATH = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.32/wasm';
const MODEL_URL = 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task';

const DWELL_MS = 2000;
const ALPHA    = 0.22;   // suavizado EWA

// ─── Tipos ────────────────────────────────────────────────────────────────────
type BlendshapeCategory = { categoryName: string; score: number };

// currentResults: caché del último resultado de detectForVideo.
// recordCalibrationPoint lee de aquí — nunca vuelve a llamar a detectForVideo.
type DetectionCache = { categories: BlendshapeCategory[] } | null;

// Modelo de regresión lineal simple por eje
interface RegressionModel {
  alphaX: number; betaX: number;  // screenX = alphaX + betaX * eyeX
  alphaY: number; betaY: number;  // screenY = alphaY + betaY * eyeY
}

interface TrainingPoint {
  eyeX: number;     // eyeLookOutLeft - eyeLookInLeft
  eyeY: number;     // eyeLookUpLeft  - eyeLookDownLeft
  screenX: number;
  screenY: number;
}

type GazeCallback = (x: number, y: number) => void;

// ─── calculateRegression: fórmula explícita igual que la referencia del usuario
function calculateRegression(data: TrainingPoint[]): RegressionModel {
  const n = data.length;

  let sumX = 0, sumY = 0, sumXX = 0, sumXY_sx = 0, sumScreenX = 0;
  let sumEyeY = 0, sumYY = 0, sumYScreenY = 0, sumScreenY = 0;

  data.forEach(d => {
    sumX      += d.eyeX;
    sumScreenX += d.screenX;
    sumXX     += d.eyeX * d.eyeX;
    sumXY_sx  += d.eyeX * d.screenX;

    sumEyeY   += d.eyeY;
    sumScreenY += d.screenY;
    sumYY     += d.eyeY * d.eyeY;
    sumYScreenY += d.eyeY * d.screenY;
  });

  // Pendiente X: betaX = (n·Σ(eyeX·screenX) - Σ(eyeX)·Σ(screenX)) / (n·Σ(eyeX²) - Σ(eyeX)²)
  const denX = (n * sumXX - sumX * sumX) || 0.001;
  const betaX  = (n * sumXY_sx  - sumX    * sumScreenX) / denX;
  const alphaX = (sumScreenX - betaX  * sumX)    / n;

  // Pendiente Y (misma fórmula, eje vertical)
  const denY = (n * sumYY - sumEyeY * sumEyeY) || 0.001;
  const betaY  = (n * sumYScreenY - sumEyeY * sumScreenY) / denY;
  const alphaY = (sumScreenY - betaY  * sumEyeY) / n;

  console.log(
    `GazeTracker: calibración OK con ${n} muestras —`,
    `X: α=${alphaX.toFixed(1)} β=${betaX.toFixed(1)}`,
    `Y: α=${alphaY.toFixed(1)} β=${betaY.toFixed(1)}`,
  );

  return { alphaX, betaX, alphaY, betaY };
}

// ─── updateGazePoint: aplica el modelo (o fallback sin calibrar) ──────────────
function updateGazePoint(
  eyeX: number,
  eyeY: number,
  model: RegressionModel | null,
): { rawX: number; rawY: number } {
  if (model) {
    // Aplicamos la fórmula: Coordenada = Alpha + (Beta * ValorOjo)
    return {
      rawX: model.alphaX + model.betaX * eyeX,
      rawY: model.alphaY + model.betaY * eyeY,
    };
  }
  // Fallback sin calibración: fórmula directa
  const W = window.innerWidth, H = window.innerHeight;
  return {
    rawX: W / 2 + eyeX * W * 0.8,
    rawY: H / 2 - eyeY * H * 0.8,
  };
}

// ─── GazeTracker (singleton) ─────────────────────────────────────────────────
class GazeTracker {
  private landmarker: FaceLandmarker | null = null;
  private video:      HTMLVideoElement | null = null;
  private stream:     MediaStream | null = null;
  private rafId:      number = 0;
  private lastVideoTime: number = -1;

  // Timestamp estrictamente creciente para MediaPipe — nunca retrocede
  private lastMpTs: number = 0;

  private smoothX = window.innerWidth  / 2;
  private smoothY = window.innerHeight / 2;

  // currentResults: caché del último blendshape detectado
  // recordCalibrationPoint() lo lee sin rellamar detectForVideo
  private currentResults: DetectionCache = null;

  // Variables de estado de calibración (patrón del usuario)
  private trainingData: TrainingPoint[] = [];
  private isCalibrated = false;
  private regressionModel: RegressionModel | null = null;

  private gazeListeners: Set<GazeCallback> = new Set();

  onCameraReady: (() => void) | null = null;
  onCameraError: (() => void) | null = null;

  async init() {
    try {
      const resolver = await FilesetResolver.forVisionTasks(WASM_PATH);
      this.landmarker = await FaceLandmarker.createFromOptions(resolver, {
        baseOptions: { modelAssetPath: MODEL_URL, delegate: 'GPU' },
        runningMode:           'VIDEO',
        numFaces:              1,
        outputFaceBlendshapes: true,
        outputFacialTransformationMatrixes: false,
      });
    } catch (err) {
      console.warn('GazeTracker: init failed', err);
    }
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
      v.setAttribute('playsinline', '');
      v.setAttribute('autoplay', '');
      v.muted = true;
      v.style.cssText = 'position:fixed;top:0;left:0;width:1px;height:1px;opacity:0;pointer-events:none;z-index:-1';
      document.body.appendChild(v);
    }
    return v;
  }

  startDetection() {
    // Detener siempre el loop anterior antes de iniciar uno nuevo.
    // Sin esto, dos loops concurrentes intercalarían timestamps causando
    // "Packet timestamp mismatch" en MediaPipe.
    this.stopDetection();

    if (!this.landmarker || !this.video) return;

    const loop = (rafTs: number) => {
      if (!this.video || this.video.readyState < 2) {
        this.rafId = requestAnimationFrame(loop);
        return;
      }

      // Solo procesar cuando el video avanzó a un nuevo frame
      if (this.video.currentTime !== this.lastVideoTime) {
        this.lastVideoTime = this.video.currentTime;

        // Timestamp estrictamente creciente: si rAF retrocede (tab inactiva, etc.)
        // avanzamos manualmente 1ms para que MediaPipe no rechace el frame.
        const mpTs = Math.max(rafTs, this.lastMpTs + 0.1);
        this.lastMpTs = mpTs;

        try {
          const results = this.landmarker!.detectForVideo(this.video!, mpTs);
          const cats = results.faceBlendshapes?.[0]?.categories;

          if (cats) {
            // Actualizar currentResults — recordCalibrationPoint lo lee desde aquí
            this.currentResults = { categories: cats };

            const find = (name: string) => cats.find(s => s.categoryName === name)?.score ?? 0;
            const eyeX =  find('eyeLookOutLeft') - find('eyeLookInLeft');
            const eyeY =  find('eyeLookUpLeft')  - find('eyeLookDownLeft');

            const { rawX, rawY } = updateGazePoint(eyeX, eyeY, this.regressionModel);
            this.smoothX = ALPHA * rawX + (1 - ALPHA) * this.smoothX;
            this.smoothY = ALPHA * rawY + (1 - ALPHA) * this.smoothY;

            const gx = Math.max(0, Math.min(window.innerWidth,  this.smoothX));
            const gy = Math.max(0, Math.min(window.innerHeight, this.smoothY));
            this.gazeListeners.forEach(cb => cb(gx, gy));
          }
        } catch (_) {}
      }

      this.rafId = requestAnimationFrame(loop);
    };

    this.rafId = requestAnimationFrame(loop);
  }

  stopDetection() {
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
      this.rafId = 0;
    }
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
  }

  // Captura de datos durante la calibración — patrón del usuario
  recordCalibrationPoint(screenX: number, screenY: number) {
    // Lee currentResults (el último frame detectado) — nunca rellamamos detectForVideo
    const shapes = this.currentResults?.categories;
    if (!shapes) return;

    const find = (name: string) => shapes.find(s => s.categoryName === name)?.score ?? 0;
    const eyeX = find('eyeLookOutLeft') - find('eyeLookInLeft');
    const eyeY = find('eyeLookUpLeft')  - find('eyeLookDownLeft');

    this.trainingData.push({ eyeX, eyeY, screenX, screenY });

    if (this.trainingData.length >= 27) { // 9 puntos × 3 clics mínimo
      this.calculateCalibration();
    }
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
    this.trainingData   = [];
    this.isCalibrated   = false;
    this.regressionModel = null;
    this.currentResults  = null;
    this.lastVideoTime   = -1;
    this.lastMpTs        = 0;
  }

  addGazeListener(cb: GazeCallback)    { this.gazeListeners.add(cb); }
  removeGazeListener(cb: GazeCallback) { this.gazeListeners.delete(cb); }

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

  // Calibrando → abrir cámara, arrancar detección
  useEffect(() => {
    if (!isCalibrating) return;
    gazeTracker.clearCalibration();
    (async () => {
      if (!gazeTracker.hasFaceModel) await gazeTracker.init();
      await gazeTracker.startCamera();
      gazeTracker.startDetection();
    })();
  }, [isCalibrating]);

  // Activo → gaze listener + dwell tracking
  useEffect(() => {
    const cursor = document.getElementById('gaze-cursor');
    if (!isActive) {
      if (cursor) cursor.style.display = 'none';
      gazeTracker.stopDetection();
      return;
    }
    if (cursor) cursor.style.display = 'block';

    // startDetection llama stopDetection() internamente — sin loops dobles
    gazeTracker.startDetection();

    let targetEl: HTMLElement | null = null;
    let enterTime = 0;
    let cooldown  = false;

    const onGaze = (x: number, y: number) => {
      const c = document.getElementById('gaze-cursor');
      if (c) c.style.transform = `translate(calc(${x}px - 50%), calc(${y}px - 50%)) rotate(45deg)`;

      if (c) c.style.visibility = 'hidden';
      const hit = document.elementFromPoint(x, y) as HTMLElement | null;
      if (c) c.style.visibility = '';

      const target = hit?.closest('[data-gaze-target="true"]') as HTMLElement | null;
      const now    = performance.now();

      if (target) {
        if (target !== targetEl) {
          if (targetEl) resetProgress(targetEl);
          targetEl  = target;
          enterTime = now;
          cooldown  = false;
        } else if (!cooldown) {
          const progress = Math.min((now - enterTime) / DWELL_MS, 1);
          updateProgress(target, progress);
          if (progress >= 1) {
            target.click();
            resetProgress(target);
            cooldown = true;
            target.style.transform = 'scale(0.95)';
            setTimeout(() => { target.style.transform = ''; }, 150);
          }
        }
      } else if (targetEl) {
        resetProgress(targetEl);
        targetEl = null;
      }
    };

    gazeTracker.addGazeListener(onGaze);
    return () => {
      gazeTracker.removeGazeListener(onGaze);
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
