// ─── EyeTracking Clínico Pro — script.js ────────────────────────────────────
// MediaPipe FaceLandmarker · seguimiento de iris sin calibración manual
// Requiere: @mediapipe/tasks-vision (CDN) + acceso a cámara
// ────────────────────────────────────────────────────────────────────────────

import { FaceLandmarker, FilesetResolver, DrawingUtils }
  from 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.32/vision_bundle.mjs';

// ─── Índices MediaPipe 478-puntos ────────────────────────────────────────────
const IRIS = {
  L_CENTER: 468, R_CENTER: 473,
  L_INNER: 133,  L_OUTER: 33,   L_TOP: 159,  L_BOT: 145,
  R_INNER: 362,  R_OUTER: 263,  R_TOP: 386,  R_BOT: 374,
};

// ─── DOM ─────────────────────────────────────────────────────────────────────
const video      = document.getElementById('webcam');
const canvas     = document.getElementById('output_canvas');
const gazeDot    = document.getElementById('gaze-dot');
const statusEl   = document.getElementById('status');
const btnStart   = document.getElementById('btn-start');
const uiOverlay  = document.getElementById('ui-overlay');
const dataPanel  = document.getElementById('data-panel');
const valX       = document.getElementById('val-x');
const valY       = document.getElementById('val-y');
const ctx        = canvas.getContext('2d');

// ─── Estado ──────────────────────────────────────────────────────────────────
let landmarker    = null;
let running       = false;
let lastVideoTime = -1;

// Suavizado exponencial (EWA) — reduce el temblor del punto
let smoothX = window.innerWidth  / 2;
let smoothY = window.innerHeight / 2;
const ALPHA = 0.25; // 0 = sin movimiento, 1 = sin suavizado

// Auto-calibración: promedio de las primeras N lecturas para centrar la mirada
let baseline    = null;
let baseBuffer  = [];
const BASE_N    = 45;   // ~1.5 s a 30 fps
const SCALE_H   = 3.8;  // amplificación horizontal de la desviación del iris
const SCALE_V   = 4.5;  // amplificación vertical

// ─── Helper: actualizar estado ────────────────────────────────────────────────
function setStatus(text, cls = '') {
  statusEl.textContent = text;
  statusEl.className   = cls;
}

// ─── 1. Inicializar FaceLandmarker ────────────────────────────────────────────
setStatus('Cargando modelo IA…', 'warn');

const filesetResolver = await FilesetResolver.forVisionTasks(
  'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.32/wasm'
);

landmarker = await FaceLandmarker.createFromOptions(filesetResolver, {
  baseOptions: {
    modelAssetPath:
      'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task',
    delegate: 'GPU',
  },
  runningMode:                     'VIDEO',
  numFaces:                        1,
  outputFaceBlendshapes:           false,
  outputFacialTransformationMatrixes: false,
});

setStatus('Modelo listo — pulse ACTIVAR CÁMARA', 'ok');

// ─── 2. Activar cámara al pulsar el botón ─────────────────────────────────────
btnStart.addEventListener('click', async () => {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { width: 640, height: 480, facingMode: 'user' },
      audio: false,
    });
    video.srcObject = stream;
    await video.play();

    // Sincronizar tamaño del canvas con el video
    video.addEventListener('loadedmetadata', () => {
      canvas.width  = video.videoWidth;
      canvas.height = video.videoHeight;
    }, { once: true });

    uiOverlay.classList.add('hidden');
    dataPanel.classList.add('visible');
    gazeDot.style.display = 'block';
    setStatus('Cámara activa — calibrando mirada…', 'warn');

    running = true;
    requestAnimationFrame(detect);
  } catch (err) {
    setStatus('Error de cámara: ' + err.message, 'error');
  }
});

// ─── 3. Extraer vector de mirada desde los landmarks ─────────────────────────
// Devuelve [horizRatio, vertRatio] normalizados por el tamaño del ojo.
// Valores típicos: 0.3–0.7 horizontal, 0.2–0.8 vertical.
function getGazeFeature(lm) {
  const li = lm[IRIS.L_CENTER], ri = lm[IRIS.R_CENTER];

  const liIn  = lm[IRIS.L_INNER], liOut = lm[IRIS.L_OUTER];
  const riIn  = lm[IRIS.R_INNER], riOut = lm[IRIS.R_OUTER];
  const liTop = lm[IRIS.L_TOP],   liBot = lm[IRIS.L_BOT];
  const riTop = lm[IRIS.R_TOP],   riBot = lm[IRIS.R_BOT];

  const lhW = Math.abs(liOut.x - liIn.x) || 0.001;
  const rhW = Math.abs(riOut.x - riIn.x) || 0.001;
  const lvH = Math.abs(liBot.y - liTop.y) || 0.001;
  const rvH = Math.abs(riBot.y - riTop.y) || 0.001;

  // Ratio de posición del iris dentro del ojo (0 = extremo interior, 1 = exterior)
  const lh = (li.x - liIn.x) / lhW;
  const rh = (ri.x - riIn.x) / rhW;
  const lv = (li.y - liTop.y) / lvH;
  const rv = (ri.y - riTop.y) / rvH;

  return [(lh + rh) / 2, (lv + rv) / 2];
}

// ─── 4. Bucle de detección ────────────────────────────────────────────────────
const drawingUtils = new DrawingUtils(ctx);

function detect(timestampMs) {
  if (!running) return;

  if (video.readyState >= 2 && video.currentTime !== lastVideoTime) {
    lastVideoTime = video.currentTime;

    const results = landmarker.detectForVideo(video, timestampMs);

    // Limpiar canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (results.faceLandmarks.length > 0) {
      const lm = results.faceLandmarks[0];

      // Dibujar malla facial en el canvas (espejado con el video)
      drawingUtils.drawConnectors(lm, FaceLandmarker.FACE_LANDMARKS_TESSELATION,
        { color: '#1e40af22', lineWidth: 1 });
      drawingUtils.drawConnectors(lm, FaceLandmarker.FACE_LANDMARKS_LEFT_EYE,
        { color: '#60a5fa', lineWidth: 2 });
      drawingUtils.drawConnectors(lm, FaceLandmarker.FACE_LANDMARKS_RIGHT_EYE,
        { color: '#60a5fa', lineWidth: 2 });
      drawingUtils.drawConnectors(lm, FaceLandmarker.FACE_LANDMARKS_LEFT_IRIS,
        { color: '#34d399', lineWidth: 2 });
      drawingUtils.drawConnectors(lm, FaceLandmarker.FACE_LANDMARKS_RIGHT_IRIS,
        { color: '#34d399', lineWidth: 2 });

      // Calcular vector de mirada
      const [gh, gv] = getGazeFeature(lm);

      // Auto-calibración: acumular baseline en las primeras lecturas
      if (baseBuffer.length < BASE_N) {
        baseBuffer.push([gh, gv]);
        if (baseBuffer.length === BASE_N) {
          const avgH = baseBuffer.reduce((s, p) => s + p[0], 0) / BASE_N;
          const avgV = baseBuffer.reduce((s, p) => s + p[1], 0) / BASE_N;
          baseline = [avgH, avgV];
          setStatus('Seguimiento de mirada activo', 'ok');
        }
      }

      if (baseline) {
        const dh = gh - baseline[0];
        const dv = gv - baseline[1];

        // Mapear desviación del iris a coordenadas de pantalla
        // El eje horizontal está espejado respecto a la cámara
        const rawX = window.innerWidth  / 2 - dh * window.innerWidth  * SCALE_H;
        const rawY = window.innerHeight / 2 + dv * window.innerHeight * SCALE_V;

        // Suavizado EWA
        smoothX = ALPHA * rawX + (1 - ALPHA) * smoothX;
        smoothY = ALPHA * rawY + (1 - ALPHA) * smoothY;

        // Mantener dentro de la pantalla
        const gx = Math.max(0, Math.min(window.innerWidth,  smoothX));
        const gy = Math.max(0, Math.min(window.innerHeight, smoothY));

        // Mover el punto de mirada
        gazeDot.style.left = gx + 'px';
        gazeDot.style.top  = gy + 'px';

        // Panel de datos
        valX.textContent = Math.round(gx);
        valY.textContent = Math.round(gy);
      }
    }
  }

  requestAnimationFrame(detect);
}
