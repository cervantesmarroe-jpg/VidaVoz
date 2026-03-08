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
      <div className="h-full p-6 md:p-8 flex flex-col">
        <h2 className="text-3xl md:text-5xl font-bold text-red-500 mb-8 uppercase tracking-widest text-center md:text-left">
          Necesidades Urgentes
        </h2>
        
        <div className="flex-1 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
          {URGENT_MESSAGES.map((msg, i) => {
            const Icon = msg.icon;
            return (
              <GazeButton 
                key={i} 
                theme="red" 
                speakText={msg.phrase}
                className="min-h-[160px]"
              >
                <Icon className="w-20 h-20 md:w-24 md:h-24 mb-2 drop-shadow-lg" />
                <span className="text-3xl md:text-4xl font-black uppercase tracking-wide leading-tight">
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
