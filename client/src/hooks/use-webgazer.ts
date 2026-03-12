import { useEffect } from 'react';
import { create } from 'zustand';
import { FaceLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';

// ─── MediaPipe ───────────────────────────────────────────────────────────────
const WASM_PATH = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.32/wasm';
const MODEL_URL = 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task';

const DWELL_MS = 2000;
const ALPHA    = 0.22;  // suavizado EWA

// ─── Tipos ────────────────────────────────────────────────────────────────────
interface EyeData {
  eyeLookInLeft:   number;
  eyeLookOutLeft:  number;
  eyeLookUpLeft:   number;
  eyeLookDownLeft: number;
  bx: number;   // eyeLookOutLeft - eyeLookInLeft  (horizontal)
  by: number;   // -(eyeLookUpLeft - eyeLookDownLeft) (vertical)
}

interface TrainingPoint {
  eyeData:      EyeData;
  screenCoords: { x: number; y: number };
}

interface CalibrationModel {
  x: { a: number; b: number };  // screenX = a·bx + b
  y: { a: number; b: number };  // screenY = a·by + b
}

type GazeCallback = (x: number, y: number) => void;

// ─── getEyeFeatures: captura blendshapes en el frame actual ──────────────────
function getEyeFeatures(
  landmarker: FaceLandmarker,
  video: HTMLVideoElement,
): EyeData | null {
  if (video.readyState < 2) return null;
  try {
    const results = landmarker.detectForVideo(video, performance.now());
    const shapes  = results.faceBlendshapes?.[0]?.categories;
    if (!shapes) return null;
    const find = (name: string) => shapes.find(s => s.categoryName === name)?.score ?? 0;
    const inL   = find('eyeLookInLeft');
    const outL  = find('eyeLookOutLeft');
    const upL   = find('eyeLookUpLeft');
    const downL = find('eyeLookDownLeft');
    return {
      eyeLookInLeft:   inL,
      eyeLookOutLeft:  outL,
      eyeLookUpLeft:   upL,
      eyeLookDownLeft: downL,
      bx:  outL - inL,
      by: -(upL - downL),
    };
  } catch (_) { return null; }
}

// ─── computeCalibrationModel: regresión lineal sobre trainingData ─────────────
// Ajusta: screenX = ax·bx + cx   y   screenY = ay·by + cy
function computeCalibrationModel(data: TrainingPoint[]): CalibrationModel | null {
  if (data.length < 4) return null;

  const regress = (xs: number[], ys: number[]) => {
    const n   = xs.length;
    const xm  = xs.reduce((s, v) => s + v, 0) / n;
    const ym  = ys.reduce((s, v) => s + v, 0) / n;
    const num = xs.reduce((s, x, i) => s + (x - xm) * (ys[i] - ym), 0);
    const den = xs.reduce((s, x) => s + (x - xm) ** 2, 0) || 0.001;
    const a   = num / den;
    return { a, b: ym - a * xm };
  };

  const bxArr = data.map(d => d.eyeData.bx);
  const byArr = data.map(d => d.eyeData.by);
  const sxArr = data.map(d => d.screenCoords.x);
  const syArr = data.map(d => d.screenCoords.y);

  const model: CalibrationModel = {
    x: regress(bxArr, sxArr),
    y: regress(byArr, syArr),
  };

  console.log(
    `GazeTracker: modelo calibrado con ${data.length} muestras —`,
    `X a=${model.x.a.toFixed(1)} b=${model.x.b.toFixed(1)}`,
    `Y a=${model.y.a.toFixed(1)} b=${model.y.b.toFixed(1)}`,
  );
  return model;
}

// ─── predictGaze: aplica el modelo (o fórmula por defecto si no hay calibración)
function predictGaze(eyeData: EyeData, model: CalibrationModel | null): { rawX: number; rawY: number } {
  if (model) {
    return {
      rawX: model.x.a * eyeData.bx + model.x.b,
      rawY: model.y.a * eyeData.by + model.y.b,
    };
  }
  const W = window.innerWidth, H = window.innerHeight;
  return {
    rawX: W / 2 + eyeData.bx * W * 0.8,
    rawY: H / 2 + eyeData.by * H * 0.8,
  };
}

// ─── GazeTracker (singleton) ─────────────────────────────────────────────────
class GazeTracker {
  private landmarker: FaceLandmarker | null = null;
  private video:      HTMLVideoElement | null = null;
  private stream:     MediaStream | null = null;
  private rafId:      number = 0;
  private lastTime:   number = -1;

  private smoothX = window.innerWidth  / 2;
  private smoothY = window.innerHeight / 2;

  // Caché del último EyeData — evita llamar detectForVideo dos veces en el mismo frame
  private lastEyeData: EyeData | null = null;

  // trainingData: almacena pares (eyeData → screenCoords) durante la calibración
  private trainingData: TrainingPoint[] = [];
  private calibrationModel: CalibrationModel | null = null;

  private gazeListeners: Set<GazeCallback> = new Set();

  onCameraReady: (() => void) | null = null;
  onCameraError: (() => void) | null = null;
  onInit:        (() => void) | null = null;

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
      this.onInit?.();
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
    if (!this.landmarker || !this.video) return;
    const loop = (ts: number) => {
      if (this.video && this.video.readyState >= 2 && this.video.currentTime !== this.lastTime) {
        this.lastTime = this.video.currentTime;
        try {
          const results = this.landmarker!.detectForVideo(this.video!, ts);
          const shapes  = results.faceBlendshapes?.[0]?.categories;
          if (shapes) {
            const find = (name: string) => shapes.find(s => s.categoryName === name)?.score ?? 0;
            const inL = find('eyeLookInLeft'), outL = find('eyeLookOutLeft');
            const upL = find('eyeLookUpLeft'), downL = find('eyeLookDownLeft');
            const eyeData: EyeData = {
              eyeLookInLeft:   inL,
              eyeLookOutLeft:  outL,
              eyeLookUpLeft:   upL,
              eyeLookDownLeft: downL,
              bx:  outL - inL,
              by: -(upL - downL),
            };
            // Actualizar caché — recordCalibrationSample lo leerá desde aquí
            this.lastEyeData = eyeData;

            const { rawX, rawY } = predictGaze(eyeData, this.calibrationModel);
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
    cancelAnimationFrame(this.rafId);
    this.rafId = 0;
  }

  stopCamera() {
    this.stopDetection();
    this.stream?.getTracks().forEach(t => t.stop());
    this.stream = null;
    document.getElementById('gaze-video')?.remove();
    this.video    = null;
    this.lastTime = -1;
    this.smoothX  = window.innerWidth  / 2;
    this.smoothY  = window.innerHeight / 2;
  }

  // Llamar en cada clic de calibración: lee el EyeData cacheado del último frame
  recordCalibrationSample(screenX: number, screenY: number) {
    // 1. Obtenemos lo que la IA vio en el frame más reciente (sin rellamar detectForVideo)
    const currentEyeData = this.lastEyeData;
    if (!currentEyeData) return;

    // 2. Guardamos la relación: "Esta posición de ojos = Esta coordenada X,Y"
    this.trainingData.push({
      eyeData:      currentEyeData,
      screenCoords: { x: screenX, y: screenY },
    });

    console.log(`Punto calibrado en: ${Math.round(screenX)}, ${Math.round(screenY)}. Total muestras: ${this.trainingData.length}`);
  }

  // Calcula el modelo de calibración a partir de todos los trainingData recogidos
  computeCalibration() {
    this.calibrationModel = computeCalibrationModel(this.trainingData);
    this.trainingData     = [];
  }

  clearCalibration() {
    this.trainingData     = [];
    this.calibrationModel = null;
    this.lastEyeData      = null;
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

  useEffect(() => {
    if (!isCalibrating) return;
    gazeTracker.clearCalibration();
    (async () => {
      if (!gazeTracker.hasFaceModel) await gazeTracker.init();
      await gazeTracker.startCamera();
      gazeTracker.startDetection();
    })();
  }, [isCalibrating]);

  useEffect(() => {
    const cursor = document.getElementById('gaze-cursor');
    if (!isActive) {
      if (cursor) cursor.style.display = 'none';
      gazeTracker.stopDetection();
      return;
    }
    if (cursor) cursor.style.display = 'block';
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
