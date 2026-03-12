// ─── EyeTracking Clínico Pro — script.js ────────────────────────────────────
// MediaPipe FaceLandmarker · blendshapes de mirada · sin calibración manual
// ────────────────────────────────────────────────────────────────────────────

import { FaceLandmarker, FilesetResolver, DrawingUtils }
  from 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.32/vision_bundle.mjs';

// ─── DOM ─────────────────────────────────────────────────────────────────────
const video    = document.getElementById('webcam');
const canvas   = document.getElementById('output_canvas');
const gazeDot  = document.getElementById('gaze-dot');
const status   = document.getElementById('status');
const btnStart = document.getElementById('btn-start');
const dataPanel = document.getElementById('data-panel');
const valX     = document.getElementById('val-x');
const valY     = document.getElementById('val-y');
const ctx      = canvas.getContext('2d');

// ─── Estado ──────────────────────────────────────────────────────────────────
let faceLandmarker;
let lastVideoTime = -1;

// Suavizado exponencial para reducir temblor del punto
let smoothX = window.innerWidth  / 2;
let smoothY = window.innerHeight / 2;
const ALPHA = 0.22;

// ─── 1. Configurar la IA de Google ───────────────────────────────────────────
status.innerText = 'Cargando modelo IA…';
status.className = 'warn';

const vision = await FilesetResolver.forVisionTasks(
  'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.32/wasm'
);

faceLandmarker = await FaceLandmarker.createFromOptions(vision, {
  baseOptions: {
    modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task',
    delegate: 'GPU',
  },
  runningMode:           'VIDEO',
  numFaces:              1,
  outputFaceBlendshapes: true,
});

status.innerText = 'IA Lista. Haz clic en Activar.';
status.className = 'ok';

// DrawingUtils para dibujar la malla facial en el canvas
const drawingUtils = new DrawingUtils(ctx);

// ─── 2. Activar Cámara ───────────────────────────────────────────────────────
btnStart.onclick = async () => {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: true });
    video.srcObject = stream;
    await video.play();

    video.addEventListener('loadedmetadata', () => {
      canvas.width  = video.videoWidth;
      canvas.height = video.videoHeight;
    }, { once: true });

    btnStart.style.display = 'none';
    dataPanel.classList.add('visible');
    gazeDot.style.display = 'block';
    status.innerText = 'Monitorizando Mirada…';
    status.className = 'ok';

    requestAnimationFrame(renderLoop);
  } catch (err) {
    status.innerText = 'Error de cámara: ' + err.message;
    status.className = 'error';
  }
};

// ─── 3. Bucle de Renderizado (Detección en tiempo real) ──────────────────────
function renderLoop(timestampMs) {
  if (video.currentTime !== lastVideoTime && video.readyState >= 2) {
    lastVideoTime = video.currentTime;

    const results = faceLandmarker.detectForVideo(video, timestampMs);

    // Limpiar canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (results.faceLandmarks.length > 0) {
      // Dibujar malla facial en miniatura (espejada junto con el video)
      drawingUtils.drawConnectors(results.faceLandmarks[0],
        FaceLandmarker.FACE_LANDMARKS_TESSELATION,
        { color: '#1e40af22', lineWidth: 1 });
      drawingUtils.drawConnectors(results.faceLandmarks[0],
        FaceLandmarker.FACE_LANDMARKS_LEFT_EYE,
        { color: '#60a5fa', lineWidth: 2 });
      drawingUtils.drawConnectors(results.faceLandmarks[0],
        FaceLandmarker.FACE_LANDMARKS_RIGHT_EYE,
        { color: '#60a5fa', lineWidth: 2 });
      drawingUtils.drawConnectors(results.faceLandmarks[0],
        FaceLandmarker.FACE_LANDMARKS_LEFT_IRIS,
        { color: '#34d399', lineWidth: 2 });
      drawingUtils.drawConnectors(results.faceLandmarks[0],
        FaceLandmarker.FACE_LANDMARKS_RIGHT_IRIS,
        { color: '#34d399', lineWidth: 2 });
    }

    // ─── Lógica de cálculo de mirada (blendshapes) ────────────────────────
    if (results.faceBlendshapes && results.faceBlendshapes.length > 0) {
      const shapes = results.faceBlendshapes[0].categories;
      const find   = (name) => shapes.find(s => s.categoryName === name)?.score ?? 0;

      // Buscamos cuánto se mueven los ojos hacia los lados y arriba/abajo
      const eyeLookInL   = find('eyeLookInLeft');
      const eyeLookOutL  = find('eyeLookOutLeft');
      const eyeLookUpL   = find('eyeLookUpLeft');
      const eyeLookDownL = find('eyeLookDownLeft');

      // Mapeo a coordenadas de pantalla (0.8 = sensibilidad, ajustable)
      const rawX = window.innerWidth  / 2 + (eyeLookOutL - eyeLookInL)  * (window.innerWidth  * 0.8);
      const rawY = window.innerHeight / 2 - (eyeLookUpL  - eyeLookDownL) * (window.innerHeight * 0.8);

      // Suavizado EWA — reduce el temblor sin perder respuesta
      smoothX = ALPHA * rawX + (1 - ALPHA) * smoothX;
      smoothY = ALPHA * rawY + (1 - ALPHA) * smoothY;

      const posX = Math.max(0, Math.min(window.innerWidth,  smoothX));
      const posY = Math.max(0, Math.min(window.innerHeight, smoothY));

      gazeDot.style.left = `${posX}px`;
      gazeDot.style.top  = `${posY}px`;

      valX.textContent = Math.round(posX);
      valY.textContent = Math.round(posY);
    }
  }

  requestAnimationFrame(renderLoop);
}
