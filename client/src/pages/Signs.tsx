import { useState } from "react";
import { Layout } from "@/components/Layout";
import { Delete, Volume2, X } from "lucide-react";
import signLanguageData from "@/data/signLanguage.json";

export default function Signs() {
  const [constructedPhrase, setConstructedPhrase] = useState("");
  const [selectedPhrase, setSelectedPhrase] = useState<(typeof signLanguageData.criticalPhrases)[0] | null>(null);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  const handleLetterClick = (letter: string) => {
    setConstructedPhrase((prev) => prev + letter);
  };

  const handleClearPhrase = () => {
    setConstructedPhrase("");
  };

  const handleBackspace = () => {
    setConstructedPhrase((prev) => prev.slice(0, -1));
  };

  const handleSpeak = () => {
    if (!constructedPhrase.trim()) return;
    const utterance = new SpeechSynthesisUtterance(constructedPhrase);
    utterance.lang = "es-ES";
    utterance.rate = 1;
    utterance.pitch = 1;
    utterance.volume = 1;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
  };

  const handlePhraseSelect = (phrase: (typeof signLanguageData.criticalPhrases)[0]) => {
    setSelectedPhrase(phrase);
    setCurrentImageIndex(0);
    const utterance = new SpeechSynthesisUtterance(phrase.phrase);
    utterance.lang = "es-ES";
    utterance.rate = 1;
    utterance.pitch = 1;
    utterance.volume = 1;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
  };

  const handleNextImage = () => {
    if (selectedPhrase && currentImageIndex < selectedPhrase.images.length - 1) {
      setCurrentImageIndex((prev) => prev + 1);
    }
  };

  const handlePrevImage = () => {
    if (currentImageIndex > 0) {
      setCurrentImageIndex((prev) => prev - 1);
    }
  };

  const criticalPhrases = signLanguageData.criticalPhrases.filter(
    (p) => p.urgency === "critical"
  );
  const normalPhrases = signLanguageData.criticalPhrases.filter(
    (p) => p.urgency !== "critical"
  );

  return (
    <Layout>
      <div className="h-full flex flex-col bg-gradient-to-b from-slate-950 to-slate-900 overflow-y-auto">
        {/* Header */}
        <div className="shrink-0 p-4 md:p-6 border-b border-slate-800">
          <h2 className="text-2xl md:text-4xl font-bold text-teal-400 uppercase tracking-widest">
            Lengua de Signos Española (LSE)
          </h2>
        </div>

        {/* Modal de Frase Seleccionada */}
        {selectedPhrase && (
          <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
            <div className="bg-slate-900 rounded-3xl p-6 md:p-8 max-w-2xl w-full border-2 border-teal-500">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-2xl md:text-4xl font-bold text-teal-400 uppercase">
                  {selectedPhrase.phrase}
                </h3>
                <button
                  onClick={() => setSelectedPhrase(null)}
                  className="text-slate-400 hover:text-white transition-colors"
                  aria-label="Cerrar"
                >
                  <X className="w-8 h-8" />
                </button>
              </div>

              {/* Imagen Central */}
              <div className="mb-6 bg-slate-800 rounded-2xl p-6 flex items-center justify-center min-h-[300px]">
                <img
                  src={selectedPhrase.images[currentImageIndex]}
                  alt={`Signo para: ${selectedPhrase.phrase}`}
                  className="max-w-full max-h-[400px] rounded-xl"
                />
              </div>

              {/* Navegación de Imágenes */}
              {selectedPhrase.images.length > 1 && (
                <div className="flex justify-between items-center mb-6">
                  <button
                    onClick={handlePrevImage}
                    disabled={currentImageIndex === 0}
                    className="px-6 py-3 bg-teal-600 hover:bg-teal-500 disabled:bg-slate-700 disabled:cursor-not-allowed text-white font-bold rounded-xl transition-colors"
                  >
                    ← ANTERIOR
                  </button>
                  <span className="text-xl text-slate-400">
                    {currentImageIndex + 1} / {selectedPhrase.images.length}
                  </span>
                  <button
                    onClick={handleNextImage}
                    disabled={currentImageIndex === selectedPhrase.images.length - 1}
                    className="px-6 py-3 bg-teal-600 hover:bg-teal-500 disabled:bg-slate-700 disabled:cursor-not-allowed text-white font-bold rounded-xl transition-colors"
                  >
                    SIGUIENTE →
                  </button>
                </div>
              )}

              {/* Botón Repetir */}
              <button
                onClick={() => handlePhraseSelect(selectedPhrase)}
                className="w-full py-4 bg-teal-500 hover:bg-teal-400 text-white font-bold text-xl rounded-2xl flex items-center justify-center gap-3 transition-colors"
              >
                <Volume2 className="w-6 h-6" />
                REPETIR FRASE
              </button>
            </div>
          </div>
        )}

        {/* Contenido Principal */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-8">
          {/* Acceso Rápido - Frases Críticas */}
          <section>
            <h3 className="text-xl md:text-3xl font-bold text-red-400 mb-4 uppercase tracking-widest">
              🚨 Acceso Rápido - Frases Críticas
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-4">
              {criticalPhrases.map((phrase, i) => (
                <button
                  key={i}
                  onClick={() => handlePhraseSelect(phrase)}
                  data-testid={`critical-phrase-${i}`}
                  className="p-4 md:p-6 bg-red-950 hover:bg-red-900 border-2 border-red-600 text-red-100 font-bold rounded-2xl transition-all hover:shadow-[0_0_20px_rgba(220,38,38,0.4)] text-sm md:text-base min-h-[100px] flex items-center justify-center text-center"
                >
                  {phrase.phrase}
                </button>
              ))}
            </div>
          </section>

          {/* Acceso Normal - Otras Frases */}
          <section>
            <h3 className="text-xl md:text-3xl font-bold text-blue-400 mb-4 uppercase tracking-widest">
              💬 Otras Frases Útiles
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-4">
              {normalPhrases.map((phrase, i) => (
                <button
                  key={i}
                  onClick={() => handlePhraseSelect(phrase)}
                  data-testid={`normal-phrase-${i}`}
                  className="p-4 md:p-6 bg-blue-950 hover:bg-blue-900 border-2 border-blue-600 text-blue-100 font-bold rounded-2xl transition-all hover:shadow-[0_0_20px_rgba(37,99,235,0.4)] text-sm md:text-base min-h-[100px] flex items-center justify-center text-center"
                >
                  {phrase.phrase}
                </button>
              ))}
            </div>
          </section>

          {/* Constructor de Frases */}
          <section className="bg-slate-800 rounded-3xl p-6 md:p-8 border-2 border-teal-600">
            <h3 className="text-xl md:text-3xl font-bold text-teal-400 mb-6 uppercase tracking-widest">
              🔤 Constructor de Frases (Dactilología)
            </h3>

            {/* Área de Texto Construida */}
            <div className="mb-6 p-6 bg-slate-900 rounded-2xl border-2 border-teal-500 min-h-24 flex items-center">
              <span className="text-2xl md:text-4xl font-bold text-teal-300 break-words">
                {constructedPhrase || "Construye una frase..."}
              </span>
            </div>

            {/* Controles */}
            <div className="flex gap-3 md:gap-4 mb-6 flex-wrap">
              <button
                onClick={handleClearPhrase}
                className="px-4 md:px-6 py-3 bg-red-600 hover:bg-red-500 text-white font-bold rounded-xl transition-colors text-sm md:text-base"
                data-testid="clear-phrase"
              >
                LIMPIAR
              </button>
              <button
                onClick={handleBackspace}
                className="px-4 md:px-6 py-3 bg-orange-600 hover:bg-orange-500 text-white font-bold rounded-xl transition-colors flex items-center gap-2 text-sm md:text-base"
                data-testid="backspace-button"
              >
                <Delete className="w-5 h-5" />
                ATRÁS
              </button>
              <button
                onClick={handleSpeak}
                disabled={!constructedPhrase.trim()}
                className="px-4 md:px-6 py-3 bg-teal-600 hover:bg-teal-500 disabled:bg-slate-700 disabled:cursor-not-allowed text-white font-bold rounded-xl transition-colors flex items-center gap-2 ml-auto text-sm md:text-base"
                data-testid="speak-button"
              >
                <Volume2 className="w-5 h-5" />
                HABLAR
              </button>
            </div>

            {/* Teclado Dactilológico */}
            <div className="bg-slate-900 rounded-2xl p-4 border border-slate-700">
              <div className="grid grid-cols-7 gap-2 md:gap-3">
                {signLanguageData.alphabet.map((item) => (
                  <button
                    key={item.letter}
                    onClick={() => handleLetterClick(item.letter)}
                    title={`Letra ${item.letter} - Dactilología LSE`}
                    data-testid={`letter-${item.letter}`}
                    className="p-3 md:p-4 bg-teal-700 hover:bg-teal-600 active:bg-teal-500 text-white font-bold text-lg md:text-xl rounded-lg transition-colors border border-teal-600 hover:border-teal-400"
                    aria-label={`Letra ${item.letter}`}
                  >
                    {item.letter}
                  </button>
                ))}
                {/* Botón Espacio */}
                <button
                  onClick={() => handleLetterClick(" ")}
                  title="Espacio"
                  data-testid="space-button"
                  className="p-3 md:p-4 bg-purple-700 hover:bg-purple-600 col-span-7 text-white font-bold rounded-lg transition-colors border border-purple-600 hover:border-purple-400"
                  aria-label="Espacio"
                >
                  ESPACIO
                </button>
              </div>
            </div>
          </section>

          {/* Abecedario Referencia Rápida */}
          <section>
            <h3 className="text-xl md:text-3xl font-bold text-purple-400 mb-4 uppercase tracking-widest">
              📖 Abecedario Dactilológico LSE (Referencia)
            </h3>
            <div className="grid grid-cols-4 md:grid-cols-7 gap-2 md:gap-3">
              {signLanguageData.alphabet.map((item) => (
                <div
                  key={item.letter}
                  className="bg-slate-800 rounded-xl p-3 border border-purple-600 hover:border-purple-400 transition-colors text-center"
                >
                  <img
                    src={item.image}
                    alt={`Letra ${item.letter} en Lengua de Signos Española`}
                    className="w-full h-20 md:h-24 object-cover rounded-lg mb-2 bg-slate-900"
                  />
                  <span className="text-lg md:text-xl font-bold text-purple-300 block">
                    {item.letter}
                  </span>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </Layout>
  );
}
