import { WireframeLayout } from "../WireframeLayout";

const SCALES = [
  { title: "EVA · Dolor (0–10)" },
  { title: "Borg · Disnea (0–10)" },
  { title: "Ansiedad (0–10)" },
];

export default function WireframeScales() {
  return (
    <WireframeLayout>
      {SCALES.map((s) => (
        <div className="wf-scale" key={s.title}>
          <div className="wf-scale-title">{s.title}</div>
          <div className="wf-scale-row">
            {Array.from({ length: 11 }).map((_, i) => (
              <div
                key={i}
                className="wf-scale-cell"
                data-testid={`wf-scale-${s.title.split(" ")[0].toLowerCase()}-${i}`}
              >
                {i}
              </div>
            ))}
          </div>
        </div>
      ))}
    </WireframeLayout>
  );
}
