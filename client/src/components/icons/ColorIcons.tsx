import { CSSProperties } from "react";

// ─── Iconos a color, estilo emoji / 3D suave ────────────────────────────────
// Cada icono define todos sus colores con `fill` explícito para que ignore
// cualquier `color` o `strokeWidth` heredado por estilo del padre.
// Aceptan `style` (width/height) y `className`. ViewBox normalizado 0 0 64 64.

interface IconProps {
  style?: CSSProperties;
  className?: string;
  size?: number;
  "aria-hidden"?: boolean;
}

function withSize(style: CSSProperties | undefined, size?: number): CSSProperties | undefined {
  if (size == null) return style;
  return { width: size, height: size, ...style };
}

const baseSvg = (style?: CSSProperties): CSSProperties => ({
  display: "block",
  ...style,
  // El color heredado no debe teñir nada:
  color: undefined,
});

// ── 1. Aire / viento ────────────────────────────────────────────────────────
export function WindColor({ style, className, ...rest }: IconProps) {
  return (
    <svg viewBox="0 0 64 64" style={baseSvg(style)} className={className} {...rest}>
      <defs>
        <linearGradient id="cloudGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#E8F4FD" />
          <stop offset="1" stopColor="#A6D4F2" />
        </linearGradient>
      </defs>
      <ellipse cx="32" cy="42" rx="22" ry="6" fill="#000" opacity="0.08" />
      <path d="M16 30a10 10 0 0 1 19-3 8 8 0 0 1 13 6 7 7 0 0 1-3 13H18a8 8 0 0 1-2-16z" fill="url(#cloudGrad)" stroke="#5BA7D8" strokeWidth="1.5" />
      <path d="M8 22h12M4 28h10M10 34h8" stroke="#7FB8E0" strokeWidth="2.5" strokeLinecap="round" fill="none" />
      <path d="M44 14h12M50 8h8M48 20h10" stroke="#7FB8E0" strokeWidth="2.5" strokeLinecap="round" fill="none" />
    </svg>
  );
}

// ── 2. Dolor / rayo ─────────────────────────────────────────────────────────
export function PainColor({ style, className, ...rest }: IconProps) {
  return (
    <svg viewBox="0 0 64 64" style={baseSvg(style)} className={className} {...rest}>
      <defs>
        <linearGradient id="boltGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#FFF170" />
          <stop offset="0.6" stopColor="#FFC727" />
          <stop offset="1" stopColor="#F58F00" />
        </linearGradient>
      </defs>
      <circle cx="32" cy="32" r="26" fill="#FFE066" opacity="0.25" />
      <path d="M36 4 14 36h12L22 60l26-34H34z" fill="url(#boltGrad)" stroke="#B8650A" strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M30 14 22 30h6l-2 8" stroke="#FFF8C9" strokeWidth="2" strokeLinecap="round" fill="none" opacity="0.85" />
    </svg>
  );
}

// ── 3. Náuseas (cara verdosa) ───────────────────────────────────────────────
export function NauseaColor({ style, className, ...rest }: IconProps) {
  return (
    <svg viewBox="0 0 64 64" style={baseSvg(style)} className={className} {...rest}>
      <defs>
        <radialGradient id="faceNGrad" cx="0.5" cy="0.4" r="0.6">
          <stop offset="0" stopColor="#E5F490" />
          <stop offset="0.6" stopColor="#C7DE5C" />
          <stop offset="1" stopColor="#7BA63A" />
        </radialGradient>
      </defs>
      <circle cx="32" cy="34" r="26" fill="url(#faceNGrad)" stroke="#5C8228" strokeWidth="1.8" />
      <path d="M14 28c2-3 6-3 8 0M42 28c2-3 6-3 8 0" stroke="#3F5F18" strokeWidth="2.6" strokeLinecap="round" fill="none" />
      <path d="M22 46c2-3 6-3 8 0s6 3 8 0 6-3 8 0" stroke="#3F5F18" strokeWidth="2.8" strokeLinecap="round" fill="none" />
      <path d="M40 50c1 4-1 8-4 8s-5-3-4-7" fill="#7BC47F" stroke="#3F8245" strokeWidth="1.5" />
      <ellipse cx="32" cy="20" rx="10" ry="3" fill="#9BC25A" opacity="0.5" />
    </svg>
  );
}

// ── 4. Sed / vaso de agua ───────────────────────────────────────────────────
export function ThirstColor({ style, className, ...rest }: IconProps) {
  return (
    <svg viewBox="0 0 64 64" style={baseSvg(style)} className={className} {...rest}>
      <defs>
        <linearGradient id="glassGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#DFF2FF" />
          <stop offset="1" stopColor="#A4D6F2" />
        </linearGradient>
        <linearGradient id="waterGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#5FB8E6" />
          <stop offset="1" stopColor="#1E7AB8" />
        </linearGradient>
      </defs>
      <ellipse cx="32" cy="58" rx="18" ry="3" fill="#000" opacity="0.1" />
      <path d="M18 8h28l-3 48a4 4 0 0 1-4 4H25a4 4 0 0 1-4-4z" fill="url(#glassGrad)" stroke="#4A8AB0" strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M21 28h22l-2 28a3 3 0 0 1-3 3H26a3 3 0 0 1-3-3z" fill="url(#waterGrad)" />
      <path d="M24 32q4 -3 8 0t8 0" stroke="#FFFFFF" strokeWidth="1.8" fill="none" opacity="0.55" />
      <path d="M22 14c0 4 3 6 3 10" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" fill="none" opacity="0.7" />
    </svg>
  );
}

// ── 5. Familia / grupo de personas ──────────────────────────────────────────
export function FamilyColor({ style, className, ...rest }: IconProps) {
  return (
    <svg viewBox="0 0 64 64" style={baseSvg(style)} className={className} {...rest}>
      <defs>
        <linearGradient id="momGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#F8B6C8" /><stop offset="1" stopColor="#E07A9B" /></linearGradient>
        <linearGradient id="dadGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#9DC9F1" /><stop offset="1" stopColor="#3E82C2" /></linearGradient>
        <linearGradient id="kidGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#FFE08A" /><stop offset="1" stopColor="#F2A53C" /></linearGradient>
      </defs>
      <ellipse cx="32" cy="58" rx="28" ry="3" fill="#000" opacity="0.1" />
      {/* Padre (izq) */}
      <circle cx="16" cy="20" r="8" fill="#F4C9A1" stroke="#A36636" strokeWidth="1.4" />
      <path d="M4 56c0-10 6-16 12-16s12 6 12 16z" fill="url(#dadGrad)" stroke="#27568B" strokeWidth="1.4" />
      {/* Madre (der) */}
      <circle cx="48" cy="20" r="8" fill="#F8D2B5" stroke="#A36636" strokeWidth="1.4" />
      <path d="M36 56c0-10 6-16 12-16s12 6 12 16z" fill="url(#momGrad)" stroke="#A14063" strokeWidth="1.4" />
      {/* Niño (centro, delante) */}
      <circle cx="32" cy="34" r="6" fill="#FCDCB9" stroke="#A36636" strokeWidth="1.3" />
      <path d="M23 58c0-7 4-11 9-11s9 4 9 11z" fill="url(#kidGrad)" stroke="#9C6315" strokeWidth="1.3" />
      {/* Sonrisas */}
      <path d="M13 22q3 2 6 0M45 22q3 2 6 0M29 35q3 1.5 6 0" stroke="#5A3A1F" strokeWidth="1.2" fill="none" strokeLinecap="round" />
    </svg>
  );
}

// ── 6. WC / inodoro ─────────────────────────────────────────────────────────
export function ToiletColor({ style, className, ...rest }: IconProps) {
  return (
    <svg viewBox="0 0 64 64" style={baseSvg(style)} className={className} {...rest}>
      <defs>
        <linearGradient id="cisternGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#FFFFFF" /><stop offset="1" stopColor="#D6E0E6" /></linearGradient>
        <linearGradient id="bowlGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#FFFFFF" /><stop offset="1" stopColor="#C7D3DA" /></linearGradient>
      </defs>
      <ellipse cx="32" cy="60" rx="22" ry="2.5" fill="#000" opacity="0.1" />
      {/* Cisterna */}
      <rect x="20" y="6" width="24" height="20" rx="3" fill="url(#cisternGrad)" stroke="#7A8A95" strokeWidth="1.6" />
      <circle cx="40" cy="14" r="2.4" fill="#5BA7D8" stroke="#2F6E9C" strokeWidth="1" />
      {/* Taza */}
      <path d="M14 26h36l-3 18a8 8 0 0 1-8 7H25a8 8 0 0 1-8-7z" fill="url(#bowlGrad)" stroke="#7A8A95" strokeWidth="1.6" strokeLinejoin="round" />
      {/* Asiento */}
      <ellipse cx="32" cy="34" rx="14" ry="6" fill="#5BA7D8" opacity="0.35" />
      <ellipse cx="32" cy="34" rx="14" ry="6" fill="none" stroke="#3E82C2" strokeWidth="1.4" />
      {/* Base */}
      <path d="M22 51h20l2 9H20z" fill="#E0E8ED" stroke="#7A8A95" strokeWidth="1.4" />
    </svg>
  );
}

// ── 7. Frío/Calor — termómetro con sol y copo ──────────────────────────────
export function TempColor({ style, className, ...rest }: IconProps) {
  return (
    <svg viewBox="0 0 64 64" style={baseSvg(style)} className={className} {...rest}>
      <defs>
        <linearGradient id="thermoGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#5BB8F2" />
          <stop offset="0.5" stopColor="#FFE066" />
          <stop offset="1" stopColor="#E84545" />
        </linearGradient>
      </defs>
      {/* Sol */}
      <g transform="translate(8 10)">
        <circle cx="6" cy="6" r="5" fill="#FFC727" stroke="#D17800" strokeWidth="1.2" />
        <g stroke="#FFC727" strokeWidth="1.6" strokeLinecap="round">
          <path d="M6 -1v-3M6 12v3M-1 6h-3M12 6h3M1 1l-2-2M11 1l2-2M1 11l-2 2M11 11l2 2" />
        </g>
      </g>
      {/* Copo */}
      <g transform="translate(46 10)" stroke="#3E82C2" strokeWidth="1.5" strokeLinecap="round" fill="none">
        <path d="M6 -2v16M-2 6h16M0 0l12 12M12 0 0 12" />
        <circle cx="6" cy="6" r="1.4" fill="#7FB8E0" stroke="none" />
      </g>
      {/* Termómetro */}
      <rect x="28" y="20" width="8" height="28" rx="4" fill="#F0F4F7" stroke="#5C7280" strokeWidth="1.6" />
      <rect x="29.5" y="22" width="5" height="24" rx="2.5" fill="url(#thermoGrad)" />
      <circle cx="32" cy="52" r="7" fill="#E84545" stroke="#A02525" strokeWidth="1.6" />
      <circle cx="30" cy="50" r="1.6" fill="#FFFFFF" opacity="0.7" />
    </svg>
  );
}

// ── 8. Miedo / corazón azul con pulso ───────────────────────────────────────
export function FearColor({ style, className, ...rest }: IconProps) {
  return (
    <svg viewBox="0 0 64 64" style={baseSvg(style)} className={className} {...rest}>
      <defs>
        <linearGradient id="heartBlueGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#7CC9F2" />
          <stop offset="1" stopColor="#1E5DA0" />
        </linearGradient>
      </defs>
      <ellipse cx="32" cy="58" rx="22" ry="2.5" fill="#000" opacity="0.1" />
      <path d="M32 56s-22-12-22-28a12 12 0 0 1 22-7 12 12 0 0 1 22 7c0 16-22 28-22 28z" fill="url(#heartBlueGrad)" stroke="#0E3866" strokeWidth="1.8" strokeLinejoin="round" />
      {/* Brillo */}
      <path d="M18 18c2-3 6-5 9-4" stroke="#D8EEFB" strokeWidth="2.4" strokeLinecap="round" fill="none" opacity="0.85" />
      {/* Línea de pulso */}
      <path d="M14 36h8l3-6 4 12 4-8 3 4h14" stroke="#FFFFFF" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </svg>
  );
}

// ── 9. Hambre / plato con cubiertos ─────────────────────────────────────────
export function HungerColor({ style, className, ...rest }: IconProps) {
  return (
    <svg viewBox="0 0 64 64" style={baseSvg(style)} className={className} {...rest}>
      <defs>
        <radialGradient id="plateGrad" cx="0.5" cy="0.4" r="0.7">
          <stop offset="0" stopColor="#FFFFFF" />
          <stop offset="1" stopColor="#C9D3D9" />
        </radialGradient>
      </defs>
      {/* Tenedor */}
      <g stroke="#9C7B3A" strokeWidth="1.4" fill="#E5C77A">
        <rect x="6" y="8" width="3" height="14" rx="0.5" />
        <rect x="11" y="8" width="3" height="14" rx="0.5" />
        <path d="M5 22h11v6a3 3 0 0 1-3 3h-5a3 3 0 0 1-3-3z" />
        <rect x="9" y="30" width="3" height="26" rx="1.2" fill="#C29A45" />
      </g>
      {/* Cuchillo */}
      <g stroke="#7A8A95" strokeWidth="1.4">
        <path d="M55 6c-3 6-3 16 0 22h-3c-3-6-3-16 0-22z" fill="#E6ECF0" />
        <rect x="51" y="28" width="6" height="28" rx="1.2" fill="#7A4F22" stroke="#4F3315" />
      </g>
      {/* Plato */}
      <ellipse cx="32" cy="44" rx="22" ry="6" fill="#9CB1BD" />
      <ellipse cx="32" cy="42" rx="22" ry="6" fill="url(#plateGrad)" stroke="#5C7280" strokeWidth="1.4" />
      <ellipse cx="32" cy="42" rx="15" ry="4" fill="#FCF3CF" stroke="#A98A2C" strokeWidth="1" />
      {/* Comida */}
      <circle cx="26" cy="40" r="3" fill="#E84545" stroke="#A02525" strokeWidth="1" />
      <circle cx="34" cy="40.5" r="2.6" fill="#7BC47F" stroke="#3F8245" strokeWidth="1" />
      <ellipse cx="40" cy="42" rx="3.4" ry="2.2" fill="#F2A53C" stroke="#9C6315" strokeWidth="1" />
      {/* Vapor */}
      <path d="M22 30c0-4 4-4 4-8M32 28c0-4 4-4 4-8M42 30c0-4 4-4 4-8" stroke="#C9D3D9" strokeWidth="2" strokeLinecap="round" fill="none" opacity="0.75" />
    </svg>
  );
}

// ── 10. Luz / bombilla encendida ────────────────────────────────────────────
export function LightColor({ style, className, ...rest }: IconProps) {
  return (
    <svg viewBox="0 0 64 64" style={baseSvg(style)} className={className} {...rest}>
      <defs>
        <radialGradient id="bulbGrad" cx="0.5" cy="0.4" r="0.6">
          <stop offset="0" stopColor="#FFF8B0" />
          <stop offset="0.6" stopColor="#FFD744" />
          <stop offset="1" stopColor="#E89A00" />
        </radialGradient>
      </defs>
      {/* Resplandor */}
      <circle cx="32" cy="26" r="26" fill="#FFE066" opacity="0.3" />
      {/* Rayos */}
      <g stroke="#FFC727" strokeWidth="2.4" strokeLinecap="round">
        <path d="M32 2v6M32 50v4M8 26h6M50 26h6M14 8l4 4M50 8l-4 4M14 44l4-4M50 44l-4-4" />
      </g>
      {/* Bulbo */}
      <path d="M32 8a16 16 0 0 1 10 28c-2 2-3 4-3 7H25c0-3-1-5-3-7A16 16 0 0 1 32 8z" fill="url(#bulbGrad)" stroke="#A06A00" strokeWidth="1.8" />
      {/* Filamento */}
      <path d="M27 28c2-2 3 2 5 0s3 2 5 0" stroke="#A06A00" strokeWidth="1.4" fill="none" />
      {/* Casquillo */}
      <rect x="24" y="46" width="16" height="5" rx="1" fill="#A8B3BD" stroke="#5C7280" strokeWidth="1.2" />
      <rect x="25" y="51" width="14" height="3" rx="1" fill="#7A8A95" stroke="#5C7280" strokeWidth="1.2" />
      <rect x="27" y="56" width="10" height="4" rx="1.5" fill="#5C7280" />
      {/* Brillo */}
      <ellipse cx="26" cy="18" rx="3" ry="5" fill="#FFFFFF" opacity="0.55" transform="rotate(-25 26 18)" />
    </svg>
  );
}

// ── 11. Aspiración / aire azul en movimiento ────────────────────────────────
export function SuctionColor({ style, className, ...rest }: IconProps) {
  return (
    <svg viewBox="0 0 64 64" style={baseSvg(style)} className={className} {...rest}>
      <defs>
        <linearGradient id="suctionGrad" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#A4D6F2" />
          <stop offset="1" stopColor="#3E82C2" />
        </linearGradient>
      </defs>
      <ellipse cx="32" cy="56" rx="22" ry="3" fill="#000" opacity="0.08" />
      {/* Tres ondas/curvas de aire */}
      <path d="M6 18c10-6 22-6 32 0 6 3 12 3 18 0" stroke="url(#suctionGrad)" strokeWidth="5" strokeLinecap="round" fill="none" />
      <path d="M6 32c10-6 22-6 32 0 6 3 12 3 18 0" stroke="url(#suctionGrad)" strokeWidth="5" strokeLinecap="round" fill="none" opacity="0.85" />
      <path d="M6 46c10-6 22-6 32 0 6 3 12 3 18 0" stroke="url(#suctionGrad)" strokeWidth="5" strokeLinecap="round" fill="none" opacity="0.7" />
      {/* Flechas de movimiento */}
      <path d="M52 12 56 18 50 20" stroke="#1E5DA0" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <path d="M52 26 56 32 50 34" stroke="#1E5DA0" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" opacity="0.85" />
      <path d="M52 40 56 46 50 48" stroke="#1E5DA0" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" opacity="0.7" />
    </svg>
  );
}

// ── 12. Posición / flechas horizontales ─────────────────────────────────────
export function PositionColor({ style, className, ...rest }: IconProps) {
  return (
    <svg viewBox="0 0 64 64" style={baseSvg(style)} className={className} {...rest}>
      <defs>
        <linearGradient id="bedGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#FFE08A" /><stop offset="1" stopColor="#F2A53C" />
        </linearGradient>
      </defs>
      <ellipse cx="32" cy="56" rx="24" ry="3" fill="#000" opacity="0.1" />
      {/* Cama */}
      <rect x="6" y="32" width="52" height="16" rx="3" fill="url(#bedGrad)" stroke="#9C6315" strokeWidth="1.6" />
      <rect x="6" y="32" width="14" height="10" rx="2" fill="#FCEFCB" stroke="#9C6315" strokeWidth="1.4" />
      <rect x="4" y="48" width="4" height="10" fill="#9C6315" />
      <rect x="56" y="48" width="4" height="10" fill="#9C6315" />
      {/* Flechas izq / der */}
      <path d="M14 20 6 26l8 6" stroke="#1E5DA0" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <path d="M50 20l8 6-8 6" stroke="#1E5DA0" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <path d="M14 26h36" stroke="#3E82C2" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

// ── 13. Música / radio retro ────────────────────────────────────────────────
export function MusicColor({ style, className, ...rest }: IconProps) {
  return (
    <svg viewBox="0 0 64 64" style={baseSvg(style)} className={className} {...rest}>
      <defs>
        <linearGradient id="radioGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#F4A261" /><stop offset="1" stopColor="#B5651D" />
        </linearGradient>
      </defs>
      <ellipse cx="32" cy="56" rx="24" ry="3" fill="#000" opacity="0.1" />
      {/* Cuerpo radio */}
      <rect x="8" y="22" width="48" height="30" rx="4" fill="url(#radioGrad)" stroke="#5A3210" strokeWidth="1.8" />
      {/* Antena */}
      <path d="M48 22 56 8" stroke="#5C7280" strokeWidth="2.2" strokeLinecap="round" />
      <circle cx="56" cy="8" r="2" fill="#A8B3BD" stroke="#5C7280" strokeWidth="1" />
      {/* Altavoz */}
      <circle cx="20" cy="37" r="9" fill="#FCF3CF" stroke="#5A3210" strokeWidth="1.6" />
      <circle cx="20" cy="37" r="5" fill="#5A3210" />
      <circle cx="18" cy="35" r="1.4" fill="#FFF" opacity="0.6" />
      {/* Dial / pantalla */}
      <rect x="33" y="28" width="20" height="8" rx="1.5" fill="#3E5560" stroke="#1F2C32" strokeWidth="1" />
      <path d="M36 32h14" stroke="#7BC47F" strokeWidth="1.6" />
      <circle cx="38" cy="46" r="2.4" fill="#E84545" stroke="#7C1D1D" strokeWidth="1" />
      <circle cx="46" cy="46" r="2.4" fill="#7BC47F" stroke="#2D5C2D" strokeWidth="1" />
      {/* Notas musicales */}
      <g fill="#3E82C2">
        <circle cx="50" cy="14" r="2" /><rect x="51.4" y="6" width="1.4" height="8" />
      </g>
      <g fill="#E07A9B">
        <circle cx="6" cy="18" r="2" /><rect x="7.4" y="10" width="1.4" height="8" />
      </g>
    </svg>
  );
}

// ── 14. Reloj de pared ──────────────────────────────────────────────────────
export function ClockColor({ style, className, ...rest }: IconProps) {
  return (
    <svg viewBox="0 0 64 64" style={baseSvg(style)} className={className} {...rest}>
      <defs>
        <radialGradient id="clockFace" cx="0.5" cy="0.4" r="0.6">
          <stop offset="0" stopColor="#FFFFFF" /><stop offset="1" stopColor="#E0E6EB" />
        </radialGradient>
      </defs>
      <circle cx="32" cy="34" r="26" fill="#7A4F22" stroke="#3E2710" strokeWidth="2" />
      <circle cx="32" cy="34" r="22" fill="url(#clockFace)" stroke="#5C7280" strokeWidth="1.4" />
      {/* Marcadores 12, 3, 6, 9 */}
      <text x="32" y="20" textAnchor="middle" fontSize="7" fontWeight="700" fill="#3E2710" fontFamily="Lexend, sans-serif">12</text>
      <text x="48" y="37" textAnchor="middle" fontSize="7" fontWeight="700" fill="#3E2710" fontFamily="Lexend, sans-serif">3</text>
      <text x="32" y="54" textAnchor="middle" fontSize="7" fontWeight="700" fill="#3E2710" fontFamily="Lexend, sans-serif">6</text>
      <text x="16" y="37" textAnchor="middle" fontSize="7" fontWeight="700" fill="#3E2710" fontFamily="Lexend, sans-serif">9</text>
      {/* Manecillas */}
      <line x1="32" y1="34" x2="32" y2="20" stroke="#1F2C32" strokeWidth="2.6" strokeLinecap="round" />
      <line x1="32" y1="34" x2="44" y2="38" stroke="#1F2C32" strokeWidth="2" strokeLinecap="round" />
      <line x1="32" y1="34" x2="28" y2="48" stroke="#E84545" strokeWidth="1.4" strokeLinecap="round" />
      <circle cx="32" cy="34" r="2" fill="#1F2C32" />
      {/* Campanitas */}
      <circle cx="14" cy="10" r="3.5" fill="#E0C770" stroke="#9C6315" strokeWidth="1.2" />
      <circle cx="50" cy="10" r="3.5" fill="#E0C770" stroke="#9C6315" strokeWidth="1.2" />
    </svg>
  );
}

// ── 15. Urgente / sirena ────────────────────────────────────────────────────
export function SirenColor({ style, className, ...rest }: IconProps) {
  return (
    <svg viewBox="0 0 64 64" style={baseSvg(style)} className={className} {...rest}>
      <defs>
        <radialGradient id="sirenGrad" cx="0.5" cy="0.3" r="0.7">
          <stop offset="0" stopColor="#FF8A80" /><stop offset="1" stopColor="#B71C1C" />
        </radialGradient>
      </defs>
      {/* Resplandor */}
      <circle cx="32" cy="22" r="22" fill="#FF6B6B" opacity="0.25" />
      {/* Rayos de luz */}
      <g stroke="#FFB347" strokeWidth="2.4" strokeLinecap="round">
        <path d="M32 2v6M8 22h6M50 22h6M14 8l4 4M50 8l-4 4" />
      </g>
      {/* Cúpula */}
      <path d="M14 32a18 18 0 0 1 36 0z" fill="url(#sirenGrad)" stroke="#7C1D1D" strokeWidth="1.8" />
      <ellipse cx="22" cy="22" rx="4" ry="6" fill="#FFFFFF" opacity="0.5" transform="rotate(-25 22 22)" />
      {/* Base */}
      <rect x="10" y="32" width="44" height="8" rx="2" fill="#3E5560" stroke="#1F2C32" strokeWidth="1.6" />
      <rect x="14" y="40" width="36" height="14" rx="2" fill="#5C7280" stroke="#1F2C32" strokeWidth="1.6" />
      <circle cx="22" cy="47" r="2" fill="#FFE066" stroke="#A06A00" strokeWidth="1" />
      <circle cx="42" cy="47" r="2" fill="#FFE066" stroke="#A06A00" strokeWidth="1" />
    </svg>
  );
}

// ── 16. Mensajes / burbuja chat con sonrisa ─────────────────────────────────
export function ChatColor({ style, className, ...rest }: IconProps) {
  return (
    <svg viewBox="0 0 64 64" style={baseSvg(style)} className={className} {...rest}>
      <defs>
        <linearGradient id="chatGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#7CC9F2" /><stop offset="1" stopColor="#1E7AB8" />
        </linearGradient>
      </defs>
      <path d="M10 12h44a4 4 0 0 1 4 4v26a4 4 0 0 1-4 4H28l-12 10v-10h-6a4 4 0 0 1-4-4V16a4 4 0 0 1 4-4z" fill="url(#chatGrad)" stroke="#0E3866" strokeWidth="1.8" strokeLinejoin="round" />
      {/* Brillo */}
      <path d="M14 16q4 -2 12 0" stroke="#D8EEFB" strokeWidth="2" fill="none" strokeLinecap="round" opacity="0.7" />
      {/* Cara emoji */}
      <circle cx="22" cy="28" r="2.4" fill="#FFFFFF" />
      <circle cx="42" cy="28" r="2.4" fill="#FFFFFF" />
      <path d="M22 36q10 8 20 0" stroke="#FFFFFF" strokeWidth="2.6" strokeLinecap="round" fill="none" />
      {/* Punto de notificación */}
      <circle cx="52" cy="14" r="6" fill="#E84545" stroke="#7C1D1D" strokeWidth="1.5" />
      <text x="52" y="17" textAnchor="middle" fontSize="8" fontWeight="900" fill="#FFFFFF" fontFamily="Lexend, sans-serif">1</text>
    </svg>
  );
}

// ── 17. Escalas / barras 3D ─────────────────────────────────────────────────
export function BarsColor({ style, className, ...rest }: IconProps) {
  return (
    <svg viewBox="0 0 64 64" style={baseSvg(style)} className={className} {...rest}>
      <defs>
        <linearGradient id="bar1" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor="#7BC47F" /><stop offset="1" stopColor="#3F8245" /></linearGradient>
        <linearGradient id="bar2" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor="#FFE066" /><stop offset="1" stopColor="#D17800" /></linearGradient>
        <linearGradient id="bar3" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor="#FF8A80" /><stop offset="1" stopColor="#B71C1C" /></linearGradient>
      </defs>
      <ellipse cx="32" cy="58" rx="24" ry="2.5" fill="#000" opacity="0.12" />
      {/* Eje */}
      <path d="M8 8v48h48" stroke="#5C7280" strokeWidth="2" strokeLinecap="round" fill="none" />
      {/* Barra 1 (corta verde) */}
      <rect x="14" y="38" width="10" height="18" rx="1.5" fill="url(#bar1)" stroke="#27551A" strokeWidth="1.2" />
      <polygon points="14,38 18,34 28,34 24,38" fill="#9DD89F" stroke="#27551A" strokeWidth="1" />
      <polygon points="24,38 28,34 28,52 24,56" fill="#5A9D5F" stroke="#27551A" strokeWidth="1" />
      {/* Barra 2 (media ámbar) */}
      <rect x="28" y="26" width="10" height="30" rx="1.5" fill="url(#bar2)" stroke="#7A4200" strokeWidth="1.2" />
      <polygon points="28,26 32,22 42,22 38,26" fill="#FFEE9A" stroke="#7A4200" strokeWidth="1" />
      <polygon points="38,26 42,22 42,52 38,56" fill="#B5821F" stroke="#7A4200" strokeWidth="1" />
      {/* Barra 3 (alta roja) */}
      <rect x="42" y="14" width="10" height="42" rx="1.5" fill="url(#bar3)" stroke="#7C1D1D" strokeWidth="1.2" />
      <polygon points="42,14 46,10 56,10 52,14" fill="#FFB6B0" stroke="#7C1D1D" strokeWidth="1" />
      <polygon points="52,14 56,10 56,52 52,56" fill="#A02525" stroke="#7C1D1D" strokeWidth="1" />
    </svg>
  );
}

// ── 18. Teclado de colores ──────────────────────────────────────────────────
export function KeyboardColor({ style, className, ...rest }: IconProps) {
  return (
    <svg viewBox="0 0 64 64" style={baseSvg(style)} className={className} {...rest}>
      <ellipse cx="32" cy="54" rx="26" ry="2.5" fill="#000" opacity="0.1" />
      <rect x="4" y="14" width="56" height="36" rx="5" fill="#3E5560" stroke="#1F2C32" strokeWidth="1.8" />
      {/* Teclas fila 1 */}
      <rect x="9" y="19"  width="8" height="8" rx="1.5" fill="#7CC9F2" stroke="#1E5DA0" strokeWidth="1" />
      <rect x="19" y="19" width="8" height="8" rx="1.5" fill="#FFE066" stroke="#A06A00" strokeWidth="1" />
      <rect x="29" y="19" width="8" height="8" rx="1.5" fill="#7BC47F" stroke="#27551A" strokeWidth="1" />
      <rect x="39" y="19" width="8" height="8" rx="1.5" fill="#F8B6C8" stroke="#A14063" strokeWidth="1" />
      <rect x="49" y="19" width="8" height="8" rx="1.5" fill="#C9B0F2" stroke="#5A3FA0" strokeWidth="1" />
      {/* Fila 2 */}
      <rect x="11" y="29" width="8" height="8" rx="1.5" fill="#FFB347" stroke="#9C5A00" strokeWidth="1" />
      <rect x="21" y="29" width="8" height="8" rx="1.5" fill="#A6D4F2" stroke="#3E82C2" strokeWidth="1" />
      <rect x="31" y="29" width="8" height="8" rx="1.5" fill="#FCEFCB" stroke="#9C6315" strokeWidth="1" />
      <rect x="41" y="29" width="8" height="8" rx="1.5" fill="#9DD89F" stroke="#3F8245" strokeWidth="1" />
      <rect x="51" y="29" width="6" height="8" rx="1.5" fill="#F4A6C0" stroke="#A14063" strokeWidth="1" />
      {/* Espaciadora */}
      <rect x="17" y="39" width="30" height="6" rx="1.5" fill="#E0E6EB" stroke="#5C7280" strokeWidth="1" />
    </svg>
  );
}

// ── 19. Acción: Reproducir / altavoz ────────────────────────────────────────
export function SpeakColor({ style, className, size, ...rest }: IconProps) {
  return (
    <svg viewBox="0 0 64 64" style={baseSvg(withSize(style, size))} className={className} {...rest}>
      <defs>
        <linearGradient id="speakGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#7CC9F2" /><stop offset="1" stopColor="#1E5DA0" />
        </linearGradient>
      </defs>
      <path d="M8 24h12L34 12v40L20 40H8z" fill="url(#speakGrad)" stroke="#0E3866" strokeWidth="2" strokeLinejoin="round" />
      <path d="M40 20c4 4 4 20 0 24" stroke="#1E5DA0" strokeWidth="3" strokeLinecap="round" fill="none" />
      <path d="M46 14c8 6 8 30 0 36" stroke="#1E5DA0" strokeWidth="3" strokeLinecap="round" fill="none" opacity="0.7" />
      <path d="M52 8c12 8 12 40 0 48" stroke="#1E5DA0" strokeWidth="3" strokeLinecap="round" fill="none" opacity="0.45" />
    </svg>
  );
}

// ── 20. Acción: Borrar / papelera ───────────────────────────────────────────
export function ClearColor({ style, className, size, ...rest }: IconProps) {
  return (
    <svg viewBox="0 0 64 64" style={baseSvg(withSize(style, size))} className={className} {...rest}>
      <defs>
        <linearGradient id="trashGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#FF8A80" /><stop offset="1" stopColor="#B71C1C" />
        </linearGradient>
      </defs>
      <rect x="10" y="14" width="44" height="6" rx="2" fill="#5C7280" stroke="#1F2C32" strokeWidth="1.6" />
      <rect x="24" y="8" width="16" height="6" rx="1.5" fill="#A8B3BD" stroke="#1F2C32" strokeWidth="1.6" />
      <path d="M14 20h36l-3 36a4 4 0 0 1-4 4H21a4 4 0 0 1-4-4z" fill="url(#trashGrad)" stroke="#7C1D1D" strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M24 28v24M32 28v24M40 28v24" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" opacity="0.7" />
    </svg>
  );
}

// ── 21. Acción: Backspace ───────────────────────────────────────────────────
export function BackspaceColor({ style, className, size, ...rest }: IconProps) {
  return (
    <svg viewBox="0 0 64 64" style={baseSvg(withSize(style, size))} className={className} {...rest}>
      <defs>
        <linearGradient id="bsGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#FFB347" /><stop offset="1" stopColor="#9C5A00" />
        </linearGradient>
      </defs>
      <path d="M22 12h32a4 4 0 0 1 4 4v32a4 4 0 0 1-4 4H22L4 32z" fill="url(#bsGrad)" stroke="#5A3210" strokeWidth="2" strokeLinejoin="round" />
      <path d="M28 22 44 42M44 22 28 42" stroke="#FFFFFF" strokeWidth="3.5" strokeLinecap="round" />
    </svg>
  );
}

// ── 23. Higiene / ducha ─────────────────────────────────────────────────────
export function HygieneColor({ style, className, ...rest }: IconProps) {
  return (
    <svg viewBox="0 0 64 64" style={baseSvg(style)} className={className} {...rest}>
      <defs>
        <linearGradient id="showerHeadGrd" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#C5D9E8" /><stop offset="1" stopColor="#8FAFC4" />
        </linearGradient>
        <linearGradient id="showerDropGrd" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#AED6F1" /><stop offset="1" stopColor="#1E88E5" />
        </linearGradient>
      </defs>
      <ellipse cx="32" cy="61" rx="22" ry="2.5" fill="#000" opacity="0.1" />
      {/* Brazo de la ducha */}
      <path d="M10 8 Q10 22 22 22" stroke="#8FAFC4" strokeWidth="6" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      {/* Cabezal de ducha */}
      <circle cx="30" cy="22" r="13" fill="url(#showerHeadGrd)" stroke="#5C7280" strokeWidth="2" />
      <circle cx="30" cy="22" r="9" fill="#DDE8F2" stroke="#8FA8B8" strokeWidth="1" />
      {/* Agujeros 3×3 */}
      <circle cx="25" cy="18" r="1.5" fill="#2E86C1" />
      <circle cx="30" cy="18" r="1.5" fill="#2E86C1" />
      <circle cx="35" cy="18" r="1.5" fill="#2E86C1" />
      <circle cx="25" cy="22" r="1.5" fill="#2E86C1" />
      <circle cx="30" cy="22" r="1.5" fill="#2E86C1" />
      <circle cx="35" cy="22" r="1.5" fill="#2E86C1" />
      <circle cx="25" cy="26" r="1.5" fill="#2E86C1" />
      <circle cx="30" cy="26" r="1.5" fill="#2E86C1" />
      <circle cx="35" cy="26" r="1.5" fill="#2E86C1" />
      {/* Chorros de agua */}
      <line x1="25" y1="35" x2="22" y2="43" stroke="#85C1E9" strokeWidth="2" strokeLinecap="round" />
      <line x1="30" y1="35" x2="29" y2="45" stroke="#85C1E9" strokeWidth="2" strokeLinecap="round" />
      <line x1="35" y1="35" x2="37" y2="43" stroke="#85C1E9" strokeWidth="2" strokeLinecap="round" />
      {/* Gotas (teardrops) */}
      <path d="M22 43 C22 43 19.5 49 19.5 52 C19.5 54.5 20.6 56 22 56 C23.4 56 24.5 54.5 24.5 52 C24.5 49 22 43 22 43z" fill="url(#showerDropGrd)" />
      <path d="M29 45 C29 45 26.5 51 26.5 54 C26.5 56.5 27.6 58 29 58 C30.4 58 31.5 56.5 31.5 54 C31.5 51 29 45 29 45z" fill="url(#showerDropGrd)" />
      <path d="M37 43 C37 43 34.5 49 34.5 52 C34.5 54.5 35.6 56 37 56 C38.4 56 39.5 54.5 39.5 52 C39.5 49 37 43 37 43z" fill="url(#showerDropGrd)" />
      {/* Brillo */}
      <ellipse cx="24" cy="16" rx="3.5" ry="2" fill="#FFFFFF" opacity="0.45" transform="rotate(-15 24 16)" />
    </svg>
  );
}

// ── 24. Calendario / día ─────────────────────────────────────────────────────
export function CalendarColor({ style, className, ...rest }: IconProps) {
  return (
    <svg viewBox="0 0 64 64" style={baseSvg(style)} className={className} {...rest}>
      <defs>
        <linearGradient id="calHeaderGrd" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#FFB74D" /><stop offset="1" stopColor="#E65100" />
        </linearGradient>
        <linearGradient id="calBodyGrd" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#FFFFFF" /><stop offset="1" stopColor="#FFF8EE" />
        </linearGradient>
      </defs>
      <ellipse cx="32" cy="62" rx="22" ry="2" fill="#000" opacity="0.1" />
      {/* Cuerpo */}
      <rect x="6" y="14" width="52" height="46" rx="5" fill="url(#calBodyGrd)" stroke="#E65100" strokeWidth="2" />
      {/* Cabecera naranja */}
      <path d="M6 19 L6 14 Q6 14 11 14 L53 14 Q58 14 58 19 L58 26 L6 26 Z" fill="url(#calHeaderGrd)" />
      {/* Argollas */}
      <rect x="17" y="8" width="7" height="12" rx="3.5" fill="#CFD8DC" stroke="#607D8B" strokeWidth="1.5" />
      <rect x="40" y="8" width="7" height="12" rx="3.5" fill="#CFD8DC" stroke="#607D8B" strokeWidth="1.5" />
      {/* Cuadrícula de días — fila 1 */}
      <circle cx="16" cy="37" r="3" fill="#ECEFF1" />
      <circle cx="25" cy="37" r="3" fill="#ECEFF1" />
      <circle cx="34" cy="37" r="5" fill="#1E88E5" stroke="#1565C0" strokeWidth="1.4" />
      <circle cx="43" cy="37" r="3" fill="#ECEFF1" />
      <circle cx="52" cy="37" r="3" fill="#ECEFF1" />
      {/* Fila 2 */}
      <circle cx="16" cy="50" r="3" fill="#ECEFF1" />
      <circle cx="25" cy="50" r="3" fill="#ECEFF1" />
      <circle cx="34" cy="50" r="3" fill="#ECEFF1" />
      <circle cx="43" cy="50" r="3" fill="#ECEFF1" />
      <circle cx="52" cy="50" r="3" fill="#ECEFF1" />
      {/* Interrogación en el día resaltado */}
      <text x="34" y="40" textAnchor="middle" fontSize="6" fontWeight="900" fill="#FFFFFF" fontFamily="Lexend, sans-serif">?</text>
      {/* Brillo cabecera */}
      <ellipse cx="22" cy="19" rx="7" ry="2.5" fill="#FFFFFF" opacity="0.25" />
    </svg>
  );
}

// ── 25. Horario de visitas — reloj + siluetas ────────────────────────────────
export function VisitsColor({ style, className, ...rest }: IconProps) {
  return (
    <svg viewBox="0 0 64 64" style={baseSvg(style)} className={className} {...rest}>
      <defs>
        <radialGradient id="visitClockFace" cx="0.5" cy="0.4" r="0.6">
          <stop offset="0" stopColor="#FFFFFF" /><stop offset="1" stopColor="#EDE7F6" />
        </radialGradient>
        <linearGradient id="visitBodyGrd" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#CE93D8" /><stop offset="1" stopColor="#7B1FA2" />
        </linearGradient>
      </defs>
      <ellipse cx="32" cy="62" rx="22" ry="2" fill="#000" opacity="0.1" />
      {/* Caja exterior del reloj */}
      <circle cx="32" cy="26" r="20" fill="#7B1FA2" stroke="#4A0072" strokeWidth="2" />
      {/* Esfera */}
      <circle cx="32" cy="26" r="16" fill="url(#visitClockFace)" stroke="#AB47BC" strokeWidth="1.2" />
      {/* Marcadores */}
      <text x="32" y="14" textAnchor="middle" fontSize="6" fontWeight="700" fill="#4A148C" fontFamily="Lexend, sans-serif">12</text>
      <text x="44" y="29" textAnchor="middle" fontSize="6" fontWeight="700" fill="#4A148C" fontFamily="Lexend, sans-serif">3</text>
      <text x="32" y="44" textAnchor="middle" fontSize="6" fontWeight="700" fill="#4A148C" fontFamily="Lexend, sans-serif">6</text>
      <text x="20" y="29" textAnchor="middle" fontSize="6" fontWeight="700" fill="#4A148C" fontFamily="Lexend, sans-serif">9</text>
      {/* Manecillas: 15:00 */}
      <line x1="32" y1="26" x2="32" y2="14" stroke="#1F0030" strokeWidth="2.5" strokeLinecap="round" />
      <line x1="32" y1="26" x2="44" y2="26" stroke="#1F0030" strokeWidth="2" strokeLinecap="round" />
      <circle cx="32" cy="26" r="2" fill="#1F0030" />
      {/* Campanitas */}
      <circle cx="18" cy="8" r="3" fill="#CE93D8" stroke="#7B1FA2" strokeWidth="1" />
      <circle cx="46" cy="8" r="3" fill="#CE93D8" stroke="#7B1FA2" strokeWidth="1" />
      {/* Visitantes — dos siluetas */}
      <circle cx="20" cy="54" r="5" fill="#FCDCB9" stroke="#A36636" strokeWidth="1.2" />
      <path d="M10 64 C10 58 14 55 20 55 C26 55 30 58 30 64z" fill="url(#visitBodyGrd)" stroke="#4A0072" strokeWidth="1.2" />
      <circle cx="44" cy="54" r="5" fill="#F8D2B5" stroke="#A36636" strokeWidth="1.2" />
      <path d="M34 64 C34 58 38 55 44 55 C50 55 54 58 54 64z" fill="url(#visitBodyGrd)" stroke="#4A0072" strokeWidth="1.2" />
      {/* Brillo */}
      <ellipse cx="24" cy="17" rx="5" ry="2.5" fill="#FFFFFF" opacity="0.3" transform="rotate(-20 24 17)" />
    </svg>
  );
}

// ── 22. Acción: Espacio ─────────────────────────────────────────────────────
export function SpaceColor({ style, className, size, ...rest }: IconProps) {
  return (
    <svg viewBox="0 0 64 64" style={baseSvg(withSize(style, size))} className={className} {...rest}>
      <defs>
        <linearGradient id="spaceGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#9DD89F" /><stop offset="1" stopColor="#3F8245" />
        </linearGradient>
      </defs>
      <rect x="6" y="22" width="52" height="20" rx="4" fill="url(#spaceGrad)" stroke="#27551A" strokeWidth="2" />
      <rect x="6" y="42" width="52" height="6" rx="2" fill="#27551A" />
      <path d="M14 32h36" stroke="#FFFFFF" strokeWidth="3" strokeLinecap="round" />
      <path d="M14 28v8M50 28v8" stroke="#FFFFFF" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}
