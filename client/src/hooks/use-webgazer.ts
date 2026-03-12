import { useEffect } from 'react';
import { create } from 'zustand';
import { FaceLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';

// ─── MediaPipe constants ────────────────────────────────────────────────────
const WASM_PATH  = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.32/wasm';
const MODEL_URL  = 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task';

// Iris landmark indices in MediaPipe 478-point face mesh
const L_IRIS = 468;   // left  iris center (normalized in video frame)
const R_IRIS = 473;   // right iris center (normalized in video frame)
// Eye corners used for gaze normalization
const L_EYE_INNER = 133;  const L_EYE_OUTER = 33;
const L_EYE_TOP   = 159;  const L_EYE_BOT   = 145;
const R_EYE_INNER = 362;  const R_EYE_OUTER = 263;
const R_EYE_TOP   = 386;  const R_EYE_BOT   = 374;

const DWELL_MS = 2000;

// ─── Gaze feature vector ─────────────────────────────────────────────────────
// Returns [horizRatio, vertRatio] where 0.5/0.5 ≈ looking at centre of face.
// Uses iris position relative to eye corners so it's stable under head translation.
function gazeFeature(lm: { x: number; y: number; z: number }[]): [number, number] | null {
  if (lm.length < 478) return null;
  const li = lm[L_IRIS], ri = lm[R_IRIS];
  const liIn = lm[L_EYE_INNER], liOut = lm[L_EYE_OUTER];
  const riIn = lm[R_EYE_INNER], riOut = lm[R_EYE_OUTER];
  const liTop = lm[L_EYE_TOP],  liBot = lm[L_EYE_BOT];
  const riTop = lm[R_EYE_TOP],  riBot = lm[R_EYE_BOT];

  const lhW = Math.abs(liOut.x - liIn.x) || 0.001;
  const rhW = Math.abs(riOut.x - riIn.x) || 0.001;
  const lvH = Math.abs(liBot.y - liTop.y) || 0.001;
  const rvH = Math.abs(riBot.y - riTop.y) || 0.001;

  const lh = (li.x - liIn.x) / lhW;
  const rh = (ri.x - riIn.x) / rhW;
  const lv = (li.y - liTop.y) / lvH;
  const rv = (ri.y - riTop.y) / rvH;

  return [(lh + rh) / 2, (lv + rv) / 2];
}

// ─── Affine regression calibration ──────────────────────────────────────────
// Finds a 2×3 matrix M such that [sx, sy] ≈ M · [gh, gv, 1]
// using ordinary least squares.
interface CalibSample { gh: number; gv: number; sx: number; sy: number }

function fitAffine(samples: CalibSample[]): number[][] | null {
  const n = samples.length;
  if (n < 4) return null;
  // Build X (n×3) and Y (n×2)
  const X: number[][] = samples.map(s => [s.gh, s.gv, 1]);
  const Yx: number[] = samples.map(s => s.sx);
  const Yy: number[] = samples.map(s => s.sy);

  // Solve normal equations: (X'X) β = X'Y
  const XT = transpose(X);
  const XTX = multiply(XT, X);
  const inv = invert3x3(XTX);
  if (!inv) return null;

  const bx = multiply(inv, reshape(multiply(XT, Yx.map(v => [v]))))
    .flat() as number[];
  const by = multiply(inv, reshape(multiply(XT, Yy.map(v => [v]))))
    .flat() as number[];

  return [bx, by]; // each length 3: [a, b, c] so sx = a*gh + b*gv + c
}

function predictScreen(M: number[][], gh: number, gv: number): [number, number] {
  const [bx, by] = M;
  return [
    bx[0] * gh + bx[1] * gv + bx[2],
    by[0] * gh + by[1] * gv + by[2],
  ];
}

// ─── Matrix helpers (pure JS, tiny 3×3 operations) ──────────────────────────
function transpose(A: number[][]): number[][] {
  return A[0].map((_, c) => A.map(r => r[c]));
}
function multiply(A: number[][], B: number[][]): number[][] {
  return A.map(r => B[0].map((_, c) => r.reduce((s, _, k) => s + r[k] * B[k][c], 0)));
}
function reshape(A: number[][]): number[][] { return A; }
function invert3x3(m: number[][]): number[][] | null {
  const [[a,b,c],[d,e,f],[g,h,i]] = m;
  const det = a*(e*i - f*h) - b*(d*i - f*g) + c*(d*h - e*g);
  if (Math.abs(det) < 1e-10) return null;
  const inv = 1 / det;
  return [
    [(e*i-f*h)*inv, (c*h-b*i)*inv, (b*f-c*e)*inv],
    [(f*g-d*i)*inv, (a*i-c*g)*inv, (c*d-a*f)*inv],
    [(d*h-e*g)*inv, (b*g-a*h)*inv, (a*e-b*d)*inv],
  ];
}

// ─── GazeTracker (singleton) ─────────────────────────────────────────────────
type GazeCallback = (x: number, y: number) => void;

class GazeTracker {
  private landmarker:    FaceLandmarker | null = null;
  private video:         HTMLVideoElement | null = null;
  private stream:        MediaStream | null = null;
  private rafId:         number = 0;
  private lastTime:      number = -1;
  private calibSamples:  CalibSample[] = [];
  private calibMatrix:   number[][] | null = null;
  private gazeListeners: Set<GazeCallback> = new Set();
  private currentFeature: [number, number] | null = null;

  // Status callbacks
  onCameraReady: (() => void) | null = null;
  onCameraError: (() => void) | null = null;
  onInit:        (() => void) | null = null;

  async init() {
    try {
      const filesetResolver = await FilesetResolver.forVisionTasks(WASM_PATH);
      this.landmarker = await FaceLandmarker.createFromOptions(filesetResolver, {
        baseOptions: { modelAssetPath: MODEL_URL, delegate: 'GPU' },
        runningMode: 'VIDEO',
        numFaces: 1,
        outputFaceBlendshapes: false,
        outputFacialTransformationMatrixes: false,
      });
      this.onInit?.();
    } catch (err) {
      console.warn('GazeTracker: FaceLandmarker failed to init', err);
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
          if (res.faceLandmarks.length > 0) {
            const feat = gazeFeature(res.faceLandmarks[0]);
            if (feat) {
              this.currentFeature = feat;
              if (this.calibMatrix) {
                const [sx, sy] = predictScreen(this.calibMatrix, feat[0], feat[1]);
                this.gazeListeners.forEach(cb => cb(sx, sy));
              }
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
    this.video = null;
    this.lastTime = -1;
  }

  // Call this for each calibration point click, passing the screen coords of the point
  recordCalibrationSample(screenX: number, screenY: number) {
    if (!this.currentFeature) return;
    const [gh, gv] = this.currentFeature;
    this.calibSamples.push({ gh, gv, sx: screenX, sy: screenY });
  }

  computeCalibration() {
    const M = fitAffine(this.calibSamples);
    if (M) {
      this.calibMatrix = M;
      console.log('GazeTracker: calibration computed from', this.calibSamples.length, 'samples');
    } else {
      console.warn('GazeTracker: calibration failed (not enough samples?)');
    }
    this.calibSamples = [];
  }

  clearCalibration() {
    this.calibSamples = [];
    this.calibMatrix = null;
    this.currentFeature = null;
  }

  addGazeListener(cb: GazeCallback) { this.gazeListeners.add(cb); }
  removeGazeListener(cb: GazeCallback) { this.gazeListeners.delete(cb); }

  get hasFaceModel() { return this.landmarker !== null; }
  get hasCamera()    { return this.video !== null && (this.video.readyState ?? 0) >= 2; }
}

export const gazeTracker = new GazeTracker();

// ─── Zustand store (same public API as before) ───────────────────────────────
interface WebGazerState {
  isActive:       boolean;
  isCalibrating:  boolean;
  startCalibration:  () => void;
  finishCalibration: () => void;
  deactivate:        () => void;
}

export const useWebGazerStore = create<WebGazerState>((set) => ({
  isActive:      false,
  isCalibrating: false,
  startCalibration:  () => set({ isCalibrating: true,  isActive: false }),
  finishCalibration: () => set({ isCalibrating: false, isActive: true }),
  deactivate:        () => set({ isActive: false, isCalibrating: false }),
}));

// ─── React hook ──────────────────────────────────────────────────────────────
export function useWebGazer() {
  const { isActive, isCalibrating, startCalibration, finishCalibration, deactivate } =
    useWebGazerStore();

  // Create gaze cursor element once
  useEffect(() => {
    if (!document.getElementById('gaze-cursor')) {
      const el = document.createElement('div');
      el.id = 'gaze-cursor';
      document.body.appendChild(el);
    }
    return () => { document.getElementById('gaze-cursor')?.remove(); };
  }, []);

  // Lifecycle: calibrating → camera on, detection running (for feature collection)
  useEffect(() => {
    if (!isCalibrating) return;
    gazeTracker.clearCalibration();

    (async () => {
      if (!gazeTracker.hasFaceModel) await gazeTracker.init();
      await gazeTracker.startCamera();
      gazeTracker.startDetection();
    })();
  }, [isCalibrating]);

  // Lifecycle: active → gaze listener attached + dwell tracking
  useEffect(() => {
    const cursor = document.getElementById('gaze-cursor');
    if (!isActive) {
      if (cursor) cursor.style.display = 'none';
      gazeTracker.stopDetection();
      return;
    }
    if (cursor) cursor.style.display = 'block';

    // Make sure detection is still running (it might have been stopped)
    gazeTracker.startDetection();

    let targetEl: HTMLElement | null = null;
    let enterTime = 0;
    let cooldown  = false;

    const onGaze = (x: number, y: number) => {
      // Move cursor
      const c = document.getElementById('gaze-cursor');
      if (c) c.style.transform = `translate(calc(${x}px - 50%), calc(${y}px - 50%)) rotate(45deg)`;

      // Hit-test
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

  // Deactivate: stop camera/detection when neither calibrating nor active
  useEffect(() => {
    if (!isCalibrating && !isActive) {
      gazeTracker.stopCamera();
    }
  }, [isCalibrating, isActive]);

  return { isActive, isCalibrating, startCalibration, finishCalibration, deactivate };
}

// ─── Dwell progress helpers ──────────────────────────────────────────────────
function resetProgress(el: HTMLElement) {
  const bar = el.querySelector('.gaze-progress-bar') as HTMLElement | null;
  if (bar) bar.style.width = '0%';
}
function updateProgress(el: HTMLElement, progress: number) {
  const bar = el.querySelector('.gaze-progress-bar') as HTMLElement | null;
  if (bar) bar.style.width = `${progress * 100}%`;
}
