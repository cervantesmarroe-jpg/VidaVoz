import { FullscreenLayout } from "@/components/FullscreenLayout";
import { QuadButton, QuadGrid } from "@/components/QuadButton";
import { useTTS } from "@/hooks/use-tts";
import { Smile, Meh, Frown, AlertTriangle } from "lucide-react";

const LEVELS = [
  {
    label: "SIN",
    sublabel: "DOLOR",
    phrase: "No tengo dolor. Me encuentro sin molestias.",
    icon: Smile,
    bg: "linear-gradient(160deg, #22c55e 0%, #15803d 100%)",
    border: "3px solid #86efac",
    glow: "0 0 50px rgba(34,197,94,0.6)",
    testId: "button-scale-sin-dolor",
  },
  {
    label: "DOLOR",
    sublabel: "LEVE",
    phrase: "Tengo un dolor leve. Es soportable, entre uno y tres.",
    icon: Meh,
    bg: "linear-gradient(160deg, #a3e635 0%, #4d7c0f 100%)",
    border: "3px solid #d9f99d",
    glow: "0 0 50px rgba(163,230,53,0.55)",
    testId: "button-scale-leve",
  },
  {
    label: "DOLOR",
    sublabel: "MODERADO",
    phrase: "Tengo un dolor moderado. Entre cuatro y seis sobre diez.",
    icon: Frown,
    bg: "linear-gradient(160deg, #f97316 0%, #c2410c 100%)",
    border: "3px solid #fdba74",
    glow: "0 0 50px rgba(249,115,22,0.6)",
    testId: "button-scale-moderado",
  },
  {
    label: "DOLOR",
    sublabel: "SEVERO",
    phrase: "Tengo un dolor severo. Muy intenso, entre siete y diez. Necesito ayuda.",
    icon: AlertTriangle,
    bg: "linear-gradient(160deg, #dc2626 0%, #7f1d1d 100%)",
    border: "3px solid #fca5a5",
    glow: "0 0 60px rgba(220,38,38,0.7)",
    priority: true,
    testId: "button-scale-severo",
  },
];

export default function Scales() {
  const { speak } = useTTS();

  return (
    <FullscreenLayout>
      <QuadGrid>
        {LEVELS.map((lvl) => (
          <QuadButton
            key={lvl.sublabel}
            label={lvl.label}
            sublabel={lvl.sublabel}
            phrase={lvl.phrase}
            icon={lvl.icon}
            bg={lvl.bg}
            border={lvl.border}
            glow={lvl.glow}
            priority={lvl.priority}
            testId={lvl.testId}
            onActivate={() => speak(lvl.phrase)}
          />
        ))}
      </QuadGrid>
    </FullscreenLayout>
  );
}
