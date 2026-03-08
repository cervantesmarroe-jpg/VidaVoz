import { useCallback } from 'react';

export function useTTS() {
  const speak = useCallback((text: string) => {
    if (!window.speechSynthesis) {
      console.warn("Speech Synthesis API not supported in this browser.");
      return;
    }

    // Cancel any ongoing speech so the new one plays immediately
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'es-ES'; // Spanish
    utterance.rate = 0.85; // Slightly slower for clarity
    utterance.pitch = 1;
    utterance.volume = 1; // Maximum volume

    // Try to find a good Spanish voice if available
    const voices = window.speechSynthesis.getVoices();
    const esVoice = voices.find(v => v.lang.startsWith('es'));
    if (esVoice) {
      utterance.voice = esVoice;
    }

    window.speechSynthesis.speak(utterance);
  }, []);

  return { speak };
}
