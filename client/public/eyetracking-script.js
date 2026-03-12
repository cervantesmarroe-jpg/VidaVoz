// ─── EyeTracking Clínico Pro — script.js ────────────────────────────────────
// MediaPipe FaceLandmarker · trainingData calibration · blendshapes
// ────────────────────────────────────────────────────────────────────────────

import { FaceLandmarker, FilesetResolver, DrawingUtils }
  from 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.32/vision_bundle.mjs';

// ─── DOM ─────────────────────────────────────────────────────────────────────
const video         = document.getElementById('webcam');
const canvas        = document.getElementById('output_canvas');
const gazeDot       = document.getElementById('gaze-dot');
const statusEl      = document.getElementById('status');
const btnStart      = document.getElementById('btn-start');
const screenStart   = document.getElementById('screen-start');
const screenCalib   = document.getElementById('screen-calibration');
const btnStartTrack = document.getElementById('btn-start-tracking');
const dataPanel     = document.getElementById('data-panel');
const valX          = document.getElementById('val-x');
const valY          = document.getElementById('val-y');
const valSamples    = document.getElementById('val-samples');
const ctx           = canvas.getContext('2d');
const CLICKS_NEEDED = 3;

// ─── Estado global ────────────────────────────────────────────────────────────
let faceLandmarker;
let lastVideoTime = -1;
let calibrationModel = null;

// Suavizado exponencial (EWA) — reduce temblor del punto de mirada
let smoothX = window.innerWidth  / 2;
let smoothY = window.innerHeight / 2;
const ALPHA = 0.22;

// ─── trainingData: almacena los puntos capturados durante la calibración ──────
// Estructura: [{ eyeData: { bx, by }, screenCoords: { x, y } }, ...]
let trainingData = [];

// ─── Caché del EyeData más reciente ──────────────────────────────────────────
// MediaPipe exige timestamps estrictamente crecientes por llamada.
// Para evitar rellamar detectForVideo al hacer clic en calibración
// (lo que causaría "Packet timestamp mismatch"), cacheamos el
// último resultado del bucle de renderizado y lo leemos aquí.
let lastEyeFeatures = null;

// ─── getEyeFeatures(): devuelve el EyeData del frame más reciente (desde caché)
function getEyeFeatures() {
  return lastEyeFeatures;
}

// ─── computeCalibrationModel(): regresión lineal sobre trainingData ───────────
// Ajusta: screenX = ax·bx + cx   y   screenY = ay·by + cy
function computeCalibrationModel() {
  if (trainingData.length < 4) {
    console.warn('No hay suficientes muestras para calibrar.');
    return null;
  }

  const regress = (xs, ys) => {
    const n   = xs.length;
    const xm  = xs.reduce((s, v) => s + v, 0) / n;
    const ym  = ys.reduce((s, v) => s + v, 0) / n;
    const num = xs.reduce((s, x, i) => s + (x - xm) * (ys[i] - ym), 0);
    const den = xs.reduce((s, x) => s + (x - xm) ** 2, 0) || 0.001;
    const a   = num / den;
    const b   = ym - a * xm;
    return { a, b };
  };

  const bxArr = trainingData.map(d => d.eyeData.bx);
  const byArr = trainingData.map(d => d.eyeData.by);
  const sxArr = trainingData.map(d => d.screenCoords.x);
  const syArr = trainingData.map(d => d.screenCoords.y);

  const model = {
    x: regress(bxArr, sxArr),
    y: regress(byArr, syArr),
  };

  console.log(`Modelo calibrado con ${trainingData.length} muestras:`,
    `X → a=${model.x.a.toFixed(1)} b=${model.x.b.toFixed(1)}`,
    `Y → a=${model.y.a.toFixed(1)} b=${model.y.b.toFixed(1)}`);

  return model;
}

// ─── predictGaze(): aplica el modelo calibrado (o la fórmula por defecto) ─────
function predictGaze(eyeData) {
  if (calibrationModel) {
    return {
      rawX: calibrationModel.x.a * eyeData.bx + calibrationModel.x.b,
      rawY: calibrationModel.y.a * eyeData.by + calibrationModel.y.b,
    };
  }
  // Fallback sin calibración
  return {
    rawX: window.innerWidth  / 2 + eyeData.bx * window.innerWidth  * 0.8,
    rawY: window.innerHeight / 2 + eyeData.by * window.innerHeight * 0.8,
  };
}

// ─── 1. Inicializar FaceLandmarker ────────────────────────────────────────────
setStatus('Cargando modelo IA…', 'warn');

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

setStatus('IA Lista. Haz clic en Activar.', 'ok');

// ─── 2. Activar cámara ────────────────────────────────────────────────────────
btnStart.onclick = async () => {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: true });
    video.srcObject = stream;
    await video.play();
    video.addEventListener('loadedmetadata', () => {
      canvas.width  = video.videoWidth;
      canvas.height = video.videoHeight;
    }, { once: true });

    screenStart.classList.add('hidden');
    screenCalib.classList.add('visible');
    setStatus('Calibrando… haga clic en cada punto', 'warn');
  } catch (err) {
    setStatus('Error de cámara: ' + err.message, 'error');
  }
};

// ─── 3. Puntos de calibración: recogen trainingData ───────────────────────────
const clickCounts = {};
let allCalibrated = false;

document.querySelectorAll('.calibration-point').forEach(point => {
  const id = point.dataset.id;
  clickCounts[id] = 0;

  point.addEventListener('click', (e) => {
    // 1. Coordenadas del punto donde se hizo clic
    const rect = e.target.getBoundingClientRect();
    const x    = rect.left + rect.width  / 2;
    const y    = rect.top  + rect.height / 2;

    // 2. Obtenemos lo que la IA ve en ese momento (Blendshapes)
    const currentEyeData = getEyeFeatures();
    if (!currentEyeData) {
      setStatus('Cara no detectada — repita el clic', 'warn');
      return;
    }

    // 3. Guardamos la relación: "Esta posición de ojos = Esta coordenada X,Y"
    trainingData.push({
      eyeData:      currentEyeData,
      screenCoords: { x, y },
    });

    console.log(`Punto calibrado en: ${Math.round(x)}, ${Math.round(y)}. Total muestras: ${trainingData.length}`);

    // Feedback visual: cuenta atrás en el botón → verde cuando completo
    clickCounts[id]++;
    const remaining = Math.max(0, CLICKS_NEEDED - clickCounts[id]);
    if (remaining === 0) {
      e.target.textContent = '✓';
      e.target.classList.add('done');
    } else {
      e.target.textContent = remaining;
    }

    // Comprobar si todos los puntos están calibrados
    const allDone = Object.values(clickCounts).every(c => c >= CLICKS_NEEDED);
    if (allDone && !allCalibrated) {
      allCalibrated = true;
      btnStartTrack.classList.add('visible');
      setStatus(`Calibración completa (${trainingData.length} muestras). Pulse Iniciar.`, 'ok');
    }
  });
});

// ─── 4. Iniciar seguimiento de mirada ─────────────────────────────────────────
btnStartTrack.onclick = () => {
  calibrationModel = computeCalibrationModel();

  screenCalib.classList.remove('visible');
  dataPanel.classList.add('visible');
  gazeDot.style.display = 'block';
  setStatus('Seguimiento de mirada activo', 'ok');

  requestAnimationFrame(renderLoop);
};

// ─── 5. Bucle de renderizado (Detección en tiempo real) ───────────────────────
const drawingUtils = new DrawingUtils(ctx);

function renderLoop(timestampMs) {
  if (video.readyState >= 2 && video.currentTime !== lastVideoTime) {
    lastVideoTime = video.currentTime;

    const results = faceLandmarker.detectForVideo(video, timestampMs);

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (results.faceLandmarks.length > 0) {
      drawingUtils.drawConnectors(results.faceLandmarks[0],
        FaceLandmarker.FACE_LANDMARKS_TESSELATION, { color: '#1e40af22', lineWidth: 1 });
      drawingUtils.drawConnectors(results.faceLandmarks[0],
        FaceLandmarker.FACE_LANDMARKS_LEFT_EYE,   { color: '#60a5fa', lineWidth: 2 });
      drawingUtils.drawConnectors(results.faceLandmarks[0],
        FaceLandmarker.FACE_LANDMARKS_RIGHT_EYE,  { color: '#60a5fa', lineWidth: 2 });
      drawingUtils.drawConnectors(results.faceLandmarks[0],
        FaceLandmarker.FACE_LANDMARKS_LEFT_IRIS,  { color: '#34d399', lineWidth: 2 });
      drawingUtils.drawConnectors(results.faceLandmarks[0],
        FaceLandmarker.FACE_LANDMARKS_RIGHT_IRIS, { color: '#34d399', lineWidth: 2 });
    }

    if (results.faceBlendshapes?.length > 0) {
      const shapes = results.faceBlendshapes[0].categories;
      const find   = (name) => shapes.find(s => s.categoryName === name)?.score ?? 0;

      const inL = find('eyeLookInLeft'), outL = find('eyeLookOutLeft');
      const upL = find('eyeLookUpLeft'), downL = find('eyeLookDownLeft');

      // Actualizar caché — getEyeFeatures() leerá desde aquí
      lastEyeFeatures = {
        eyeLookInLeft:   inL,
        eyeLookOutLeft:  outL,
        eyeLookUpLeft:   upL,
        eyeLookDownLeft: downL,
        bx:  outL - inL,
        by: -(upL - downL),
      };

      const { rawX, rawY } = predictGaze(lastEyeFeatures);

      smoothX = ALPHA * rawX + (1 - ALPHA) * smoothX;
      smoothY = ALPHA * rawY + (1 - ALPHA) * smoothY;

      const posX = Math.max(0, Math.min(window.innerWidth,  smoothX));
      const posY = Math.max(0, Math.min(window.innerHeight, smoothY));

      gazeDot.style.left = `${posX}px`;
      gazeDot.style.top  = `${posY}px`;

      valX.textContent       = Math.round(posX);
      valY.textContent       = Math.round(posY);
      valSamples.textContent = trainingData.length;
    }
  }

  requestAnimationFrame(renderLoop);
}

// ─── Helper ───────────────────────────────────────────────────────────────────
function setStatus(text, cls = '') {
  statusEl.textContent = text;
  statusEl.className   = cls;
}
