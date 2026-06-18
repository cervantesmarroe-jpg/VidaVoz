import { QuadButton, QuadGrid } from "@/components/QuadButton";
import { useTTS } from "@/hooks/use-tts";
import { WindColor, PainColor, NauseaColor, ThirstColor } from "@/components/icons/ColorIcons";

const URGENT = [
  {
    label: "ME FALTA",
    sublabel: "EL AIRE",
    phrase: "Me falta el aire. Me ahogo. Necesito ayuda urgente.",
    icon: WindColor,
    bg: "#F2D7D5",
    border: "4px solid #D9A8A5",
    glow: "0 6px 24px rgba(192,57,43,0.22)",
    textColor: "#7B2020",
    priority: true,
    testId: "button-urgent-el-aire",
  },
  {
    label: "TENGO",
    sublabel: "DOLOR",
    phrase: "Tengo mucho dolor. Necesito ayuda.",
    icon: PainColor,
    bg: "#FEEFDC",
    border: "2px solid #F5D5A0",
    glow: "0 6px 20px rgba(180,100,0,0.18)",
    textColor: "#7A4200",
    testId: "button-urgent-dolor",
  },
  {
    label: "TENGO",
    sublabel: "NÁUSEAS",
    phrase: "Tengo náuseas. Tengo ganas de vomitar.",
    icon: NauseaColor,
    bg: "#D5F5E3",
    border: "2px solid #A8E6C8",
    glow: "0 6px 20px rgba(25,130,60,0.18)",
    textColor: "#145A30",
    testId: "button-urgent-nauseas",
  },
  {
    label: "TENGO",
    sublabel: "SED",
    phrase: "Tengo mucha sed. Necesito agua.",
    icon: ThirstColor,
    bg: "#FCF3CF",
    border: "2px solid #F0DC80",
    glow: "0 6px 20px rgba(160,120,0,0.18)",
    textColor: "#6B4C00",
    testId: "button-urgent-sed",
  },
];

export default function Urgent() {
  const { speak } = useTTS();

  return (
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
          textColor={msg.textColor}
          priority={msg.priority}
          testId={msg.testId}
          onActivate={() => speak(msg.phrase)}
        />
      ))}
    </QuadGrid>
  );
}
