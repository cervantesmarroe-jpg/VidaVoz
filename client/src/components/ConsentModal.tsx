import { useState, useEffect } from "react";
import { ShieldCheck, Eye, Wifi, Server, HardDrive, X } from "lucide-react";

const STORAGE_KEY = "vozuci-consent-v1";

interface ConsentModalProps {
  onAccept: () => void;
}

export function ConsentModal({ onAccept }: ConsentModalProps) {
  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-stone-900/80 backdrop-blur-sm p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="consent-title"
    >
      <div className="bg-white rounded-3xl shadow-2xl max-w-2xl w-full max-h-[90dvh] overflow-y-auto flex flex-col">

        {/* Cabecera */}
        <div className="bg-teal-600 text-white px-8 py-7 rounded-t-3xl shrink-0">
          <div className="flex items-center gap-4 mb-2">
            <ShieldCheck className="w-10 h-10 shrink-0" />
            <h2 id="consent-title" className="text-2xl md:text-3xl font-black leading-tight">
              Privacidad y uso de cámara
            </h2>
          </div>
          <p className="text-teal-100 text-base md:text-lg">
            Antes de continuar, lea cómo protegemos sus datos.
          </p>
        </div>

        {/* Cuerpo */}
        <div className="px-8 py-6 flex flex-col gap-5">

          {/* Garantías */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Guarantee
              icon={<HardDrive className="w-6 h-6 text-teal-600" />}
              title="Procesamiento 100 % local"
              text="La cámara y el análisis ocular funcionan solo en su dispositivo. Ninguna imagen sale del navegador."
            />
            <Guarantee
              icon={<Server className="w-6 h-6 text-rose-500" />}
              title="Sin servidores externos"
              text="No se envía ningún dato biométrico a ningún servidor. La IA corre directamente en el navegador."
            />
            <Guarantee
              icon={<HardDrive className="w-6 h-6 text-amber-500" />}
              title="Datos volátiles"
              text="La calibración ocular se almacena solo en la memoria RAM. Al cerrar la pestaña, desaparece automáticamente."
            />
            <Guarantee
              icon={<Eye className="w-6 h-6 text-violet-600" />}
              title="Sin grabación ni almacenamiento"
              text="No se guardan imágenes, vídeos ni capturas de pantalla de la cámara en ningún momento."
            />
          </div>

          {/* Base legal */}
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 text-sm md:text-base text-stone-700 leading-relaxed">
            <p className="font-bold text-stone-800 mb-2">Base legal — RGPD art. 9.2.c</p>
            <p>
              El tratamiento de datos biométricos está justificado por el interés vital del paciente
              (comunicación asistiva en entorno clínico). El personal sanitario actúa como responsable
              del tratamiento en nombre del centro hospitalario.
            </p>
          </div>

          {/* Permiso de cámara */}
          <div className="flex items-start gap-3 text-stone-600 text-sm md:text-base">
            <Wifi className="w-5 h-5 text-teal-500 mt-0.5 shrink-0" />
            <p>
              Al aceptar, el navegador pedirá permiso para acceder a la cámara frontal.
              Puede revocar este permiso en cualquier momento desde la configuración del navegador.
            </p>
          </div>
        </div>

        {/* Pie con botones */}
        <div className="px-8 py-6 bg-stone-50 rounded-b-3xl flex flex-col sm:flex-row gap-3 shrink-0">
          <button
            data-testid="button-consent-accept"
            onClick={() => {
              sessionStorage.setItem(STORAGE_KEY, "accepted");
              onAccept();
            }}
            className="flex-1 flex items-center justify-center gap-3 bg-teal-600 hover:bg-teal-500 active:bg-teal-700 text-white font-black text-xl py-5 px-8 rounded-2xl transition-colors shadow-lg"
          >
            <ShieldCheck className="w-7 h-7 shrink-0" />
            Acepto y continúo
          </button>
          <button
            data-testid="button-consent-reject"
            onClick={() => window.history.back()}
            className="sm:w-auto flex items-center justify-center gap-2 bg-white hover:bg-stone-100 border-2 border-stone-300 text-stone-600 font-bold text-lg py-5 px-6 rounded-2xl transition-colors"
          >
            <X className="w-5 h-5" />
            No acepto
          </button>
        </div>
      </div>
    </div>
  );
}

function Guarantee({
  icon, title, text,
}: { icon: React.ReactNode; title: string; text: string }) {
  return (
    <div className="flex items-start gap-3 bg-stone-50 rounded-2xl p-4 border border-stone-100">
      <div className="mt-0.5 shrink-0">{icon}</div>
      <div>
        <p className="font-bold text-stone-800 text-sm md:text-base leading-tight mb-1">{title}</p>
        <p className="text-stone-600 text-sm leading-snug">{text}</p>
      </div>
    </div>
  );
}

// ── Hook que gestiona el estado del consentimiento ────────────────────────────
// Usa sessionStorage → volátil: desaparece al cerrar la pestaña (no localStorage)
export function useConsent() {
  const [accepted, setAccepted] = useState<boolean>(() => {
    return sessionStorage.getItem(STORAGE_KEY) === "accepted";
  });

  const accept  = () => setAccepted(true);
  const revoke  = () => {
    sessionStorage.removeItem(STORAGE_KEY);
    setAccepted(false);
  };

  return { accepted, accept, revoke };
}
