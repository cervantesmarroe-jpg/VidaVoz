import { useEffect } from 'react';
import { create } from 'zustand';
import { FaceLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';

// ─── MediaPipe ───────────────────────────────────────────────────────────────
const WASM_PATH = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.32/wasm';
const MODEL_URL = 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task';

const DWELL_MS  = 2000;

// Sensibilidad: cuántos píxeles de desplazamiento por unidad de blendshape (0-1)
// Ajustable — valores más altos = más rango de movimiento ocular cubre la pantalla
const SCALE_H = 0.8;   // horizontal: multiplica window.innerWidth
const SCALE_V = 0.8;   // vertical:   multiplica window.innerHeight

// Suavizado exponencial (0 = sin movimiento, 1 = sin suavizado)
const ALPHA = 0.22;

// ─── Gaze desde blendshapes ──────────────────────────────────────────────────
// Devuelve la posición de pantalla estimada a partir de cuánto se mueven los ojos.
// eyeLookOutLeft / eyeLookInLeft → movimiento horizontal
// eyeLookUpLeft  / eyeLookDownLeft → movimiento vertical
// Sin calibración: el "centro" es cuando todos los scores son ≈ 0 (mirada al frente).
type Blendshape = { categoryName: string; score: number };

function gazeFromBlendshapes(
  shapes: Blendshape[],
  offsetX = 0,
  offsetY = 0,
): { x: number; y: number } | null {
  const find = (name: string) => shapes.find(s => s.categoryName === name)?.score ?? 0;

  const bx =  (find('eyeLookOutLeft') - find('eyeLookInLeft'));
  const by = -(find('eyeLookUpLeft')  - find('eyeLookDownLeft'));

  const W = window.innerWidth;
  const H = window.innerHeight;

  return {
    x: W / 2 + bx * W * SCALE_H + offsetX,
    y: H / 2 + by * H * SCALE_V + offsetY,
  };
}

// ─── GazeTracker (singleton) ─────────────────────────────────────────────────
type GazeCallback = (x: number, y: number) => void;

class GazeTracker {
  private landmarker:    FaceLandmarker | null = null;
  private video:         HTMLVideoElement | null = null;
  private stream:        MediaStream | null = null;
  private rafId:         number = 0;
  private lastTime:      number = -1;

  // Suavizado
  private smoothX = window.innerWidth  / 2;
  private smoothY = window.innerHeight / 2;

  // Calibración: offset de pantalla para centrar el punto de mirada
  private offsetX = 0;
  private offsetY = 0;

  // Muestras de calibración: blendshape_gaze → screen_target
  private calibSamples: { rawX: number; rawY: number; sx: number; sy: number }[] = [];
  private calibrated = false;

  private gazeListeners: Set<GazeCallback> = new Set();

  // Callbacks de estado
  onCameraReady: (() => void) | null = null;
  onCameraError: (() => void) | null = null;
  onInit:        (() => void) | null = null;

  async init() {
    try {
      const filesetResolver = await FilesetResolver.forVisionTasks(WASM_PATH);
      this.landmarker = await FaceLandmarker.createFromOptions(filesetResolver, {
        baseOptions: { modelAssetPath: MODEL_URL, delegate: 'GPU' },
        runningMode:          'VIDEO',
        numFaces:             1,
        outputFaceBlendshapes: true,
        outputFacialTransformationMatrixes: false,
      });
      this.onInit?.();
    } catch (err) {
      console.warn('GazeTracker: FaceLandmarker init failed', err);
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
      v.setAttribute('autoplay',   '');
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
          const res = this.landmarker!.detectForVideo(this.video!, ts);
          const shapes = res.faceBlendshapes?.[0]?.categories;
          if (shapes) {
            const pos = gazeFromBlendshapes(shapes, this.offsetX, this.offsetY);
            if (pos) {
              // Suavizado EWA
              this.smoothX = ALPHA * pos.x + (1 - ALPHA) * this.smoothX;
              this.smoothY = ALPHA * pos.y + (1 - ALPHA) * this.smoothY;
              const gx = Math.max(0, Math.min(window.innerWidth,  this.smoothX));
              const gy = Math.max(0, Math.min(window.innerHeight, this.smoothY));
              this.gazeListeners.forEach(cb => cb(gx, gy));
            }
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
    this.video     = null;
    this.lastTime  = -1;
    this.smoothX   = window.innerWidth  / 2;
    this.smoothY   = window.innerHeight / 2;
  }

  // Llamar durante cada click de calibración con las coordenadas de pantalla del punto
  recordCalibrationSample(screenX: number, screenY: number) {
    if (!this.landmarker || !this.video || this.video.readyState < 2) return;
    try {
      const res    = this.landmarker.detectForVideo(this.video, performance.now());
      const shapes = res.faceBlendshapes?.[0]?.categories;
      if (!shapes) return;
      const pos = gazeFromBlendshapes(shapes, 0, 0);
      if (pos) {
        this.calibSamples.push({ rawX: pos.x, rawY: pos.y, sx: screenX, sy: screenY });
      }
    } catch (_) {}
  }

  // Calcula el offset medio: diferencia entre dónde predijo la mirada vs. dónde era el punto
  computeCalibration() {
    if (this.calibSamples.length === 0) return;
    const meanDx = this.calibSamples.reduce((s, p) => s + (p.sx - p.rawX), 0) / this.calibSamples.length;
    const meanDy = this.calibSamples.reduce((s, p) => s + (p.sy - p.rawY), 0) / this.calibSamples.length;
    this.offsetX    = meanDx;
    this.offsetY    = meanDy;
    this.calibrated = true;
    console.log(`GazeTracker: calibración OK — offset (${Math.round(meanDx)}, ${Math.round(meanDy)}) px`);
    this.calibSamples = [];
  }

  clearCalibration() {
    this.calibSamples = [];
    this.calibrated   = false;
    this.offsetX      = 0;
    this.offsetY      = 0;
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

  // Crear el cursor de mirada una vez
  useEffect(() => {
    if (!document.getElementById('gaze-cursor')) {
      const el = document.createElement('div');
      el.id = 'gaze-cursor';
      document.body.appendChild(el);
    }
    return () => { document.getElementById('gaze-cursor')?.remove(); };
  }, []);

  // Calibrando → abrir cámara e iniciar detección (para recoger muestras)
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
    gazeTracker.startDetection();

    let targetEl:  HTMLElement | null = null;
    let enterTime  = 0;
    let cooldown   = false;

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

  // Ni calibrando ni activo → apagar cámara
  useEffect(() => {
    if (!isCalibrating && !isActive) {
      gazeTracker.stopCamera();
    }
  }, [isCalibrating, isActive]);

  return { isActive, isCalibrating, startCalibration, finishCalibration, deactivate };
}

// ─── Dwell progress helpers ───────────────────────────────────────────────────
function resetProgress(el: HTMLElement) {
  const bar = el.querySelector('.gaze-progress-bar') as HTMLElement | null;
  if (bar) bar.style.width = '0%';
}
function updateProgress(el: HTMLElement, progress: number) {
  const bar = el.querySelector('.gaze-progress-bar') as HTMLElement | null;
  if (bar) bar.style.width = `${progress * 100}%`;
}
