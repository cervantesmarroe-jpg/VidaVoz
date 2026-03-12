import { useState } from "react";
import { Layout } from "@/components/Layout";
import { useTTS } from "@/hooks/use-tts";
import { Smile, Frown, Angry, Wind, ActivitySquare } from "lucide-react";

export default function Scales() {
  const [painLevel, setPainLevel] = useState(0);
  const [dyspneaLevel, setDyspneaLevel] = useState(0);
  const { speak } = useTTS();

  const handlePainSpeak = () => {
    speak(`Mi nivel de dolor es ${painLevel} sobre 10.`);
  };

  const handleDyspneaSpeak = () => {
    speak(`Mi nivel de falta de aire es ${dyspneaLevel} sobre 10.`);
  };

  const getPainColor = (level: number) => {
    if (level <= 3) return "text-green-600";
    if (level <= 6) return "text-amber-500";
    return "text-rose-600";
  };

  const getPainIcon = (level: number) => {
    if (level <= 3) return <Smile className={`w-24 h-24 ${getPainColor(level)}`} />;
    if (level <= 6) return <Frown className={`w-24 h-24 ${getPainColor(level)}`} />;
    return <Angry className={`w-24 h-24 ${getPainColor(level)}`} />;
  };

  return (
    <Layout>
      <div className="h-full p-6 md:p-12 flex flex-col gap-12 max-w-5xl mx-auto">
        
        {/* Pain Scale */}
        <section className="bg-white border-2 border-amber-200 rounded-3xl p-8 shadow-lg">
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-3xl md:text-5xl font-bold text-amber-600 uppercase tracking-widest flex items-center gap-4">
              <ActivitySquare className="w-12 h-12" />
              Dolor (EVA)
            </h2>
            <button 
              data-gaze-target="true"
              onClick={handlePainSpeak}
              className="bg-amber-500 hover:bg-amber-400 text-white px-8 py-4 rounded-2xl font-bold text-2xl shadow-md transition-transform active:scale-95"
            >
              DECIR
            </button>
          </div>

          <div className="flex flex-col items-center gap-12">
            <div className="flex justify-between w-full items-end px-4">
              <div className="text-center">
                <Smile className="w-16 h-16 text-green-500 mb-2 opacity-60" />
                <span className="text-2xl font-bold text-stone-500">0 - Nada</span>
              </div>
              
              <div className="flex flex-col items-center scale-125 pb-4">
                {getPainIcon(painLevel)}
                <span className={`text-6xl font-black mt-4 ${getPainColor(painLevel)}`}>
                  {painLevel}
                </span>
              </div>

              <div className="text-center">
                <Angry className="w-16 h-16 text-rose-500 mb-2 opacity-60" />
                <span className="text-2xl font-bold text-stone-500">10 - Peor</span>
              </div>
            </div>

            <input 
              type="range" 
              min="0" 
              max="10" 
              step="1"
              value={painLevel}
              onChange={(e) => setPainLevel(parseInt(e.target.value))}
              className="gaze-slider"
              data-gaze-target="true"
            />
          </div>
        </section>

        {/* Dyspnea Scale */}
        <section className="bg-white border-2 border-sky-200 rounded-3xl p-8 shadow-lg">
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-3xl md:text-5xl font-bold text-sky-600 uppercase tracking-widest flex items-center gap-4">
              <Wind className="w-12 h-12" />
              Falta de Aire
            </h2>
            <button 
              data-gaze-target="true"
              onClick={handleDyspneaSpeak}
              className="bg-sky-500 hover:bg-sky-400 text-white px-8 py-4 rounded-2xl font-bold text-2xl shadow-md transition-transform active:scale-95"
            >
              DECIR
            </button>
          </div>

          <div className="flex flex-col items-center gap-12">
            <div className="flex justify-between w-full px-4">
              <span className="text-2xl font-bold text-stone-500">0 - Respiro bien</span>
              <span className="text-5xl font-black text-sky-600">{dyspneaLevel}</span>
              <span className="text-2xl font-bold text-stone-500">10 - Me ahogo</span>
            </div>

            <input 
              type="range" 
              min="0" 
              max="10" 
              step="1"
              value={dyspneaLevel}
              onChange={(e) => setDyspneaLevel(parseInt(e.target.value))}
              className="gaze-slider"
              data-gaze-target="true"
              style={{
                background: `linear-gradient(to right, #e0f2fe, #0284c7 ${dyspneaLevel * 10}%, #e2e8f0 ${dyspneaLevel * 10}%)`
              }}
            />
          </div>
        </section>

      </div>
    </Layout>
  );
}
