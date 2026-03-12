import { Layout } from "@/components/Layout";
import { GazeButton } from "@/components/GazeButton";
import { 
  AlertOctagon, 
  Wind, 
  Stethoscope, 
  Vibrate
} from "lucide-react";

const URGENT_MESSAGES = [
  { text: "TENGO DOLOR", icon: AlertOctagon, phrase: "Tengo mucho dolor. Necesito ayuda." },
  { text: "ME FALTA EL AIRE", icon: Wind, phrase: "Me falta el aire. Me ahogo." },
  { text: "NECESITO ASPIRACIÓN", icon: Stethoscope, phrase: "Necesito aspiración de secreciones." },
  { text: "TENGO NÁUSEAS", icon: Vibrate, phrase: "Tengo náuseas. Ganas de vomitar." },
];

export default function Urgent() {
  return (
    <Layout>
      <div className="h-full p-4 md:p-6 flex flex-col">
        <h2 className="text-2xl md:text-4xl font-bold text-rose-600 mb-6 uppercase tracking-widest text-center">
          Necesidades Urgentes
        </h2>
        
        <div className="flex-1 grid grid-cols-2 gap-4 md:gap-6">
          {URGENT_MESSAGES.map((msg, i) => {
            const Icon = msg.icon;
            return (
              <GazeButton 
                key={i} 
                theme="red" 
                speakText={msg.phrase}
                className="min-h-[200px] md:min-h-[280px]"
              >
                <Icon className="w-32 h-32 md:w-48 md:h-48 mb-4 drop-shadow-lg" />
                <span className="text-2xl md:text-5xl font-black uppercase tracking-wide leading-tight text-center">
                  {msg.text}
                </span>
              </GazeButton>
            );
          })}
        </div>
      </div>
    </Layout>
  );
}
