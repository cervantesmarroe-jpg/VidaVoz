import { FullscreenLayout } from "@/components/FullscreenLayout";
import { QuadButton, QuadGrid } from "@/components/QuadButton";
import { useTTS } from "@/hooks/use-tts";
import { Wind, Zap, Frown, GlassWater } from "lucide-react";

const URGENT = [
  {
    label: "ME FALTA",
    sublabel: "EL AIRE",
    phrase: "Me falta el aire. Me ahogo. Necesito ayuda urgente.",
    icon: Wind,
    bg: "linear-gradient(160deg, #D9534F 0%, #a03030 100%)",
    border: "4px solid #ff9a98",
    glow: "0 0 60px rgba(217,83,79,0.7)",
    priority: true,
    testId: "button-urgent-el-aire",
  },
  {
    label: "TENGO",
    sublabel: "DOLOR",
    phrase: "Tengo mucho dolor. Necesito ayuda.",
    icon: Zap,
    bg: "linear-gradient(160deg, #F0AD4E 0%, #b87a1a 100%)",
    border: "3px solid #ffd08a",
    glow: "0 0 50px rgba(240,173,78,0.6)",
    testId: "button-urgent-dolor",
  },
  {
    label: "TENGO",
    sublabel: "NÁUSEAS",
    phrase: "Tengo náuseas. Tengo ganas de vomitar.",
    icon: Frown,
    bg: "linear-gradient(160deg, #5CB85C 0%, #3d8b3d 100%)",
    border: "3px solid #96e096",
    glow: "0 0 50px rgba(92,184,92,0.6)",
    testId: "button-urgent-nauseas",
  },
  {
    label: "TENGO",
    sublabel: "SED",
    phrase: "Tengo mucha sed. Necesito agua.",
    icon: GlassWater,
    bg: "linear-gradient(160deg, #5BC0DE 0%, #2080a0 100%)",
    border: "3px solid #9ae0f8",
    glow: "0 0 50px rgba(91,192,222,0.6)",
    testId: "button-urgent-sed",
  },
];

export default function Urgent() {
  const { speak } = useTTS();

  return (
    <FullscreenLayout>
      <QuadGrid>
        {URGENT.map((msg) => (
          <QuadButton
            key={msg.sublabel}
            label={msg.label}
            sublabel={msg.sublabel}
            phrase={msg.phrase}
            icon={msg.icon}
            bg={msg.bg}
            border={msg.border}
            glow={msg.glow}
            priority={msg.priority}
            testId={msg.testId}
            onActivate={() => speak(msg.phrase)}
          />
        ))}
      </QuadGrid>
    </FullscreenLayout>
  );
}
