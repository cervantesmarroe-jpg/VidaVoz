import { Layout } from "@/components/Layout";
import { GazeButton } from "@/components/GazeButton";
import { 
  Heart, 
  ThumbsUp, 
  ThumbsDown, 
  Eye, 
  Ear, 
  Hand,
  GlassWater,
  Utensils,
  Pill,
  Bed,
  Bath
} from "lucide-react";

const SIGN_CONCEPTS = [
  { text: "SÍ / DE ACUERDO", icon: ThumbsUp, phrase: "Sí. Estoy de acuerdo." },
  { text: "NO / MAL", icon: ThumbsDown, phrase: "No. No me parece bien." },
  { text: "GRACIAS", icon: Heart, phrase: "Muchas gracias." },
  { text: "NECESITO AYUDA", icon: Hand, phrase: "Por favor, necesito ayuda." },
  { text: "MIRAR / VER", icon: Eye, phrase: "Quiero ver algo." },
  { text: "ESCUCHAR", icon: Ear, phrase: "No escucho bien, o quiero escuchar algo." },
  { text: "AGUA / BEBER", icon: GlassWater, phrase: "Quiero agua." },
  { text: "COMIDA", icon: Utensils, phrase: "Comida." },
  { text: "MEDICINA", icon: Pill, phrase: "Medicina." },
  { text: "DORMIR", icon: Bed, phrase: "Quiero dormir." },
  { text: "BAÑO", icon: Bath, phrase: "Baño." },
];

export default function Signs() {
  return (
    <Layout>
      <div className="h-full p-6 md:p-8 flex flex-col">
        <h2 className="text-3xl md:text-5xl font-bold text-teal-400 mb-8 uppercase tracking-widest">
          Lengua de Signos / Conceptos Básicos
        </h2>
        
        <div className="flex-1 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {SIGN_CONCEPTS.map((concept, i) => {
            const Icon = concept.icon;
            return (
              <GazeButton 
                key={i} 
                theme="turquoise" 
                speakText={concept.phrase}
                className="min-h-[160px]"
              >
                <Icon className="w-16 h-16 md:w-20 md:h-20 mb-3" strokeWidth={1.5} />
                <span className="text-2xl md:text-3xl font-bold text-center leading-tight">
                  {concept.text}
                </span>
              </GazeButton>
            );
          })}
        </div>
      </div>
    </Layout>
  );
}
