import { useCallback } from 'react';

// ── Prioridad de calidad de voces ─────────────────────────────────────────────
//
// Orden de preferencia (de más natural a más robótica):
//   1. Contiene "Google"   → redes neuronales, la mejor disponible en Android/Chrome
//   2. Contiene "Enhanced" → macOS/iOS voz mejorada descargable
//   3. Contiene "Premium"  → macOS/iOS voz premium neuronal
//   4. Contiene "Natural"  → algunos sistemas marcan sus voces neurales así
//   5. Primera voz española encontrada (fallback)
//
// Se prefieren los locales es-ES > es-US > cualquier "es-*" para coherencia clínica.
//
const QUALITY_KEYWORDS = ['Google', 'Enhanced', 'Premium', 'Natural'] as const;
const PREFERRED_LOCALES = ['es-ES', 'es-US', 'es-MX'];

function pickBestSpanishVoice(voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice | null {
  const spanish = voices.filter(v => v.lang.startsWith('es'));
  if (spanish.length === 0) return null;

  // Paso 1: buscar por palabra clave de calidad (en el orden de QUALITY_KEYWORDS)
  for (const kw of QUALITY_KEYWORDS) {
    // Preferir el locale es-ES primero dentro de cada keyword
    for (const locale of PREFERRED_LOCALES) {
      const hit = spanish.find(v => v.name.includes(kw) && v.lang.startsWith(locale));
      if (hit) return hit;
    }
    // Si no hay locale preferido, cualquier español con esa keyword
    const hit = spanish.find(v => v.name.includes(kw));
    if (hit) return hit;
  }

  // Paso 2: fallback — primer locale preferido disponible
  for (const locale of PREFERRED_LOCALES) {
    const hit = spanish.find(v => v.lang.startsWith(locale));
    if (hit) return hit;
  }

  // Paso 3: cualquier voz española
  return spanish[0];
}

// ── Singleton de resolución de voz ────────────────────────────────────────────
//
// El navegador puede cargar las voces de forma asíncrona (especialmente Chrome
// en Android). Usamos un singleton con flag `_resolved` para:
//   • Intentar resolución inmediata al importar el módulo.
//   • Suscribirnos a `onvoiceschanged` para re-resolver cuando lleguen las voces.
//   • Devolver siempre la mejor voz conocida en cada llamada a speak().
//
let _bestVoice: SpeechSynthesisVoice | null = null;
let _resolved = false;

function resolveVoice(): SpeechSynthesisVoice | null {
  if (_resolved) return _bestVoice;
  if (typeof window === 'undefined' || !window.speechSynthesis) return null;

  const voices = window.speechSynthesis.getVoices();
  if (voices.length === 0) return null; // todavía no han cargado

  _bestVoice = pickBestSpanishVoice(voices);
  _resolved   = true;

  console.log(
    `%c[VidaVoz TTS] Voz seleccionada: "${_bestVoice?.name ?? '—'}" (${_bestVoice?.lang ?? 'sin locale'})`,
    'color:#7DD3A8;font-weight:700',
  );
  console.log(
    '[VidaVoz TTS] Voces españolas disponibles:',
    voices.filter(v => v.lang.startsWith('es')).map(v => `${v.name} (${v.lang})`),
  );

  return _bestVoice;
}

// ── Carga forzada al arrancar ─────────────────────────────────────────────────
if (typeof window !== 'undefined' && window.speechSynthesis) {
  // Intento inmediato — algunas plataformas (Firefox, Safari) cargan síncronamente
  resolveVoice();

  // Suscripción async — Chrome en Android y algunos Chromium cargan en diferido
  window.speechSynthesis.addEventListener('voiceschanged', () => {
    _resolved = false; // forzar re-selección con la lista completa
    resolveVoice();
  });
}

// ── Hook exportado ────────────────────────────────────────────────────────────
export function useTTS() {
  const speak = useCallback((text: string) => {
    if (!window.speechSynthesis) {
      console.warn('[VidaVoz TTS] Speech Synthesis API no soportada en este navegador.');
      return;
    }

    // Cancelar cualquier síntesis en curso para reproducir inmediatamente
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang   = 'es-ES'; // locale de seguridad si la voz no tiene uno
    utterance.rate   = 0.95;    // velocidad natural — 5% más lento que 1.0 reduce la robótica
    utterance.pitch  = 1.0;     // tono neutro — evita distorsiones metálicas
    utterance.volume = 1;       // volumen máximo (UCI ruidosa)

    // Aplicar la mejor voz española disponible
    const voice = resolveVoice();
    if (voice) {
      utterance.voice = voice;
      // Sobreescribir lang al del perfil de voz para máxima coherencia
      utterance.lang = voice.lang;
    }

    window.speechSynthesis.speak(utterance);
  }, []);

  return { speak };
}
