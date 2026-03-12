import { useState } from "react";
import { Layout } from "@/components/Layout";
import { useTTS } from "@/hooks/use-tts";
import { Delete, Volume2, XSquare } from "lucide-react";

const KEYBOARD_ROWS = [
  ["Q", "W", "E", "R", "T", "Y", "U", "I", "O", "P"],
  ["A", "S", "D", "F", "G", "H", "J", "K", "L", "Ñ"],
  ["Z", "X", "C", "V", "B", "N", "M", ",", ".", "?"]
];

export default function Keyboard() {
  const [text, setText] = useState("");
  const { speak } = useTTS();

  const handleKeyPress = (key: string) => {
    setText((prev) => prev + key);
  };

  const handleSpace = () => {
    setText((prev) => prev + " ");
  };

  const handleDelete = () => {
    setText((prev) => prev.slice(0, -1));
  };

  const handleClear = () => {
    setText("");
  };

  const handleSpeak = () => {
    if (text.trim()) {
      speak(text);
    }
  };

  return (
    <Layout>
      <div className="h-full p-4 md:p-8 flex flex-col gap-6">
        
        {/* Output Area */}
        <div className="bg-white border-2 border-violet-200 rounded-3xl p-6 shadow-lg flex flex-col gap-4">
          <div className="flex justify-between items-center border-b border-stone-100 pb-4">
            <h2 className="text-2xl font-bold text-violet-600 tracking-widest uppercase">Teclado</h2>
            <button 
              onClick={handleClear}
              data-gaze-target="true"
              className="flex items-center gap-2 text-stone-400 hover:text-rose-500 transition-colors p-2"
            >
              <XSquare className="w-8 h-8" />
              <span className="text-xl font-bold">BORRAR TODO</span>
            </button>
          </div>
          
          <div className="min-h-[120px] text-4xl md:text-5xl font-medium tracking-wide break-words p-4 bg-stone-50 rounded-2xl border border-stone-200 text-stone-800">
            {text || <span className="text-stone-400 italic">Escriba su mensaje...</span>}
            <span className="animate-pulse inline-block ml-1 w-4 h-10 bg-violet-400 align-middle"></span>
          </div>

          <button
            onClick={handleSpeak}
            data-gaze-target="true"
            disabled={!text.trim()}
            className="w-full bg-gradient-to-r from-teal-500 to-teal-700 hover:from-teal-400 hover:to-teal-600 disabled:opacity-40 text-white font-black text-3xl md:text-4xl py-6 rounded-2xl shadow-lg flex items-center justify-center gap-4 transition-transform active:scale-95"
          >
            <Volume2 className="w-10 h-10" />
            HABLAR
          </button>
        </div>

        {/* Keyboard Area */}
        <div className="flex-1 flex flex-col gap-3 md:gap-4 max-w-6xl mx-auto w-full">
          {KEYBOARD_ROWS.map((row, rowIndex) => (
            <div key={rowIndex} className={`flex justify-center gap-2 md:gap-3 w-full ${rowIndex === 1 ? 'px-8 md:px-16' : ''} ${rowIndex === 2 ? 'px-16 md:px-32' : ''}`}>
              {row.map((key) => (
                <button
                  key={key}
                  onClick={() => handleKeyPress(key)}
                  data-gaze-target="true"
                  className="flex-1 bg-white hover:bg-violet-100 border-2 border-stone-200 hover:border-violet-300 rounded-2xl min-h-[80px] md:min-h-[100px] flex items-center justify-center text-3xl md:text-5xl font-bold text-stone-700 transition-colors shadow-sm active:scale-95 relative overflow-hidden"
                >
                  <span className="z-10">{key}</span>
                  <div className="gaze-progress-bar bg-violet-400"></div>
                </button>
              ))}
            </div>
          ))}
          
          {/* Action Row */}
          <div className="flex justify-center gap-3 md:gap-4 w-full mt-2">
            <button
              onClick={handleSpace}
              data-gaze-target="true"
              className="flex-[3] bg-white hover:bg-stone-100 border-2 border-stone-200 rounded-2xl min-h-[80px] md:min-h-[100px] flex items-center justify-center text-3xl font-bold transition-colors shadow-sm active:scale-95 relative overflow-hidden"
            >
              <span className="z-10 tracking-widest text-stone-500">ESPACIO</span>
              <div className="gaze-progress-bar bg-stone-400"></div>
            </button>
            <button
              onClick={handleDelete}
              data-gaze-target="true"
              className="flex-[1] bg-white hover:bg-rose-100 border-2 border-stone-200 hover:border-rose-300 text-rose-500 rounded-2xl min-h-[80px] md:min-h-[100px] flex items-center justify-center transition-colors shadow-sm active:scale-95 relative overflow-hidden"
            >
              <Delete className="w-12 h-12 z-10" />
              <div className="gaze-progress-bar bg-rose-400"></div>
            </button>
          </div>
        </div>

      </div>
    </Layout>
  );
}
