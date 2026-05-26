import { useEffect } from 'react';
import { moveGlobalCursor, flashGlobalCursor, setGazePriority, setCursorBlinkSuccess, isTouchLocked, setGazeTargetTouchCallback } from '@/lib/globalCursor';
import { create } from 'zustand';
import { FaceLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';
import { GAZE_PROFILES, DEFAULT_PROFILE_ID, type GazeProfile } from '@/config/gazeProfiles';
// Librería de coeficientes de calibración del eye-tracker.
//   El modo UI (tablet/mobile) es independiente del modelo de calibración:
//   el tracker arranca SIEMPRE con un modelo de esta librería (fallback al
//   primero), y la pantalla de bienvenida lo refina más tarde con
//   selectBestModel + applyCalibrationModel sobre el array completo.
//   Los placeholders model:{...} de gazeProfiles.ts no se usan ya como
//   coeficientes — solo sirven como ADN histórico de referencia.
import calibrationsLibraryRaw from '../../calibrations_library.json';
export interface CalibrationLibraryEntry {
  id: string;
  profile: string;          // 'mobile' | 'tablet' — informativo, NO se filtra
  score: number;
  model: {
    alphaX: number; betaX: number;
    alphaY: number; betaY: number;
    sensitivityX?: number; sensitivityY?: number;
  };
}
export const CALIBRATIONS_LIBRARY = calibrationsLibraryRaw as CalibrationLibraryEntry[];

// ─── MediaPipe ───────────────────────────────────────────────────────────────
const WASM_PATH = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.32/wasm';
const MODEL_URL = 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task';

const DWELL_MS        = 2100;  // Fallback del tracker: 100 ms por encima del dwell de pantalla (2000 ms)
                               // para garantizar que el handler local gane la carrera y evitar doble activación.
const SMOOTH_SAMPLES  = 30;    // tamaño fijo del ring-buffer MA
const SMOOTH_WARMUP   = 15;    // no emite hasta tener al menos estas muestras (sin saltos al arranque)
const BLINK_THRESHOLD = 0.85;
const BLINK_COOLDOWN  = 1200;  // periodo refractario entre blink-clicks (ms)
const BLINK_MIN_MS    = 200;   // parpadeo mínimo válido (ms) — ignora involuntarios
const BLINK_MAX_MS    = 500;   // parpadeo máximo válido (ms) — ignora sueño/mirada perdida

// ── Suavizado agresivo ────────────────────────────────────────────────────────
const SNAP_RADIUS_PX  = 58;    // imán: si el cursor está a <58 px de un botón, salta al centro (+15% área)
const DEAD_ZONE_PX    = 10;    // zona muerta: ignora movimientos < 10 px (anti-temblor)

// ── Edge expansion (corrección no-lineal anti-compresión hacia el centro) ───
// El modelo lineal αX·eyeX + βX comprime los extremos por la curvatura natural
// del ojo y la geometría de la cámara frontal: el gaze no llega bien a bordes
// y esquinas, queda "atrapado" hacia el centro. Aplicamos una amplificación
// CUADRÁTICA en coordenadas normalizadas (-1..+1):
//
//   factor = 1 + EDGE_BOOST · n²
//
// → en el centro (n=0) el factor es 1 → precisión central INTACTA
// → en el borde (|n|=1) el factor es 1+EDGE_BOOST → alcance pleno
// → la curva es suave (sin saltos), por lo que el smoothing y el dead zone
//   anteriores siguen funcionando bien y no se introduce jitter.
const EDGE_BOOST_X    = 0.28;  // 28% extra al alcanzar el borde horizontal
const EDGE_BOOST_Y    = 0.22;  // 22% extra al alcanzar el borde vertical (más conservador)

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

// ── Autoajuste silencioso (2 fases, complementario al perfil maestro) ────────
// Fase 1: durante el splash de bienvenida, recoge muestras del centro y corrige
// el offset alpha sin que el paciente haga nada explícito.
// Fase 2: durante el uso real, cada activación exitosa refina alpha con una
// media exponencial (LEARNING_RATE) si el error es pequeño (<MAX_ERROR_PX).
const SILENT_MIN_SAMPLES        = 5;     // mínimo para aplicar la corrección
const PHASE2_LEARNING_RATE      = 0.25;  // EMA por activación
const PHASE2_MAX_ERROR_PX       = 80;    // descarta correcciones grandes (target erróneo)
const PHASE2_STABILIZATION_MS   = 2000;  // ignora correcciones en los 1ºs 2 s

// ── Escalado dinámico de beta tras elegir modelo ────────────────────────────
// Tras seleccionar el modelo de la librería, los betas vienen optimizados para
// el ojo de OTRO usuario. Para que el cursor cubra toda la pantalla con el ojo
// del paciente actual, escalamos beta proporcionalmente al rango real de la
// señal ocular medida durante la pantalla de bienvenida frente al rango típico
// esperado (≈0.20 en datos de calibración históricos). Solo se aplica si hay
// varianza suficiente — si el paciente miró fijo al centro, se deja el beta
// del modelo sin tocar para no introducir ruido.
const BETA_SCALE_EXPECTED_RANGE_X = 0.20;
const BETA_SCALE_EXPECTED_RANGE_Y = 0.20;
const BETA_SCALE_MIN_VARIANCE     = 0.05; // si rango < esto → no escalar
const BETA_SCALE_MIN              = 0.5;  // recorte inferior (anti-shrink)
const BETA_SCALE_MAX              = 2.5;  // recorte superior (anti-blow-up)

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

// Sonido de blink-click desactivado — feedback solo visual (cursor verde)
function playPopSound() { /* silenciado */ }

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

  // ── Autoajuste silencioso (Fase 1 + Fase 2) ─────────────────────────────────
  private silentSamples: Array<{ eyeX: number; eyeY: number }> = [];
  private sessionStartTime = 0;

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

            // ── Etapa 3.5: Edge Expansion — corrige compresión hacia el centro ──
            // Trabajamos en coordenadas normalizadas centradas (-1..+1) para ser
            // independientes de resolución y orientación. Factor cuadrático: 1
            // en el centro (precisión intacta), 1+EDGE_BOOST en el borde.
            // Aplicado DESPUÉS del smoothing y del dead zone para que la
            // amplificación no genere oscilaciones en reposo.
            const cxN = window.innerWidth  / 2;
            const cyN = window.innerHeight / 2;
            const nx  = (outX - cxN) / cxN;
            const ny  = (outY - cyN) / cyN;
            const exN = nx * (1 + EDGE_BOOST_X * nx * nx);
            const eyN = ny * (1 + EDGE_BOOST_Y * ny * ny);
            outX = cxN + Math.max(-1, Math.min(1, exN)) * cxN;
            outY = cyN + Math.max(-1, Math.min(1, eyN)) * cyN;

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

  // ── Carga un Perfil de UI y arranca con un modelo de calibración ──────────
  // Separación explícita de DOS conceptos independientes:
  //
  //   1) Modo UI (tablet | mobile) — viene del perfil seleccionado por el
  //      cuidador. Solo afecta al diseño/layout y a metadatos de diagnóstico
  //      (label, distanceCm). Se guarda en this.activeProfile y queda
  //      accesible vía currentProfile / getDebugInfo.
  //
  //   2) Coeficientes de calibración del tracker (alpha/beta + sensibilidades)
  //      — vienen SIEMPRE de calibrations_library.json, NUNCA del placeholder
  //      profile.model. En el arranque se usa la primera entrada de la
  //      librería como fallback (la mejor por score). La pantalla de
  //      bienvenida volverá a llamar a applyCalibrationModel con el ganador
  //      real para este paciente cuando termine sus 2 s de muestreo.
  //
  // Si la librería estuviese vacía (situación anómala), el tracker queda en
  // espera (regressionModel = null) en lugar de caer al placeholder del UI.
  loadProfile(profile: GazeProfile) {
    this.activeProfile  = profile;
    // Limpiar siempre datos del perfil anterior (evita mezclar ADNs)
    this.trainingData   = [];
    this.continuousData = [];

    const fallback = CALIBRATIONS_LIBRARY[0];
    if (fallback) {
      this.regressionModel = {
        alphaX: fallback.model.alphaX,
        betaX:  fallback.model.betaX,
        alphaY: fallback.model.alphaY,
        betaY:  fallback.model.betaY,
      };
      // Las sensibilidades efectivas las decide la librería; si la entrada no
      // las trae, mantenemos las del perfil UI como red de seguridad.
      this.profileSensX = (typeof fallback.model.sensitivityX === 'number')
        ? fallback.model.sensitivityX
        : profile.sensitivityX;
      this.profileSensY = (typeof fallback.model.sensitivityY === 'number')
        ? fallback.model.sensitivityY
        : profile.sensitivityY;
      this.isCalibrated = true;
      console.log(
        `%c[GazeTracker]`,
        'color:#7DD3A8;font-weight:800',
        `Modo UI: ${profile.id} | Modelo calibración: ${fallback.id} (score ${fallback.score})`,
      );
    } else {
      // Librería vacía: no caemos al placeholder del UI por diseño.
      this.regressionModel = null;
      this.profileSensX    = profile.sensitivityX;
      this.profileSensY    = profile.sensitivityY;
      this.isCalibrated    = false;
      console.warn(
        `[GazeTracker] Modo UI: ${profile.id} | Sin modelo de calibración (librería vacía) — el tracker queda a la espera`,
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

  // ── Auto-ajuste por toque: nudge suave del offset alfa ───────────────────
  // Cuando el paciente toca un botón con el dedo, esa posición es la que quería
  // seleccionar. Si el modelo maestro tiene un offset (alpha) ligeramente errado
  // para este paciente/posición, cada toque lo corrige un 8% hacia el valor real.
  // Los beta (pendientes) no se tocan — vienen del ADN de fábrica y son precisos.
  nudgeAlphaFromTouch(screenX: number, screenY: number) {
    if (!this.regressionModel || !this.currentResults) return;

    const shapes    = this.currentResults.categories;
    const landmarks = this.currentResults.landmarks;
    const find = (name: string) => shapes.find(s => s.categoryName === name)?.score ?? 0;

    const headRotX = landmarks[1].x - landmarks[4].x;
    const eyeX = (find('eyeLookOutLeft') - find('eyeLookInLeft')) + (headRotX * 2);
    const eyeY =  find('eyeLookUpLeft')  - find('eyeLookDownLeft');

    const predictedX = this.regressionModel.alphaX + this.regressionModel.betaX * eyeX;
    const predictedY = this.regressionModel.alphaY + this.regressionModel.betaY * eyeY;

    const NUDGE = 0.08; // 8% del error por toque — acumulativo y suave
    this.regressionModel.alphaX += NUDGE * (screenX - predictedX);
    this.regressionModel.alphaY += NUDGE * (screenY - predictedY);
  }

  // ── FASE 1: Autoajuste silencioso del centro durante el splash ──────────────
  // Recoge una muestra ocular (eyeX/eyeY) si hay rostro detectado. Devuelve
  // true si se obtuvo muestra, false si todavía no hay detección. La fase 1
  // se ejecuta durante la pantalla de bienvenida sin que el paciente lo note.
  collectSilentCenterSample(): boolean {
    const shapes    = this.currentResults?.categories;
    const landmarks = this.currentResults?.landmarks;
    if (!shapes || !landmarks) return false;

    const find = (name: string) => shapes.find(s => s.categoryName === name)?.score ?? 0;
    const headRotX = landmarks[1].x - landmarks[4].x;
    const eyeX = (find('eyeLookOutLeft') - find('eyeLookInLeft')) + (headRotX * 2);
    const eyeY =  find('eyeLookUpLeft')  - find('eyeLookDownLeft');

    this.silentSamples.push({ eyeX, eyeY });
    return true;
  }

  // Aplica la corrección de offset alpha calculada con las muestras del centro.
  // Solo modifica el ajuste de SESIÓN (regressionModel del tracker) — nunca el
  // perfil de fábrica de GAZE_PROFILES. Si no hay modelo cargado o muestras
  // insuficientes, no hace nada y se mantiene el perfil de fábrica intacto.
  //
  // Acepta opcionalmente la info de escala dinámica de beta calculada justo
  // antes (por applyDynamicBetaScaling) para incluirla en la misma línea de
  // log y dar una traza única del autoajuste completo (offset + escala).
  applySilentCenterCalibration(
    scaleInfo?: { scaleX: number; scaleY: number } | null,
  ): boolean {
    const samples = this.silentSamples;
    this.silentSamples = []; // limpia siempre, aunque no apliquemos

    if (!this.regressionModel || samples.length < SILENT_MIN_SAMPLES) {
      console.log(
        `[Fase1] Sin corrección: muestras=${samples.length}/${SILENT_MIN_SAMPLES} modelo=${!!this.regressionModel}`,
      );
      return false;
    }

    const n        = samples.length;
    const meanEyeX = samples.reduce((s, d) => s + d.eyeX, 0) / n;
    const meanEyeY = samples.reduce((s, d) => s + d.eyeY, 0) / n;

    const { alphaX, betaX, alphaY, betaY } = this.regressionModel;
    const predictedX = alphaX + betaX * meanEyeX;
    const predictedY = alphaY + betaY * meanEyeY;

    const cx = window.innerWidth  / 2;
    const cy = window.innerHeight / 2;
    const offsetX = cx - predictedX;
    const offsetY = cy - predictedY;

    this.regressionModel.alphaX += offsetX;
    this.regressionModel.alphaY += offsetY;

    const scaleSuffix =
      scaleInfo === undefined
        ? ''
        : scaleInfo === null
          ? ' | scale=none (varianza insuficiente)'
          : ` | scaleX=${scaleInfo.scaleX.toFixed(2)} | scaleY=${scaleInfo.scaleY.toFixed(2)}`;

    console.log(
      `%c[Fase1] Autoajuste aplicado ✓`,
      'color:#7DD3A8;font-weight:800',
      `| n=${n}`,
      `| offset=(${offsetX.toFixed(1)}, ${offsetY.toFixed(1)})px${scaleSuffix}`,
    );
    return true;
  }

  // ── Escalado dinámico de beta tras applyCalibrationModel ──────────────────
  // Recibe el snapshot de muestras oculares de la pantalla de bienvenida y
  // calcula un factor de escala para betaX y betaY basado en la dispersión
  // real de la señal del paciente actual frente al rango típico esperado.
  //
  // La idea es que el modelo elegido por selectBestModel acierta la DIRECCIÓN
  // (alpha) pero su ESCALA (beta) viene optimizada para el ojo de otro usuario
  // — y por eso el cursor podría no llegar a los bordes de pantalla. Con este
  // ajuste ampliamos o reducimos beta para que el rango ocular del paciente
  // mapee al rango completo del viewport.
  //
  // Devuelve los factores de escala aplicados (recortados a [0.5, 2.5]) o null
  // si no había varianza suficiente en las muestras (paciente miró fijo) o si
  // no había modelo cargado. En esos casos beta se queda intacto.
  applyDynamicBetaScaling(
    samples: ReadonlyArray<{ eyeX: number; eyeY: number }>,
  ): { scaleX: number; scaleY: number } | null {
    if (!this.regressionModel || samples.length === 0) return null;

    let minX =  Infinity, maxX = -Infinity;
    let minY =  Infinity, maxY = -Infinity;
    let finiteCount = 0;
    for (const s of samples) {
      // Filtra muestras corruptas (NaN/±Infinity) que podrían venir si la
      // detección de rostro perdiera algún frame durante la bienvenida.
      if (!Number.isFinite(s.eyeX) || !Number.isFinite(s.eyeY)) continue;
      finiteCount++;
      if (s.eyeX < minX) minX = s.eyeX;
      if (s.eyeX > maxX) maxX = s.eyeX;
      if (s.eyeY < minY) minY = s.eyeY;
      if (s.eyeY > maxY) maxY = s.eyeY;
    }
    if (finiteCount === 0) return null;

    const rangeX = maxX - minX;
    const rangeY = maxY - minY;

    if (rangeX <= BETA_SCALE_MIN_VARIANCE || rangeY <= BETA_SCALE_MIN_VARIANCE) {
      return null;
    }

    const rawScaleX = BETA_SCALE_EXPECTED_RANGE_X / rangeX;
    const rawScaleY = BETA_SCALE_EXPECTED_RANGE_Y / rangeY;
    const scaleX    = Math.min(Math.max(rawScaleX, BETA_SCALE_MIN), BETA_SCALE_MAX);
    const scaleY    = Math.min(Math.max(rawScaleY, BETA_SCALE_MIN), BETA_SCALE_MAX);

    this.regressionModel.betaX *= scaleX;
    this.regressionModel.betaY *= scaleY;

    return { scaleX, scaleY };
  }

  // Marca el inicio de la sesión activa (cuando se enciende la mirada).
  // Usado por la Fase 2 para ignorar correcciones durante el periodo de
  // estabilización inicial del tracker.
  markSessionStart() {
    this.sessionStartTime = performance.now();
    this.silentSamples    = [];
  }

  // Descarta las muestras de Fase 1 sin aplicar corrección. Se usa cuando la
  // ventana de muestreo perdió el rostro / ojos cerrados en >50 % del tiempo.
  discardSilentSamples() {
    const n = this.silentSamples.length;
    this.silentSamples = [];
    if (n > 0) console.log(`[Fase1] Muestras descartadas (n=${n}) — rostro inestable`);
  }

  // ── Selección del mejor modelo de calibración (Welcome → librería) ─────────
  // getSilentSamples devuelve un SNAPSHOT inmutable del buffer de muestras
  // recogidas por collectSilentCenterSample, sin consumirlas — para que un
  // selector externo pueda evaluar varios modelos candidatos contra los mismos
  // datos antes de que applySilentCenterCalibration los use y los limpie.
  getSilentSamples(): ReadonlyArray<{ eyeX: number; eyeY: number }> {
    return this.silentSamples.slice();
  }

  // Aplica un modelo de calibración al estado de SESIÓN del tracker.
  // Reemplaza regressionModel y, opcionalmente, las sensibilidades de sesión
  // (profileSensX/Y) si vienen en el modelo. Nunca toca GAZE_PROFILES ni el
  // perfil de fábrica activo: la próxima vez que loadProfile se invoque, el
  // ADN de fábrica se restaura íntegro.
  applyCalibrationModel(m: {
    alphaX: number; betaX: number;
    alphaY: number; betaY: number;
    sensitivityX?: number; sensitivityY?: number;
  }): void {
    this.regressionModel = {
      alphaX: m.alphaX,
      betaX:  m.betaX,
      alphaY: m.alphaY,
      betaY:  m.betaY,
    };
    if (typeof m.sensitivityX === 'number') this.profileSensX = m.sensitivityX;
    if (typeof m.sensitivityY === 'number') this.profileSensY = m.sensitivityY;
  }

  // ── FASE 2: Aprendizaje continuo (EMA) durante el uso real ─────────────────
  // Cada activación exitosa (dwell o blink) refina alpha con una media
  // exponencial. Solo se aplica si el error es pequeño (< 80 px en cada eje)
  // y han pasado al menos 2 s desde el inicio de la sesión.
  learnFromTarget(targetX: number, targetY: number, cursorX: number, cursorY: number) {
    if (!this.regressionModel) return;
    if (performance.now() - this.sessionStartTime < PHASE2_STABILIZATION_MS) return;

    const errorX = targetX - cursorX;
    const errorY = targetY - cursorY;
    if (Math.abs(errorX) > PHASE2_MAX_ERROR_PX || Math.abs(errorY) > PHASE2_MAX_ERROR_PX) return;

    this.regressionModel.alphaX += errorX * PHASE2_LEARNING_RATE;
    this.regressionModel.alphaY += errorY * PHASE2_LEARNING_RATE;
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
      // Marca el inicio de la sesión activa para la Fase 2 (estabilización 2 s).
      gazeTracker.markSessionStart();
    })();

    // ── Anti-barrido visual ───────────────────────────────────────────────────
    // Antes de arrancar el dwell de 3 s, exige una fase corta de estabilización
    // (~400 ms con la mirada quieta dentro de un radio de 40 px). Esto evita
    // activaciones accidentales cuando el paciente recorre la pantalla con la
    // mirada (visual scanning). Si la mirada salta más allá de la tolerancia,
    // se reinicia la estabilización; si sale del botón, se cancela todo.
    const STABILIZATION_MS    = 400;
    const STAB_TOLERANCE_PX_2 = 40 * 40; // cuadrado para evitar sqrt en cada frame

    let targetEl:       HTMLElement | null = null;
    let stabStartTime   = 0;     // inicio de la fase de estabilización
    let stabAnchorX     = 0;
    let stabAnchorY     = 0;
    let dwellStartTime  = 0;     // 0 = aún estabilizando, >0 = dwell activo
    let dwellCooldown   = false;

    // ── Capa de confianza del tracking (anti tracking-incierto) ──────────────
    // Distingue 3 estados con histéresis para evitar parpadeos de UI:
    //   • stable    → todo habilitado, dwell y blink funcionan normal.
    //   • uncertain → 600 ms sin gaze: se PAUSA el dwell (sin resetear) y se
    //                 muestra un banner discreto "Buscando mirada…".
    //   • lost      → 1500 ms sin gaze: banner cambia a "No se detecta mirada".
    // Para volver a stable se exigen 200 ms de gaze continuo (grace), evitando
    // recuperaciones espurias por una sola muestra. Cuando se reanuda, los
    // tiempos de estabilización y dwell se DESPLAZAN hacia adelante por la
    // duración pausada → el progreso visual no salta ni se reinicia.
    const UNCERTAIN_AFTER_MS = 600;
    const LOST_AFTER_MS      = 1500;
    const RECOVERY_GRACE_MS  = 200;

    let confState: 'stable' | 'uncertain' | 'lost' = 'stable';
    let lastGazeTime  = performance.now();
    let recoveryStart = 0;
    let pausedAt      = 0;       // timestamp en que entramos en uncertain/lost

    const banner = document.createElement('div');
    banner.id = 'gaze-status-banner';
    banner.style.cssText = [
      'position:fixed', 'top:18px', 'left:50%', 'transform:translateX(-50%)',
      'background:rgba(40,40,40,0.82)', 'color:#fff',
      'padding:8px 18px', 'border-radius:999px',
      "font-family:'Lexend',sans-serif", 'font-size:0.85rem', 'font-weight:600',
      'letter-spacing:0.02em', 'z-index:99998', 'pointer-events:none',
      'opacity:0', 'transition:opacity 0.4s ease', 'will-change:opacity',
      'box-shadow:0 4px 12px rgba(0,0,0,0.18)',
    ].join(';');
    document.body.appendChild(banner);

    function setBanner(text: string | null) {
      if (text) { banner.textContent = text; banner.style.opacity = '1'; }
      else      { banner.style.opacity = '0'; }
    }

    function pauseProgress() {
      if (pausedAt === 0) pausedAt = performance.now();
    }
    function resumeProgress() {
      if (pausedAt === 0) return;
      const pausedFor = performance.now() - pausedAt;
      if (stabStartTime  > 0) stabStartTime  += pausedFor;
      if (dwellStartTime > 0) dwellStartTime += pausedFor;
      pausedAt = 0;
    }

    const confMonitor = setInterval(() => {
      const idle = performance.now() - lastGazeTime;
      if (idle > LOST_AFTER_MS) {
        if (confState !== 'lost') {
          confState = 'lost'; pauseProgress();
          setBanner('No se detecta mirada');
        }
      } else if (idle > UNCERTAIN_AFTER_MS) {
        if (confState === 'stable') {
          confState = 'uncertain'; pauseProgress();
          setBanner('Buscando mirada…');
        }
      }
    }, 150);
    // touchLockUntil eliminado — ahora lo gestiona globalCursor.ts (isTouchLocked())

    // ── Helpers ──────────────────────────────────────────────────────────────
    // cursorX/Y son las coordenadas crudas del cursor en el momento de activar:
    // se usan para la Fase 2 (aprendizaje EMA del offset alpha).
    function activateTarget(el: HTMLElement, cursorX?: number, cursorY?: number) {
      const rect = el.getBoundingClientRect();
      const tcx  = rect.left + rect.width  / 2;
      const tcy  = rect.top  + rect.height / 2;
      gazeTracker.recordClickCalibration(tcx, tcy);
      if (cursorX !== undefined && cursorY !== undefined) {
        gazeTracker.learnFromTarget(tcx, tcy, cursorX, cursorY);
      }
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
        activateTarget(target, x, y);
      }
    }

    // ── Helpers de hover-aim ──────────────────────────────────────────────────
    // Añade/quita la clase CSS .gaze-hover que ilumina el borde del botón
    // mientras el cursor de mirada está encima, ayudando al paciente a apuntar.
    function setAimGlow(el: HTMLElement | null, on: boolean) {
      if (!el) return;
      if (on) el.classList.add('gaze-hover');
      else    el.classList.remove('gaze-hover');
    }

    // ── MIRADA: gaze cede al toque durante 500 ms (isTouchLocked de globalCursor) ─
    const onGaze = (x: number, y: number) => {
      if (isTouchLocked()) return;
      moveGlobalCursor(x, y);

      const now = performance.now();
      lastGazeTime = now;

      // ── Recuperación con grace period: 200 ms de gaze continuo para volver
      //    a stable. Mientras tanto, no procesamos lógica de interacción.
      if (confState !== 'stable') {
        if (recoveryStart === 0) recoveryStart = now;
        if (now - recoveryStart >= RECOVERY_GRACE_MS) {
          confState = 'stable';
          setBanner(null);
          resumeProgress();
          recoveryStart = 0;
        } else {
          return;
        }
      } else {
        recoveryStart = 0;
      }

      const target = hitTest(x, y);

      if (target) {
        if (target !== targetEl) {
          // ── Cambio de botón: apagar glow del anterior, arrancar fase de
          //    estabilización del nuevo (todavía sin progreso de dwell) ───────
          if (targetEl) { resetProgress(targetEl); setAimGlow(targetEl, false); }
          targetEl = target;
          stabStartTime  = now;
          stabAnchorX    = x;
          stabAnchorY    = y;
          dwellStartTime = 0;
          dwellCooldown  = false;
          setAimGlow(target, true); // glow suave: "te he detectado, mantén la mirada"
        } else if (!dwellCooldown) {
          if (dwellStartTime === 0) {
            // ── Fase 1: estabilización (anti-barrido visual) ────────────────
            const dx = x - stabAnchorX;
            const dy = y - stabAnchorY;
            if (dx * dx + dy * dy > STAB_TOLERANCE_PX_2) {
              // Mirada erráica → reinicia estabilización con nuevo ancla
              stabStartTime = now;
              stabAnchorX   = x;
              stabAnchorY   = y;
            } else if (now - stabStartTime >= STABILIZATION_MS) {
              // Intención confirmada → arranca el dwell real de 3 s
              dwellStartTime = now;
            }
          } else {
            // ── Fase 2: dwell con progreso visual sincronizado ──────────────
            const progress = Math.min((now - dwellStartTime) / DWELL_MS, 1);
            updateProgress(target, progress);
            if (progress >= 1) {
              setAimGlow(target, false);
              activateTarget(target, x, y);
              dwellCooldown = true;
            }
          }
        }
      } else if (targetEl) {
        // ── El cursor salió al vacío: cancela estabilización y dwell ─────────
        resetProgress(targetEl);
        setAimGlow(targetEl, false);
        targetEl       = null;
        dwellStartTime = 0;
      }
    };

    // ── PARPADEO ─────────────────────────────────────────────────────────────
    // Filtros del tracker (ya activos en GazeTracker):
    //   • BLINK_MIN_MS=200 / BLINK_MAX_MS=500 → ignora microparpadeos y cierres
    //     largos por sueño/mirada perdida.
    //   • BLINK_COOLDOWN=1200 → impide doble activación.
    // Filtro adicional aquí (anti-falso positivo intencional): el blink solo
    // activa si el paciente ya confirmó intención sobre un botón — es decir,
    // si superó la fase de estabilización (dwellStartTime > 0) y el blink
    // ocurre sobre el MISMO botón. Un parpadeo natural mientras la mirada
    // recorre la pantalla queda silenciosamente descartado.
    const onBlink = (x: number, y: number) => {
      if (confState !== 'stable') return;                 // tracking dudoso → ignorar
      if (!targetEl || dwellStartTime === 0) return;     // sin intención confirmada
      const onTarget = hitTest(x, y);
      if (onTarget !== targetEl) return;                  // blink fuera del foco
      triggerClick(x, y);                                 // activación inmediata
    };

    // Touch lo maneja globalCursor.ts (siempre activo, passive, sin preventDefault).
    // Aquí solo registramos gaze y blink.
    gazeTracker.addGazeListener(onGaze);
    gazeTracker.addBlinkListener(onBlink);

    // ── Auto-ajuste por toque: mientras la mirada está activa, cada vez que
    // el paciente toca un botón de mirada, aplicamos un nudge alpha suave. ──
    setGazeTargetTouchCallback((cx, cy) => {
      gazeTracker.nudgeAlphaFromTouch(cx, cy);
    });

    return () => {
      setGazePriority(false);
      // Limpiar glow pendiente al desmontar
      setAimGlow(targetEl, false);
      gazeTracker.removeGazeListener(onGaze);
      gazeTracker.removeBlinkListener(onBlink);
      setGazeTargetTouchCallback(null);
      clearInterval(confMonitor);
      banner.remove();
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
// Escriben la variable CSS --gaze-progress (0..1) en el botón apuntado. El
// estilo `.gaze-target::after` (index.css) la consume para pintar el fill
// progresivo + glow inset, sincronizados con DWELL_MS=2000ms. Como fallback
// también actualizan la barra legacy `.gaze-progress-bar` si el componente
// la incluyera manualmente — la inmensa mayoría no la lleva y ya no hace falta.
function resetProgress(el: HTMLElement) {
  el.style.setProperty('--gaze-progress', '0');
  const bar = el.querySelector('.gaze-progress-bar') as HTMLElement | null;
  if (bar) bar.style.width = '0%';
}
function updateProgress(el: HTMLElement, progress: number) {
  el.style.setProperty('--gaze-progress', String(progress));
  const bar = el.querySelector('.gaze-progress-bar') as HTMLElement | null;
  if (bar) bar.style.width = `${progress * 100}%`;
}
