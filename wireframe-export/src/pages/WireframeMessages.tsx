import { WireframeLayout } from "../WireframeLayout";
import { WireframeButton } from "../WireframeButton";

const MSGS = [
  { id: "familia",    label: "QUIERO VER A MI FAMILIA" },
  { id: "wc",         label: "IR AL WC" },
  { id: "frio-calor", label: "TENGO FRÍO / CALOR" },
  { id: "miedo",      label: "TENGO MIEDO / NERVIOS" },
  { id: "hambre",     label: "TENGO HAMBRE" },
  { id: "luz",        label: "LUZ: ENCENDER / APAGAR" },
  { id: "aspiracion", label: "NECESITO ASPIRACIÓN" },
  { id: "posicion",   label: "CAMBIAR DE POSICIÓN" },
  { id: "musica",     label: "QUIERO LA RADIO / MÚSICA" },
  { id: "hora",       label: "¿QUÉ HORA ES?" },
];

export default function WireframeMessages() {
  return (
    <WireframeLayout>
      <div className="wf-grid-msg">
        {MSGS.map((m) => (
          <WireframeButton key={m.id} label={m.label} iconText="ICON" />
        ))}
      </div>
    </WireframeLayout>
  );
}
