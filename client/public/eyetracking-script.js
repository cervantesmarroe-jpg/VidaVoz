// ─── EyeTracking Clínico Pro — script.js ────────────────────────────────────
// MediaPipe FaceLandmarker · Modelo Maestro de Regresión · RGPD Compliant
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

// ─── Configuraciones ──────────────────────────────────────────────────────
// SENSITIVITY_X negativo = efecto espejo para estimación universal sin calibrar.
// En el Modelo Maestro, el espejo queda integrado en betaX (negativo por regresión).
const SENSITIVITY_X   = -1.8;
const SENSITIVITY_Y   =  1.5;
const DWELL_TIME      = 3000;
const ALPHA           = 0.3;   // suavizado: 0.7·prev + 0.3·nuevo
const BLINK_THRESHOLD = 0.85;
const BLINK_COOLDOWN  = 1200;

// ═══════════════════════════════════════════════════════════════════════════
// ── SISTEMA DE PESOS GLOBALES (Gold Standard) ─────────────────────────────
// Almacena la regresión maestra en localStorage como configuración de DISPOSITIVO
// (no contiene datos biométricos personales — solo coeficientes matemáticos).
// ═══════════════════════════════════════════════════════════════════════════

const WEIGHTS_KEY     = 'vozuci-global-weights-v1';
const STARTS_KEY      = 'vozuci-start-count-v1';
const MAX_SESSIONS    = 10;   // sesiones a promediar (ventana deslizante)

// ─── DEFAULT_WEIGHTS ─────────────────────────────────────────────────────
// Valores de fábrica calculados por el administrador y pegados aquí.
// Actúan como "firmware" del dispositivo: la app arranca con precisión
// incluso si localStorage está vacío (primer uso, modo privado, etc.).
// Para obtener nuevos valores: entrenar en Modo Admin → aparece un alert()
// con la constante lista para copiar y reemplazar aquí.
//
// betaX SIEMPRE negativo (espejo integrado). Si es null → sin pesos por defecto.
const DEFAULT_WEIGHTS = {
  alphaX: null,   // ← pegar valor del alert tras entrenar
  betaX:  null,   // ← negativo (efecto espejo integrado)
  alphaY: null,
  betaY:  null,
};

// Variable Global de Pesos — prioridad: localStorage > DEFAULT_WEIGHTS.
// La app la usa por defecto sin pedir calibración al paciente.
let GLOBAL_GAZE_WEIGHTS = loadGlobalWeights();

function loadGlobalWeights() {
  try {
    const raw = localStorage.getItem(WEIGHTS_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  // Sin localStorage → usar DEFAULT_WEIGHTS de fábrica si están definidos
  const d = DEFAULT_WEIGHTS;
  if (d.alphaX !== null && d.betaX !== null && d.alphaY !== null && d.betaY !== null) {
    return { alphaX: d.alphaX, betaX: d.betaX, alphaY: d.alphaY, betaY: d.betaY,
             sessions: [], sessionCount: 0, lastUpdated: null, isDefault: true };
  }
  return null;
}

function saveGlobalWeights(w) {
  try { localStorage.setItem(WEIGHTS_KEY, JSON.stringify(w)); } catch {}
}

// Promedia todas las sesiones de entrenamiento → Modelo Maestro
function averageSessions(sessions) {
  const n = sessions.length;
  return {
    alphaX: sessions.reduce((s, m) => s + m.alphaX, 0) / n,
    betaX:  sessions.reduce((s, m) => s + m.betaX,  0) / n,
    alphaY: sessions.reduce((s, m) => s + m.alphaY, 0) / n,
    betaY:  sessions.reduce((s, m) => s + m.betaY,  0) / n,
  };
}

// Añade sesión al histórico y recalcula el Modelo Maestro promedio
function addTrainingSession(model) {
  const prev     = GLOBAL_GAZE_WEIGHTS?.sessions || [];
  const sessions = [...prev, { alphaX: model.alphaX, betaX: model.betaX,
                                alphaY: model.alphaY, betaY: model.betaY }]
                    .slice(-MAX_SESSIONS);
  const avg = averageSessions(sessions);
  GLOBAL_GAZE_WEIGHTS = {
    ...avg,
    sessions,
    sessionCount: (GLOBAL_GAZE_WEIGHTS?.sessionCount || 0) + 1,
    lastUpdated:  new Date().toISOString(),
  };
  saveGlobalWeights(GLOBAL_GAZE_WEIGHTS);
  return GLOBAL_GAZE_WEIGHTS;
}

function clearGlobalWeights() {
  GLOBAL_GAZE_WEIGHTS = null;
  try { localStorage.removeItem(WEIGHTS_KEY); } catch {}
}

// ═══════════════════════════════════════════════════════════════════════════
// ── HISTORIAL ACUMULATIVO EN RAM (solo Modo Admin) ────────────────────────
// Almacena los coeficientes de cada sesión de calibración durante el
// entrenamiento. SOLO existe en memoria RAM — se pierde al cerrar la pestaña.
// Privacidad garantizada: NO se persiste en localStorage ni en ningún
// almacenamiento externo.
// ═══════════════════════════════════════════════════════════════════════════

let calibrationHistory = [];   // [{ alphaX, betaX, alphaY, betaY }, ...]

function computeHistoryAverage() {
  if (calibrationHistory.length === 0) return null;
  return averageSessions(calibrationHistory);
}

function clearCalibrationHistory() {
  calibrationHistory = [];
  updateHistoryCounter();
}

function updateHistoryCounter() {
  const el = document.getElementById('admin-history-count');
  if (el) el.textContent = calibrationHistory.length;
}

// ─── Contador de inicios de app ────────────────────────────────────────────
function getStartCount()      { return parseInt(localStorage.getItem(STARTS_KEY) || '0'); }
function incrementStartCount() {
  const n = getStartCount() + 1;
  try { localStorage.setItem(STARTS_KEY, String(n)); } catch {}
  return n;
}

// ═══════════════════════════════════════════════════════════════════════════
// ── ESTADO RUNTIME ────────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════

let faceLandmarker;
let lastVideoTime   = -1;
let lastMpTs        = 0;

let trainingData    = [];
let isCalibrated    = false;
let regressionModel = { alphaX: 0, betaX: 0, alphaY: 0, betaY: 0 };

let smoothX = window.innerWidth  / 2;
let smoothY = window.innerHeight / 2;

let currentResults  = null;
let wasBlinking     = false;
let blinkOnCooldown = false;

// Modo de operación
let isAdminMode  = false;   // entrenar modelo maestro
let isWarmupMode = false;   // calentamiento rápido de 3 puntos

// Contadores de calibración (scope global → resetCalibration los necesita)
const clickCounts = {};
let allCalibrated = false;

// ─── Ids de puntos de calentamiento (fila central: izquierda, centro, derecha)
const WARMUP_POINT_IDS = ['3', '4', '5'];

// ═══════════════════════════════════════════════════════════════════════════
// ── CALIBRACIÓN ───────────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════

function resetCalibration() {
  trainingData  = [];
  isCalibrated  = false;
  allCalibrated = false;

  document.querySelectorAll('.calibration-point').forEach(pt => {
    const id = pt.dataset.id;
    clickCounts[id] = 0;
    pt.textContent = CLICKS_NEEDED;
    pt.classList.remove('done');

    // En modo calentamiento, desactivar puntos fuera de la fila central
    if (isWarmupMode) {
      const active = WARMUP_POINT_IDS.includes(id);
      pt.style.opacity      = active ? '1'    : '0.2';
      pt.style.pointerEvents = active ? 'auto' : 'none';
    } else {
      pt.style.opacity      = '1';
      pt.style.pointerEvents = 'auto';
    }
  });

  btnStartTrack.classList.remove('visible');
  gazeDot.style.display = 'none';
  dataPanel.classList.remove('visible');
  screenCalib.classList.add('visible');

  // Etiqueta del botón según modo
  btnStartTrack.textContent = isAdminMode
    ? 'GUARDAR Y CONTINUAR ENTRENANDO'
    : 'INICIAR SEGUIMIENTO DE MIRADA';

  // Banner de modo en la pantalla de calibración
  document.getElementById('calib-mode-badge').textContent = isAdminMode
    ? '⚙ MODO ADMINISTRADOR — Sesión de entrenamiento'
    : isWarmupMode
    ? '⚡ CALENTAMIENTO RÁPIDO (3 puntos)'
    : '';
  document.getElementById('calib-mode-badge').style.display =
    (isAdminMode || isWarmupMode) ? 'block' : 'none';

  setStatus(isAdminMode
    ? 'Admin: calibre los 9 puntos (3 clics c/u)'
    : isWarmupMode
    ? 'Calentamiento: calibre los 3 puntos centrales'
    : 'Calibrando — haga clic en los puntos', 'warn');
}

function recordCalibrationPoint(screenX, screenY) {
  const shapes    = currentResults?.faceBlendshapes?.[0]?.categories;
  const landmarks = currentResults?.faceLandmarks?.[0];
  if (!shapes || !landmarks) {
    setStatus('Cara no detectada — repita el clic', 'warn');
    return;
  }

  const find     = (name) => shapes.find(s => s.categoryName === name)?.score ?? 0;
  const headRotX = landmarks[1].x - landmarks[4].x;
  const eyeX     = (find('eyeLookOutLeft') - find('eyeLookInLeft')) + (headRotX * 2);
  const eyeY     =  find('eyeLookUpLeft')  - find('eyeLookDownLeft');

  trainingData.push({ eyeX, eyeY, screenX, screenY });

  const minSamples = isWarmupMode ? 9 : 27;   // 3pts×3 ó 9pts×3
  if (trainingData.length >= minSamples) {
    calculateRegression();
    isCalibrated = true;
    setStatus('¡Calibración exitosa!', 'ok');
  }
}

let faceToastTimer = null;
function safeRecord(screenX, screenY) {
  if (currentResults && currentResults.faceBlendshapes?.length > 0) {
    recordCalibrationPoint(screenX, screenY);
  } else {
    const toast = document.getElementById('face-toast');
    toast.style.display = 'block';
    clearTimeout(faceToastTimer);
    faceToastTimer = setTimeout(() => { toast.style.display = 'none'; }, 2500);
  }
}

// ─── Regresión lineal ────────────────────────────────────────────────────
function calculateRegression() {
  const n = trainingData.length;
  if (n < 4) return;

  let sumX = 0, sumSX = 0, sumXX = 0, sumXSX = 0;
  let sumY = 0, sumSY = 0, sumYY = 0, sumYSY = 0;

  trainingData.forEach(d => {
    sumX  += d.eyeX;    sumSX  += d.screenX;
    sumXX += d.eyeX**2; sumXSX += d.eyeX * d.screenX;
    sumY  += d.eyeY;    sumSY  += d.screenY;
    sumYY += d.eyeY**2; sumYSY += d.eyeY * d.screenY;
  });

  const denX = (n * sumXX - sumX * sumX) || 0.001;
  regressionModel.betaX  = (n * sumXSX - sumX * sumSX) / denX;
  regressionModel.alphaX = (sumSX - regressionModel.betaX * sumX) / n;

  const denY = (n * sumYY - sumY * sumY) || 0.001;
  regressionModel.betaY  = (n * sumYSY - sumY * sumSY) / denY;
  regressionModel.alphaY = (sumSY - regressionModel.betaY * sumY) / n;
}

// ─── Estimación universal sin calibración (fallback) ─────────────────────
// SENSITIVITY_X negativo corrige el efecto espejo de la cámara frontal.
// Con Modelo Maestro activo, este fallback no se usa — el espejo queda
// integrado en betaX (negativo) calculado por la regresión.
function estimateGazeNoCalibration(out, inn, up, down, headRotX) {
  const h = (out - inn) + (headRotX * 2);
  const v = up - down;
  return {
    rawX: (window.innerWidth  / 2) + (h * window.innerWidth  * SENSITIVITY_X),
    rawY: (window.innerHeight / 2) - (v * window.innerHeight * SENSITIVITY_Y),
  };
}

// ─── Punto de mirada — prioridad: sesión > pesos globales > universal ─────
function updateGazePoint(out, inn, up, down, headRotX) {
  const model = isCalibrated ? regressionModel : GLOBAL_GAZE_WEIGHTS;
  if (model) {
    const eyeX = (out - inn) + (headRotX * 2);
    const eyeY = up - down;
    return {
      rawX: model.alphaX + model.betaX * eyeX,
      rawY: model.alphaY + model.betaY * eyeY,
    };
  }
  return estimateGazeNoCalibration(out, inn, up, down, headRotX);
}

// ═══════════════════════════════════════════════════════════════════════════
// ── UI PANTALLA DE INICIO ─────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════

function updateStartScreen() {
  const badge  = document.getElementById('global-model-badge');
  const w      = GLOBAL_GAZE_WEIGHTS;

  if (w && !w.isDefault) {
    const sessions = w.sessions?.length ?? w.sessionCount ?? 1;
    const d = new Date(w.lastUpdated);
    const fecha = isNaN(d) ? '' : ` · ${d.toLocaleDateString('es-ES')}`;
    badge.textContent  = `✓ Modelo Maestro activo · ${sessions} sesión${sessions !== 1 ? 'es' : ''} promediadas${fecha}`;
    badge.className    = 'global-badge active';
    document.getElementById('btn-start').textContent = '▶ INICIAR (Modelo Maestro)';
    document.getElementById('btn-manual-calib').style.display = 'inline-block';
  } else if (w?.isDefault) {
    badge.textContent  = '⚙ Usando DEFAULT_WEIGHTS (valores de fábrica) — entrene para personalizar';
    badge.className    = 'global-badge active';
    document.getElementById('btn-start').textContent = '▶ INICIAR (Valores por defecto)';
    document.getElementById('btn-manual-calib').style.display = 'inline-block';
  } else {
    badge.textContent  = '⚠ Sin modelo maestro — se pedirá calibración al paciente';
    badge.className    = 'global-badge empty';
    document.getElementById('btn-start').textContent = 'CALIBRAR E INICIAR';
    document.getElementById('btn-manual-calib').style.display = 'none';
  }

  // Info sesiones de admin
  const adminInfo = document.getElementById('admin-session-count');
  if (adminInfo) {
    const sc = GLOBAL_GAZE_WEIGHTS?.sessionCount ?? 0;
    adminInfo.textContent = sc > 0 ? `${sc} sesión${sc !== 1 ? 'es' : ''} de entrenamiento registradas` : 'Sin sesiones de entrenamiento';
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// ── INICIO DE LA APP ──────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════

// Promesa global: se resuelve cuando MediaPipe está listo
let mpReadyResolve;
const mpReady = new Promise(res => { mpReadyResolve = res; });

async function startMedicalApp() {
  // Conteo de inicios → sugerencia de calentamiento cada 20 arranques
  const starts = incrementStartCount();
  if (starts % 20 === 0 && GLOBAL_GAZE_WEIGHTS) {
    showWarmupModal(starts);
  }

  updateStartScreen();
  setStatus('Cargando modelo IA…', 'warn');

  // ─── Registrar botones AHORA (antes del await de MediaPipe) ─────────────
  // Así el usuario puede pulsar Admin/Iniciar aunque MediaPipe aún esté cargando.
  btnStart.onclick = () => { isAdminMode = false; isWarmupMode = false; activateCamera(false); };

  document.getElementById('btn-manual-calib').onclick = () => {
    isAdminMode  = false;
    isWarmupMode = false;
    activateCamera(true);
  };

  document.getElementById('btn-admin').onclick = () => {
    isAdminMode  = true;
    isWarmupMode = false;
    activateCamera(true);
  };

  // ─── Cargar MediaPipe en segundo plano ───────────────────────────────────
  try {
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
    mpReadyResolve();   // desbloquea activateCamera si ya estaba esperando
    setStatus(GLOBAL_GAZE_WEIGHTS ? 'Modelo Maestro listo. Pulse Iniciar.' : 'IA lista. Pulse para calibrar.', 'ok');
  } catch (err) {
    setStatus('Error cargando IA: ' + err.message, 'error');
  }
}

async function activateCamera(forceCalib) {
  // Esperar a MediaPipe si aún está cargando (no bloquea el hilo UI)
  if (!faceLandmarker) {
    setStatus('Cargando IA, espere…', 'warn');
    await mpReady;
  }

  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: true });
    video.srcObject = stream;
    await video.play();
    video.addEventListener('loadedmetadata', () => {
      canvas.width  = video.videoWidth;
      canvas.height = video.videoHeight;
    }, { once: true });

    screenStart.classList.add('hidden');

    const skipCalib = !forceCalib && GLOBAL_GAZE_WEIGHTS && !isAdminMode;
    if (skipCalib) {
      // Modelo Maestro disponible → saltar calibración
      gazeDot.style.display = 'block';
      dataPanel.classList.add('visible');
      requestAnimationFrame(renderLoop);
      setStatus('Seguimiento activo — Modelo Maestro', 'ok');
    } else {
      resetCalibration();
      requestAnimationFrame(renderLoop);
    }
  } catch (err) {
    setStatus('Error de cámara: ' + err.message, 'error');
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// ── MODAL DE CALENTAMIENTO ────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════

function showWarmupModal(starts) {
  const modal = document.getElementById('warmup-modal');
  document.getElementById('warmup-start-count').textContent = starts;
  modal.style.display = 'flex';
}

document.getElementById('btn-warmup-skip').onclick = () => {
  document.getElementById('warmup-modal').style.display = 'none';
};

document.getElementById('btn-warmup-start').onclick = () => {
  document.getElementById('warmup-modal').style.display = 'none';
  isAdminMode  = false;
  isWarmupMode = true;
  // La cámara ya estará activa desde la llamada a startMedicalApp
  // Si el video no está activo aún, esperar a que lo esté
  if (video.srcObject) {
    resetCalibration();
    screenStart.classList.add('hidden');
    screenCalib.classList.add('visible');
  } else {
    activateCamera(true);
  }
};

// ═══════════════════════════════════════════════════════════════════════════
// ── PUNTOS DE CALIBRACIÓN ─────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════

document.querySelectorAll('.calibration-point').forEach(point => {
  const id = point.dataset.id;
  clickCounts[id] = 0;

  point.addEventListener('click', (e) => {
    // En calentamiento, ignorar puntos no pertenecientes a la fila central
    if (isWarmupMode && !WARMUP_POINT_IDS.includes(id)) return;

    const rect = e.target.getBoundingClientRect();
    safeRecord(rect.left + rect.width / 2, rect.top + rect.height / 2);

    valSamples.textContent = trainingData.length;
    clickCounts[id]++;
    const remaining = Math.max(0, CLICKS_NEEDED - clickCounts[id]);
    e.target.textContent = remaining === 0 ? '✓' : remaining;
    if (remaining === 0) e.target.classList.add('done');

    // Comprobar si están completos los puntos activos
    const activeIds = isWarmupMode ? WARMUP_POINT_IDS : Object.keys(clickCounts);
    const allDone   = activeIds.every(aid => (clickCounts[aid] || 0) >= CLICKS_NEEDED);
    if (allDone && !allCalibrated) {
      allCalibrated = true;
      btnStartTrack.classList.add('visible');
      setStatus(`Calibración completa (${trainingData.length} muestras). Pulse Iniciar.`, 'ok');
    }
  });
});

document.getElementById('btn-recalibrate').onclick = () => resetCalibration();

// ─── Iniciar / Guardar sesión de entrenamiento ────────────────────────────
btnStartTrack.onclick = () => {
  if (!isCalibrated && trainingData.length >= 4) {
    calculateRegression();
    isCalibrated = true;
  }

  if (isAdminMode) {
    // ── Acumular en historial RAM (NO localStorage) ─────────────────────
    calibrationHistory.push({
      alphaX: regressionModel.alphaX,
      betaX:  regressionModel.betaX,
      alphaY: regressionModel.alphaY,
      betaY:  regressionModel.betaY,
    });
    updateHistoryCounter();
    showAdminResult();
    return;
  }

  if (isWarmupMode) {
    // ── Calentamiento: afinar el modelo global y continuar ──────────────
    addTrainingSession(regressionModel);
    isWarmupMode  = false;
    isCalibrated  = false;   // dejar que el modelo global tome el control
    regressionModel = { alphaX: 0, betaX: 0, alphaY: 0, betaY: 0 };
    updateStartScreen();
  }

  // ── Iniciar seguimiento ─────────────────────────────────────────────────
  screenCalib.classList.remove('visible');
  dataPanel.classList.add('visible');
  gazeDot.style.display = 'block';
  setStatus(GLOBAL_GAZE_WEIGHTS
    ? `Seguimiento activo · Modelo Maestro (${GLOBAL_GAZE_WEIGHTS.sessions?.length ?? 1} sesiones)`
    : 'Seguimiento de mirada activo', 'ok');
};

// ─── Panel de resultado de sesión Admin ──────────────────────────────────
function showAdminResult() {
  const n    = calibrationHistory.length;
  const last = calibrationHistory[n - 1];
  const avg  = computeHistoryAverage();

  // Contador principal
  document.getElementById('admin-history-count').textContent = n;

  // Valores de esta sesión
  document.getElementById('admin-last-betax').textContent  = last.betaX.toFixed(2);
  document.getElementById('admin-last-betay').textContent  = last.betaY.toFixed(2);
  document.getElementById('admin-last-alphax').textContent = last.alphaX.toFixed(1);
  document.getElementById('admin-last-alphay').textContent = last.alphaY.toFixed(1);

  // Promedio acumulado
  if (avg) {
    document.getElementById('admin-avg-betax').textContent  = avg.betaX.toFixed(2);
    document.getElementById('admin-avg-betay').textContent  = avg.betaY.toFixed(2);
    document.getElementById('admin-avg-alphax').textContent = avg.alphaX.toFixed(1);
    document.getElementById('admin-avg-alphay').textContent = avg.alphaY.toFixed(1);
  }

  // Sección de promedio solo visible con >1 sesión
  document.getElementById('admin-avg-section').style.display = n > 1 ? 'block' : 'none';

  document.getElementById('admin-result-modal').style.display = 'flex';
}

function exportHistoryAverage() {
  const avg = computeHistoryAverage();
  if (!avg) return;
  const n = calibrationHistory.length;
  const snippet =
`const DEFAULT_WEIGHTS = {
  alphaX: ${avg.alphaX.toFixed(4)},
  betaX:  ${avg.betaX.toFixed(4)},   // negativo = espejo integrado
  alphaY: ${avg.alphaY.toFixed(4)},
  betaY:  ${avg.betaY.toFixed(4)},
};
// Sesiones promediadas: ${n}
// Fecha: ${new Date().toLocaleString('es-ES')}`;
  alert('─── COPIAR Y PEGAR EN eyetracking-script.js ───\n\n' + snippet);
}

document.getElementById('btn-admin-another').onclick = () => {
  document.getElementById('admin-result-modal').style.display = 'none';
  trainingData = [];
  isCalibrated = false;
  resetCalibration();
};

document.getElementById('btn-admin-export').onclick = () => {
  exportHistoryAverage();
};

document.getElementById('btn-admin-clear-history').onclick = () => {
  if (confirm(`¿Limpiar el historial de ${calibrationHistory.length} sesión(es) en RAM? Esta acción no se puede deshacer.`)) {
    clearCalibrationHistory();
    document.getElementById('admin-result-modal').style.display = 'none';
    setStatus('Historial RAM limpiado. Puede comenzar de nuevo.', 'warn');
  }
};

document.getElementById('btn-admin-finish').onclick = () => {
  document.getElementById('admin-result-modal').style.display = 'none';
  isAdminMode = false;
  // Guardar promedio del historial RAM en GLOBAL_GAZE_WEIGHTS (persistencia dispositivo)
  const avg = computeHistoryAverage();
  if (avg) {
    addTrainingSession(avg);
    updateStartScreen();
    setStatus(`Promedio de ${calibrationHistory.length} sesión(es) guardado. Seguimiento activo.`, 'ok');
  } else {
    setStatus('Seguimiento activo.', 'ok');
  }
  screenCalib.classList.remove('visible');
  dataPanel.classList.add('visible');
  gazeDot.style.display = 'block';
};

document.getElementById('btn-admin-reset-weights')?.addEventListener('click', () => {
  if (confirm('¿Borrar el Modelo Maestro? Se perderán todas las sesiones de entrenamiento.')) {
    clearGlobalWeights();
    updateStartScreen();
    document.getElementById('admin-result-modal').style.display = 'none';
    setStatus('Modelo Maestro eliminado', 'warn');
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// ── BUCLE DE RENDERIZADO ──────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════

const drawingUtils = new DrawingUtils(ctx);

function renderLoop(rafTs) {
  if (video.readyState >= 2 && video.currentTime !== lastVideoTime) {
    lastVideoTime = video.currentTime;

    const mpTs = Math.max(rafTs, lastMpTs + 0.1);
    lastMpTs   = mpTs;

    try {
      const results = faceLandmarker.detectForVideo(video, mpTs);
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

      if (results.faceBlendshapes?.length > 0 && results.faceLandmarks?.length > 0) {
        const shapes    = results.faceBlendshapes[0].categories;
        const landmarks = results.faceLandmarks[0];
        const find      = (name) => shapes.find(s => s.categoryName === name)?.score ?? 0;

        const headRotX   = landmarks[1].x - landmarks[4].x;
        const eyeLookOutL  = find('eyeLookOutLeft');
        const eyeLookInL   = find('eyeLookInLeft');
        const eyeLookUpL   = find('eyeLookUpLeft');
        const eyeLookDownL = find('eyeLookDownLeft');

        const { rawX, rawY } = updateGazePoint(eyeLookOutL, eyeLookInL, eyeLookUpL, eyeLookDownL, headRotX);

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

        const blinkL  = find('eyeBlinkLeft');
        const blinkR  = find('eyeBlinkRight');
        const isBlink = blinkL > BLINK_THRESHOLD && blinkR > BLINK_THRESHOLD;

        const blinkEl = document.getElementById('val-blink');
        if (blinkEl) blinkEl.textContent = Math.min(blinkL, blinkR).toFixed(2);

        if (isBlink && !wasBlinking && !blinkOnCooldown) {
          blinkOnCooldown = true;
          gazeDot.classList.add('blink-flash');
          setTimeout(() => gazeDot.classList.remove('blink-flash'), 350);
          if (blinkEl) { blinkEl.classList.add('blink-active'); }
          setTimeout(() => blinkEl?.classList.remove('blink-active'), 400);
          setTimeout(() => { blinkOnCooldown = false; }, BLINK_COOLDOWN);
        }
        wasBlinking = isBlink;
      }
    } catch (_) {}
  }

  requestAnimationFrame(renderLoop);
}

// ═══════════════════════════════════════════════════════════════════════════
// ── HELPERS ───────────────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════

function setStatus(text, cls = '') {
  statusEl.textContent = text;
  statusEl.className   = cls;
}

// ─── Consentimiento RGPD → dispara toda la app ────────────────────────────
document.getElementById('btn-accept-privacy').addEventListener('click', () => {
  document.getElementById('privacy-modal').classList.add('hidden');
  startMedicalApp();
});

// ─── "No acepto" → mostrar panel de rechazo ───────────────────────────────
document.getElementById('btn-decline-privacy').addEventListener('click', () => {
  document.getElementById('privacy-content').style.display = 'none';
  document.getElementById('privacy-decline').style.display = 'flex';
});

// ─── "Volver" → recuperar panel de consentimiento ────────────────────────
document.getElementById('btn-back-privacy').addEventListener('click', () => {
  document.getElementById('privacy-decline').style.display = 'none';
  document.getElementById('privacy-content').style.display = 'flex';
});

// ─── "Reintentar" → refrescar la página ──────────────────────────────────
document.getElementById('btn-retry-privacy').addEventListener('click', () => {
  location.reload();
});
