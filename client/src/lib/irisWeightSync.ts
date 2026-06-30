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

const BATCH_SIZE  = 30;   // activaciones por lote
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

const queue: ActivationRecord[] = [];

export function record(r: ActivationRecord): void {
  queue.push(r);
  if (queue.length >= BATCH_SIZE) void flush();
}

async function flush(): Promise<void> {
  if (queue.length === 0) return;
  const batch = queue.splice(0, queue.length);
  try {
    await fetch('/api/iris-feedback', {
      method:    'POST',
      headers:   { 'Content-Type': 'application/json' },
      body:      JSON.stringify(batch),
      keepalive: true,   // el lote sobrevive al cierre de la pestaña
    });
  } catch {
    // fire-and-forget — sin reintentos para no bloquear la sesión clínica
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
