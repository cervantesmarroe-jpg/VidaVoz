import { FullscreenLayout } from "@/components/FullscreenLayout";
import { QuadButton, QuadGrid } from "@/components/QuadButton";
import { useTTS } from "@/hooks/use-tts";
import { ALargeSmall, BookA, BookMarked, BookOpen } from "lucide-react";

const GROUPS = [
  {
    label: "A — G",
    sublabel: "",
    letters: ["A", "B", "C", "D", "E", "F", "G"],
    phrase: "Quiero decir una letra entre la A y la G: A B C D E F G",
    icon: BookA,
    bg: "linear-gradient(160deg, #6366f1 0%, #3730a3 100%)",
    border: "3px solid #a5b4fc",
    glow: "0 0 50px rgba(99,102,241,0.6)",
    testId: "button-key-ag",
  },
  {
    label: "H — N",
    sublabel: "",
    letters: ["H", "I", "J", "K", "L", "M", "N"],
    phrase: "Quiero decir una letra entre la H y la N: H I J K L M N",
    icon: BookOpen,
    bg: "linear-gradient(160deg, #8b5cf6 0%, #5b21b6 100%)",
    border: "3px solid #c4b5fd",
    glow: "0 0 50px rgba(139,92,246,0.6)",
    testId: "button-key-hn",
  },
  {
    label: "O — T",
    sublabel: "",
    letters: ["O", "P", "Q", "R", "S", "T"],
    phrase: "Quiero decir una letra entre la O y la T: O P Q R S T",
    icon: BookMarked,
    bg: "linear-gradient(160deg, #0ea5e9 0%, #0369a1 100%)",
    border: "3px solid #7dd3fc",
    glow: "0 0 50px rgba(14,165,233,0.6)",
    testId: "button-key-ot",
  },
  {
    label: "U — Z",
    sublabel: "",
    letters: ["U", "V", "W", "X", "Y", "Z", "Ñ"],
    phrase: "Quiero decir una letra entre la U y la Z: U V W X Y Z Ñ",
    icon: ALargeSmall,
    bg: "linear-gradient(160deg, #14b8a6 0%, #0f766e 100%)",
    border: "3px solid #5eead4",
    glow: "0 0 50px rgba(20,184,166,0.6)",
    testId: "button-key-uz",
  },
];

export default function Keyboard() {
  const { speak } = useTTS();

  return (
    <FullscreenLayout>
      <QuadGrid>
        {GROUPS.map((g) => (
          <QuadButton
            key={g.label}
            label={g.label}
            phrase={g.phrase}
            icon={g.icon}
            bg={g.bg}
            border={g.border}
            glow={g.glow}
            testId={g.testId}
            onActivate={() => speak(g.phrase)}
          >
            {/* Muestra las letras del grupo */}
            <div style={{
              display: "flex", flexWrap: "wrap", justifyContent: "center",
              gap: "5px", marginTop: "6px",
            }}>
              {g.letters.map((l) => (
                <span key={l} style={{
                  fontFamily: "'Lexend',sans-serif",
                  fontSize: "clamp(0.9rem, 2vw, 1.4rem)",
                  fontWeight: 800,
                  color: "rgba(255,255,255,0.85)",
                  background: "rgba(255,255,255,0.15)",
                  borderRadius: "6px",
                  padding: "2px 7px",
                  letterSpacing: "0.05em",
                }}>
                  {l}
                </span>
              ))}
            </div>
          </QuadButton>
        ))}
      </QuadGrid>
    </FullscreenLayout>
  );
}
