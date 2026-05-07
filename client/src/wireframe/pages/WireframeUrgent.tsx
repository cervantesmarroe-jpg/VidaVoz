import { WireframeLayout } from "../WireframeLayout";
import { WireframeButton } from "../WireframeButton";

const URGENT = [
  { label: "ME FALTA", sublabel: "EL AIRE", iconText: "AIRE", priority: true },
  { label: "TENGO",    sublabel: "DOLOR",   iconText: "DOLOR" },
  { label: "TENGO",    sublabel: "NÁUSEAS", iconText: "NÁUS." },
  { label: "TENGO",    sublabel: "SED",     iconText: "SED" },
];

export default function WireframeUrgent() {
  return (
    <WireframeLayout>
      <div className="wf-grid-quad">
        {URGENT.map((u) => (
          <WireframeButton
            key={u.sublabel}
            label={u.label}
            sublabel={u.sublabel}
            iconText={u.iconText}
            priority={u.priority}
            testId={`wf-urgent-${u.sublabel.toLowerCase()}`}
          />
        ))}
      </div>
    </WireframeLayout>
  );
}
