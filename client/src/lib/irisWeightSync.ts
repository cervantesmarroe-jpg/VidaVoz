// ── Sincronización del peso iris con Supabase (via API Express) ───────────────
//
// FLUJO:
//   Al arrancar → GET /api/iris-weight → aplica el peso óptimo calculado con
//   todos los datos acumulados de todos los dispositivos.
//
//   Durante el uso → record() encola cada activación gaze exitosa (blendshape +
//   iris + target normalizados). Cuando el buffer llega a BATCH_SIZE, o cuando
//   el usuario cierra/minimiza la pestaña, se envía el lote a POST /api/iris-feedback.
//
// OPTIMIZACIÓN:
//   El servidor calcula W_opt = Σ(target-bs)·(iris-bs) / Σ(iris-bs)²
//   (mínimos cuadrados cerrados). Solo se aplica si hay ≥ MIN_SAMPLES registros.

const BATCH_SIZE  = 10;   // activaciones por lote
const MIN_SAMPLES = 50;   // mínimo para confiar en el peso calculado

export interface ActivationRecord {
  deviceType:  string;
  bsEyeX:      number;
  irisEyeX:    number;
  eyeTargetX:  number;
  bsEyeY:      number;
  irisEyeY:    number;
  eyeTargetY:  number;
}

// ── Confirmación de cuidador (TEMPORAL) ──────────────────────────────────────
// Con CONFIRM_ACTIVATIONS = true, cada activación por mirada queda pendiente
// y ActivationConfirmPrompt pregunta al cuidador "¿Era este el botón correcto?".
// Solo "✓ Sí" la encola para Supabase; "✗ No" o CONFIRM_TIMEOUT_MS sin
// respuesta la descartan. Así solo se guardan activaciones verificadas.
// Poner a false para volver al envío directo sin confirmación.
export const CONFIRM_ACTIVATIONS = true;
const CONFIRM_TIMEOUT_MS = 5000;

const queue: ActivationRecord[] = [];

let pending: ActivationRecord | null = null;
let pendingTimer: ReturnType<typeof setTimeout> | null = null;
const pendingListeners = new Set<(hasPending: boolean) => void>();

function setPending(r: ActivationRecord | null): void {
  if (pendingTimer) { clearTimeout(pendingTimer); pendingTimer = null; }
  pending = r;
  if (r) {
    pendingTimer = setTimeout(() => {
      console.debug('[IrisSync] activación descartada: sin respuesta del cuidador');
      setPending(null);
    }, CONFIRM_TIMEOUT_MS);
  }
  pendingListeners.forEach(cb => cb(r !== null));
}

export function subscribePending(cb: (hasPending: boolean) => void): () => void {
  pendingListeners.add(cb);
  return () => { pendingListeners.delete(cb); };
}

// "✓ Sí" del cuidador → la activación pendiente pasa a la cola de envío
export function confirmPending(): void {
  const r = pending;
  setPending(null);
  if (r) enqueue(r);
}

// "✗ No" del cuidador → se descarta sin guardar
export function rejectPending(): void {
  if (pending) console.debug('[IrisSync] activación descartada por el cuidador');
  setPending(null);
}

export function record(r: ActivationRecord): void {
  // Una activación nueva sustituye a la anterior aún sin confirmar (que se
  // descarta) y reinicia el plazo de 5 s.
  if (CONFIRM_ACTIVATIONS) { setPending(r); return; }
  enqueue(r);
}

function enqueue(r: ActivationRecord): void {
  queue.push(r);
  console.debug(`[IrisSync] activación encolada (${queue.length}/${BATCH_SIZE})`);
  if (queue.length >= BATCH_SIZE) void flush();
}

async function flush(): Promise<void> {
  if (queue.length === 0) return;
  const batch = queue.splice(0, queue.length);
  try {
    const res = await fetch('/api/iris-feedback', {
      method:    'POST',
      headers:   { 'Content-Type': 'application/json' },
      body:      JSON.stringify(batch),
      keepalive: true,   // el lote sobrevive al cierre de la pestaña
    });
    // Sin reintentos, pero el fallo queda visible en consola
    if (!res.ok) console.warn(`[IrisSync] POST /api/iris-feedback ${res.status}: ${await res.text()}`);
  } catch (err) {
    // fire-and-forget — sin reintentos para no bloquear la sesión clínica
    console.warn('[IrisSync] POST /api/iris-feedback falló:', err);
  }
}

// Descarga el peso óptimo calculado con los datos acumulados de todos los
// dispositivos y lo aplica invocando el callback recibido.
export async function loadAndApply(setWeight: (w: number) => void): Promise<void> {
  try {
    const res = await fetch('/api/iris-weight');
    if (!res.ok) return;
    const { weight, samples } = await res.json() as { weight: number; samples: number };
    if (samples >= MIN_SAMPLES && typeof weight === 'number' && isFinite(weight)) {
      setWeight(weight);
      console.log(
        `%c[IrisSync] Peso iris actualizado desde Supabase: ${weight.toFixed(3)} (${samples} activaciones)`,
        'color:#7DD3A8;font-weight:700',
      );
    }
  } catch {
    // red no disponible — se mantiene el peso por defecto
  }
}

// Enviar lote pendiente al perder el foco o cerrar la pestaña
if (typeof window !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') void flush();
  });
}
