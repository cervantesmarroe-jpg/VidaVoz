import { WireframeLayout } from "../WireframeLayout";

const ROWS = [
  ["Q","W","E","R","T","Y","U","I","O","P"],
  ["A","S","D","F","G","H","J","K","L","Ñ"],
  ["Z","X","C","V","B","N","M",".",",","␣"],
];

export default function WireframeKeyboard() {
  return (
    <WireframeLayout>
      <div className="wf-kb">
        <div className="wf-kb-display">[ Texto del paciente · placeholder ]</div>
        <div className="wf-kb-rows">
          {ROWS.map((row, ri) => (
            <div className="wf-kb-row" key={ri}>
              {row.map((k) => (
                <div
                  key={k}
                  className="wf-kb-key"
                  data-testid={`wf-key-${k}`}
                >
                  {k}
                </div>
              ))}
            </div>
          ))}
          <div className="wf-kb-row">
            <div className="wf-kb-key" style={{ maxWidth: 140 }}>HABLAR</div>
            <div className="wf-kb-key" style={{ maxWidth: 100 }}>BORRAR</div>
            <div className="wf-kb-key" style={{ maxWidth: 100 }}>LIMPIAR</div>
          </div>
        </div>
      </div>
    </WireframeLayout>
  );
}
