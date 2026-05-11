import React from "react";

interface Props {
  size?: number;
  variant?: "light" | "dark";
  showTag?: boolean;
}

/**
 * Lockup horizontal: icono (círculo + documento + rayo) + texto "OrdenYa"
 * Diseñado para barras de navegación. Para el logo completo usar /logo_ordenya_pro.svg.
 */
export const OrdenYaWordmark: React.FC<Props> = ({ size = 38, variant = "light", showTag = false }) => {
  const fg = variant === "light" ? "#fff" : "#26215C";
  const tagColor = variant === "light" ? "rgba(255,255,255,0.5)" : "rgba(38,33,92,0.55)";
  return (
    <div style={{ display: "inline-flex", alignItems: "center", gap: 12 }}>
      <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
        <defs>
          <linearGradient id="oy-bg" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#534AB7" />
            <stop offset="100%" stopColor="#3C3489" />
          </linearGradient>
          <linearGradient id="oy-amber" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#F5B045" />
            <stop offset="100%" stopColor="#BA7517" />
          </linearGradient>
        </defs>
        <circle cx="32" cy="32" r="30" fill="url(#oy-bg)" />
        <circle cx="32" cy="32" r="28" fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="0.8" />
        {/* documento */}
        <g transform="translate(15 13)">
          <rect x="0" y="0" width="24" height="30" rx="3.5" fill="rgba(255,255,255,0.14)" stroke="rgba(255,255,255,0.30)" strokeWidth="0.8" />
          <polygon points="18,0 24,6 18,6" fill="#26215C" opacity="0.5" />
          <rect x="4" y="10" width="14" height="1.8" rx="0.9" fill="#fff" opacity="0.85" />
          <rect x="4" y="14" width="10" height="1.8" rx="0.9" fill="#fff" opacity="0.45" />
          <rect x="4" y="18" width="12" height="1.8" rx="0.9" fill="#fff" opacity="0.45" />
        </g>
        {/* círculo ámbar + rayo */}
        <circle cx="44" cy="22" r="11" fill="url(#oy-amber)" stroke="rgba(186,117,23,0.5)" strokeWidth="0.6" />
        <polygon points="45.4,15 41,22 44.6,22 43,29 48.4,21.4 44.8,21.4" fill="#fff" />
      </svg>
      <div style={{ display: "flex", flexDirection: "column", lineHeight: 1 }}>
        <span style={{
          fontFamily: "var(--font-display)",
          fontWeight: 800,
          fontSize: size * 0.55,
          letterSpacing: "-0.03em",
          color: fg,
        }}>
          Orden<span style={{ color: "#EF9F27" }}>Ya</span>
        </span>
        {showTag && (
          <span style={{
            fontFamily: "var(--font)",
            fontSize: size * 0.22,
            fontWeight: 700,
            letterSpacing: "0.22em",
            textTransform: "uppercase",
            color: tagColor,
            marginTop: 5,
          }}>
            Órdenes de trabajo
          </span>
        )}
      </div>
    </div>
  );
};
