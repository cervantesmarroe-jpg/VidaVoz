// ─── EyeTracking Clínico Pro — script.js ────────────────────────────────────
// MediaPipe FaceLandmarker · regressionModel exacto · blendshapes
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

// ─── Configuraciones para comunicación fluida ─────────────────────────────
const SENSITIVITY     = 1.5;   // ajusta cuánto se mueve el cursor respecto al ojo
const DWELL_TIME      = 3000;  // 3 segundos manteniendo la mirada para activar
const ALPHA           = 0.2;   // filtro paso bajo: 0.8·prev + 0.2·nuevo
const BLINK_THRESHOLD = 0.55;  // umbral parpadeo deliberado (0–1)
const BLINK_COOLDOWN  = 1200;  // ms de bloqueo tras cada parpadeo

// ─── 1. Variables de estado ────────────────────────────────────────────────
let faceLandmarker;
let lastVideoTime  = -1;
let lastMpTs       = 0;   // timestamp mínimo garantizado para MediaPipe

let trainingData = [];
let isCalibrated = false;

// Modelo de regresión — patrón exacto del usuario
let regressionModel = { alphaX: 0, betaX: 0, alphaY: 0, betaY: 0 };

// Suavizado — filtro paso bajo
let smoothX = window.innerWidth  / 2;
let smoothY = window.innerHeight / 2;

// currentResults: caché del último resultado de detectForVideo
// recordCalibrationPoint() lee de aquí — nunca rellamamos detectForVideo
let currentResults = null;

// Estado del parpadeo
let wasBlinking    = false;
let blinkOnCooldown = false;

// ─── 1b. Reset Clínico ────────────────────────────────────────────────────
// Vacía el historial y vuelve a mostrar la pantalla de calibración
function resetCalibration() {
  trainingData = [];
  isCalibrated = false;
  allCalibrated = false;

  // Resetear contadores y aspecto visual de los puntos
  document.querySelectorAll('.calibration-point').forEach(pt => {
    const id = pt.dataset.id;
    clickCounts[id] = 0;
    pt.textContent = CLICKS_NEEDED;
    pt.classList.remove('done');
  });
  btnStartTrack.classList.remove('visible');

  // UI: ocultar puntero y panel, mostrar calibración
  gazeDot.style.display = 'none';
  dataPanel.classList.remove('visible');
  screenCalib.classList.add('visible');

  setStatus('Recalibrando — haga clic en los puntos', 'warn');
  console.log('Sistema reiniciado. Esperando nuevos datos de entrenamiento.');
}

// ─── 2. Captura de datos durante la calibración ───────────────────────────
// recordCalibrationPoint: lee currentResults (caché) — nunca rellamamos detectForVideo
function recordCalibrationPoint(screenX, screenY) {
  const shapes = currentResults?.faceBlendshapes?.[0]?.categories;
  if (!shapes) {
    setStatus('Cara no detectada — repita el clic', 'warn');
    return;
  }

  const find = (name) => shapes.find(s => s.categoryName === name)?.score ?? 0;
  const eyeX = find('eyeLookOutLeft') - find('eyeLookInLeft');
  const eyeY = find('eyeLookUpLeft')  - find('eyeLookDownLeft');

  trainingData.push({ eyeX, eyeY, screenX, screenY });

  console.log(`Muestra ${trainingData.length}: eyeX=${eyeX.toFixed(3)} eyeY=${eyeY.toFixed(3)} → (${Math.round(screenX)}, ${Math.round(screenY)})`);

  if (trainingData.length >= 27) { // 9 puntos × 3 clics mínimo
    calculateRegression();
    isCalibrated = true;
    setStatus('¡Calibración Exitosa!', 'ok');
  }
}

// ─── 3. safeRecord: solo graba si la IA detecta el rostro ─────────────────
let faceToastTimer = null;

function safeRecord(screenX, screenY) {
  if (currentResults && currentResults.faceBlendshapes?.length > 0) {
    recordCalibrationPoint(screenX, screenY);
  } else {
    // Mostrar toast de aviso (no alert — no interrumpe el flujo clínico)
    const toast = document.getElementById('face-toast');
    toast.style.display = 'block';
    clearTimeout(faceToastTimer);
    faceToastTimer = setTimeout(() => { toast.style.display = 'none'; }, 2500);
    console.warn('safeRecord: cara no detectada, clic ignorado.');
  }
}

// ─── 3. El Cerebro: Cálculo de Regresión Lineal ──────────────────────────
// Fórmula explícita: screenX = alphaX + betaX * eyeX
function calculateRegression() {
  const n = trainingData.length;
  if (n < 4) { console.warn('Pocas muestras para calibrar'); return; }

  let sumX = 0, sumScreenX = 0, sumXX = 0, sumXScreenX = 0;
  let sumY = 0, sumScreenY = 0, sumYY = 0, sumYScreenY = 0;

  trainingData.forEach(d => {
    sumX       += d.eyeX;
    sumScreenX += d.screenX;
    sumXX      += d.eyeX * d.eyeX;
    sumXScreenX += d.eyeX * d.screenX;

    sumY       += d.eyeY;
    sumScreenY += d.screenY;
    sumYY      += d.eyeY * d.eyeY;
    sumYScreenY += d.eyeY * d.screenY;
  });

  // Fórmula de pendiente para X
  const denX = (n * sumXX - sumX * sumX) || 0.001;
  regressionModel.betaX  = (n * sumXScreenX - sumX * sumScreenX) / denX;
  regressionModel.alphaX = (sumScreenX - regressionModel.betaX * sumX) / n;

  // Fórmula de pendiente para Y
  const denY = (n * sumYY - sumY * sumY) || 0.001;
  regressionModel.betaY  = (n * sumYScreenY - sumY * sumScreenY) / denY;
  regressionModel.alphaY = (sumScreenY - regressionModel.betaY * sumY) / n;

  console.log(
    `Regresión OK (${n} muestras):`,
    `X → α=${regressionModel.alphaX.toFixed(1)} β=${regressionModel.betaX.toFixed(1)}`,
    `Y → α=${regressionModel.alphaY.toFixed(1)} β=${regressionModel.betaY.toFixed(1)}`,
  );
}

// ─── predictUniversalGaze: modo sin calibración ────────────────────────────
// Mapeo directo basado en el centro de la pantalla.
// No necesita clics previos — usa un promedio humano estándar con SENSITIVITY.
function predictUniversalGaze(lookX, lookY) {
  return {
    rawX: (window.innerWidth  / 2) + (lookX * window.innerWidth  * SENSITIVITY),
    rawY: (window.innerHeight / 2) - (lookY * window.innerHeight * SENSITIVITY),
  };
}

// ─── 4. Aplicación en tiempo real ─────────────────────────────────────────
// Patrón exacto del usuario: Coordenada = Alpha + (Beta * ValorOjo)
function updateGazePoint(eyeX, eyeY) {
  if (isCalibrated) {
    return {
      rawX: regressionModel.alphaX + regressionModel.betaX * eyeX,
      rawY: regressionModel.alphaY + regressionModel.betaY * eyeY,
    };
  }
  // Fallback: predictUniversalGaze con SENSITIVITY 1.5
  return predictUniversalGaze(eyeX, eyeY);
}

// ─── Inicializar FaceLandmarker ────────────────────────────────────────────
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

// ─── Activar cámara ────────────────────────────────────────────────────────
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

    // Arrancamos el render loop YA (durante calibración) para que
    // currentResults esté actualizado cuando el usuario haga clic en un punto
    requestAnimationFrame(renderLoop);
    setStatus('Calibrando… haga clic en cada punto 3 veces', 'warn');
  } catch (err) {
    setStatus('Error de cámara: ' + err.message, 'error');
  }
};

// ─── Puntos de calibración ─────────────────────────────────────────────────
const clickCounts = {};
let allCalibrated = false;

document.querySelectorAll('.calibration-point').forEach(point => {
  const id = point.dataset.id;
  clickCounts[id] = 0;

  point.addEventListener('click', (e) => {
    const rect = e.target.getBoundingClientRect();
    const x    = rect.left + rect.width  / 2;
    const y    = rect.top  + rect.height / 2;

    // safeRecord: solo graba si la IA detecta el rostro en este momento
    safeRecord(x, y);

    const n = trainingData.length;
    valSamples.textContent = n;

    clickCounts[id]++;
    const remaining = Math.max(0, CLICKS_NEEDED - clickCounts[id]);
    if (remaining === 0) {
      e.target.textContent = '✓';
      e.target.classList.add('done');
    } else {
      e.target.textContent = remaining;
    }

    const allDone = Object.values(clickCounts).every(c => c >= CLICKS_NEEDED);
    if (allDone && !allCalibrated) {
      allCalibrated = true;
      btnStartTrack.classList.add('visible');
      setStatus(`Calibración completa (${n} muestras). Pulse Iniciar.`, 'ok');
    }
  });
});

// ─── Botón recalibrar ──────────────────────────────────────────────────────
document.getElementById('btn-recalibrate').onclick = () => {
  resetCalibration();
};

// ─── Iniciar seguimiento ───────────────────────────────────────────────────
btnStartTrack.onclick = () => {
  // Calcular modelo final si aún no se calculó automáticamente
  if (!isCalibrated && trainingData.length >= 4) {
    calculateRegression();
    isCalibrated = true;
  }

  screenCalib.classList.remove('visible');
  dataPanel.classList.add('visible');
  gazeDot.style.display = 'block';
  setStatus('Seguimiento de mirada activo', 'ok');
};

// ─── Bucle de renderizado ──────────────────────────────────────────────────
const drawingUtils = new DrawingUtils(ctx);

function renderLoop(rafTs) {
  if (video.readyState >= 2 && video.currentTime !== lastVideoTime) {
    lastVideoTime = video.currentTime;

    // Timestamp estrictamente creciente — evita "Packet timestamp mismatch"
    const mpTs = Math.max(rafTs, lastMpTs + 0.1);
    lastMpTs = mpTs;

    try {
      const results = faceLandmarker.detectForVideo(video, mpTs);

      // Actualizar currentResults para recordCalibrationPoint()
      currentResults = results;

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

        // ── Mirada ────────────────────────────────────────────────────────
        const eyeX =  find('eyeLookOutLeft') - find('eyeLookInLeft');
        const eyeY =  find('eyeLookUpLeft')  - find('eyeLookDownLeft');

        const { rawX, rawY } = updateGazePoint(eyeX, eyeY);

        smoothX = ALPHA * rawX + (1 - ALPHA) * smoothX;
        smoothY = ALPHA * rawY + (1 - ALPHA) * smoothY;

        const posX = Math.max(0, Math.min(window.innerWidth,  smoothX));
        const posY = Math.max(0, Math.min(window.innerHeight, smoothY));

        if (gazeDot.style.display !== 'none') {
          gazeDot.style.left = `${posX}px`;
          gazeDot.style.top  = `${posY}px`;
        }

        valX.textContent       = Math.round(posX);
        valY.textContent       = Math.round(posY);
        valSamples.textContent = trainingData.length;

        // ── Parpadeo deliberado ───────────────────────────────────────────
        const blinkScore = (find('eyeBlinkLeft') + find('eyeBlinkRight')) / 2;
        const isBlink    = blinkScore > BLINK_THRESHOLD;

        const blinkEl = document.getElementById('val-blink');
        if (blinkEl) blinkEl.textContent = blinkScore.toFixed(2);

        if (isBlink && !wasBlinking && !blinkOnCooldown) {
          blinkOnCooldown = true;

          // Flash del punto de mirada
          gazeDot.classList.add('blink-flash');
          setTimeout(() => gazeDot.classList.remove('blink-flash'), 350);

          // Actualizar indicador visual
          if (blinkEl) { blinkEl.classList.add('blink-active'); }
          setTimeout(() => blinkEl?.classList.remove('blink-active'), 400);

          console.log(`Parpadeo detectado en (${Math.round(posX)}, ${Math.round(posY)})`);
          setTimeout(() => { blinkOnCooldown = false; }, BLINK_COOLDOWN);
        }
        wasBlinking = isBlink;
      }
    } catch (_) {}
  }

  requestAnimationFrame(renderLoop);
}

// ─── Helper ───────────────────────────────────────────────────────────────
function setStatus(text, cls = '') {
  statusEl.textContent = text;
  statusEl.className   = cls;
}
