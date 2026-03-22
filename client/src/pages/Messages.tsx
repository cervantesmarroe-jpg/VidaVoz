import { FullscreenLayout } from "@/components/FullscreenLayout";
import { QuadButton, QuadGrid } from "@/components/QuadButton";
import { useTTS } from "@/hooks/use-tts";
import { Snowflake, Flame, Lightbulb, BedDouble } from "lucide-react";

const MSGS = [
  {
    label: "TENGO",
    sublabel: "FRÍO",
    phrase: "Tengo frío. Necesito más ropa o manta.",
    icon: Snowflake,
    bg: "linear-gradient(160deg, #3b82f6 0%, #1d4ed8 100%)",
    border: "3px solid #93c5fd",
    glow: "0 0 50px rgba(59,130,246,0.6)",
    testId: "button-msg-frio",
  },
  {
    label: "TENGO",
    sublabel: "CALOR",
    phrase: "Tengo calor. Necesito menos ropa o ventilación.",
    icon: Flame,
    bg: "linear-gradient(160deg, #f97316 0%, #c2410c 100%)",
    border: "3px solid #fdba74",
    glow: "0 0 50px rgba(249,115,22,0.6)",
    testId: "button-msg-calor",
  },
  {
    label: "LA",
    sublabel: "LUZ",
    phrase: "Por favor, encienda o apague la luz.",
    icon: Lightbulb,
    bg: "linear-gradient(160deg, #eab308 0%, #a16207 100%)",
    border: "3px solid #fde047",
    glow: "0 0 50px rgba(234,179,8,0.6)",
    testId: "button-msg-luz",
  },
  {
    label: "MOVER",
    sublabel: "ALMOHADA",
    phrase: "Por favor, mueva o ajuste mi almohada. Estoy incómodo.",
    icon: BedDouble,
    bg: "linear-gradient(160deg, #8b5cf6 0%, #5b21b6 100%)",
    border: "3px solid #c4b5fd",
    glow: "0 0 50px rgba(139,92,246,0.6)",
    testId: "button-msg-almohada",
  },
];

export default function Messages() {
  const { speak } = useTTS();

  return (
    <FullscreenLayout>
      <QuadGrid>
        {MSGS.map((m) => (
          <QuadButton
            key={m.sublabel}
            label={m.label}
            sublabel={m.sublabel}
            phrase={m.phrase}
            icon={m.icon}
            bg={m.bg}
            border={m.border}
            glow={m.glow}
            testId={m.testId}
            onActivate={() => speak(m.phrase)}
          />
        ))}
      </QuadGrid>
    </FullscreenLayout>
  );
}
