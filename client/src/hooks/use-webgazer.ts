import { useEffect } from 'react';
import { create } from 'zustand';
import { FaceLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';
import { GAZE_PROFILES, DEFAULT_PROFILE_ID, type GazeProfile } from '@/config/gazeProfiles';

// ─── MediaPipe ───────────────────────────────────────────────────────────────
const WASM_PATH = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.32/wasm';
const MODEL_URL = 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task';

const DWELL_MS        = 3000;
const SMOOTH_SAMPLES  = 10;   // media móvil de N muestras
const BLINK_THRESHOLD = 0.85;
const BLINK_COOLDOWN  = 1200;

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

  // ── Media móvil de 10 muestras (sin temblor entre dispositivos)
  private smoothHistory: Array<{ x: number; y: number }> = [];

  private currentResults: DetectionCache = null;

  // calibración rápida (punto central)
  private trainingData:    TrainingPoint[]    = [];
  private isCalibrated     = false;
  private regressionModel: RegressionModel | null = null;

  // aprendizaje continuo (clics de uso real)
  private continuousData: TrainingPoint[] = [];

  // parpadeo
  private wasBlinking     = false;
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

            // ── Media móvil de SMOOTH_SAMPLES muestras ────────────────────
            this.smoothHistory.push({ x: rawX, y: rawY });
            if (this.smoothHistory.length > SMOOTH_SAMPLES) this.smoothHistory.shift();
            const n   = this.smoothHistory.length;
            const sum = this.smoothHistory.reduce((a, b) => ({ x: a.x + b.x, y: a.y + b.y }), { x: 0, y: 0 });
            const gx  = Math.max(0, Math.min(window.innerWidth,  sum.x / n));
            const gy  = Math.max(0, Math.min(window.innerHeight, sum.y / n));

            this.gazeListeners.forEach(cb => cb(gx, gy));

            // Parpadeo deliberado (ambos ojos)
            const blinkL  = find('eyeBlinkLeft');
            const blinkR  = find('eyeBlinkRight');
            const isBlink = blinkL > BLINK_THRESHOLD && blinkR > BLINK_THRESHOLD;

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
    this.smoothHistory  = [];
    this.currentResults = null;
    this.wasBlinking    = false;
    this.blinkOnCooldown = false;
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
    this.smoothHistory   = [];
    this.wasBlinking     = false;
    this.blinkOnCooldown = false;
  }

  getModel(): (RegressionModel & { calibrated: boolean }) | null {
    if (!this.regressionModel) return null;
    return { ...this.regressionModel, calibrated: this.isCalibrated };
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

  useEffect(() => {
    if (!document.getElementById('gaze-cursor')) {
      const el = document.createElement('div');
      el.id = 'gaze-cursor';
      document.body.appendChild(el);
    }
    return () => { document.getElementById('gaze-cursor')?.remove(); };
  }, []);

  // Calibrando → cámara + detección
  useEffect(() => {
    if (!isCalibrating) return;
    gazeTracker.clearCalibration();
    (async () => {
      if (!gazeTracker.hasFaceModel) await gazeTracker.init();
      await gazeTracker.startCamera();
      gazeTracker.startDetection();
    })();
  }, [isCalibrating]);

  // Activo → dwell + parpadeo + aprendizaje continuo
  useEffect(() => {
    const cursor = document.getElementById('gaze-cursor');
    if (!isActive) {
      if (cursor) cursor.style.display = 'none';
      gazeTracker.stopDetection();
      return;
    }
    if (cursor) cursor.style.display = 'block';

    // Asegurar que la cámara y el modelo están listos (puede haber sido
    // detenida al volver del flujo de sincronización inicial)
    (async () => {
      if (!gazeTracker.hasFaceModel) await gazeTracker.init();
      if (!gazeTracker.hasCamera)    await gazeTracker.startCamera();
      gazeTracker.startDetection();
    })();

    let targetEl:     HTMLElement | null = null;
    let enterTime     = 0;
    let dwellCooldown = false;

    function activateTarget(el: HTMLElement) {
      // Aprendizaje continuo: registra la posición del botón
      const rect = el.getBoundingClientRect();
      const cx   = rect.left + rect.width  / 2;
      const cy   = rect.top  + rect.height / 2;
      gazeTracker.recordClickCalibration(cx, cy);

      el.click();
      resetProgress(el);
      el.style.transform = 'scale(0.95)';
      setTimeout(() => { el.style.transform = ''; }, 150);
    }

    function hitTest(x: number, y: number): HTMLElement | null {
      if (cursor) cursor.style.visibility = 'hidden';
      const hit = document.elementFromPoint(x, y) as HTMLElement | null;
      if (cursor) cursor.style.visibility = '';
      return hit?.closest('[data-gaze-target="true"]') as HTMLElement | null;
    }

    const onGaze = (x: number, y: number) => {
      if (cursor) cursor.style.transform =
        `translate(calc(${x}px - 50%), calc(${y}px - 50%)) rotate(45deg)`;

      const target = hitTest(x, y);
      const now    = performance.now();

      if (target) {
        if (target !== targetEl) {
          if (targetEl) resetProgress(targetEl);
          targetEl      = target;
          enterTime     = now;
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

    const onBlink = (x: number, y: number) => {
      if (cursor) {
        cursor.classList.add('gaze-blink-flash');
        setTimeout(() => cursor.classList.remove('gaze-blink-flash'), 350);
      }
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
