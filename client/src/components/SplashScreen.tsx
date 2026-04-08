import logoPath from "@assets/VidaVoz_1775644489589.png";

interface SplashScreenProps {
  visible: boolean;
}

/** Pantalla de carga a pantalla completa con el logo de VidaVoz.
 *  Se muestra mientras la app inicializa (modelos MediaPipe, etc.).
 *  Desaparece con un fade-out suave tras 2,5 s o cuando el padre la oculta. */
export function SplashScreen({ visible }: SplashScreenProps) {
  return (
    <div
      aria-hidden={!visible}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 99998,
        background: "#FFFFFF",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: "0px",
        pointerEvents: visible ? "all" : "none",
        opacity: visible ? 1 : 0,
        transition: "opacity 0.6s ease-out",
      }}
    >
      {/* Logo completo (símbolo + texto "VidaVoz") */}
      <img
        src={logoPath}
        alt="VidaVoz"
        style={{
          width: "min(220px, 55vw)",
          height: "auto",
          objectFit: "contain",
          filter: "drop-shadow(0 4px 24px rgba(74,222,128,0.18))",
          userSelect: "none",
          WebkitUserSelect: "none",
        }}
        draggable={false}
      />

      {/* Texto de estado */}
      <p
        style={{
          marginTop: "28px",
          fontFamily: "'Lexend', sans-serif",
          fontWeight: 500,
          fontSize: "0.82rem",
          color: "#9CA3AF",
          letterSpacing: "0.06em",
          textAlign: "center",
        }}
      >
        Iniciando…
      </p>

      {/* Barra de progreso animada */}
      <div
        style={{
          marginTop: "14px",
          width: "min(180px, 45vw)",
          height: "3px",
          borderRadius: "999px",
          background: "#E5E7EB",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            height: "100%",
            borderRadius: "999px",
            background: "linear-gradient(90deg, #86efac, #4ade80)",
            animation: "splash-progress 2.2s ease-in-out forwards",
          }}
        />
      </div>
    </div>
  );
}
