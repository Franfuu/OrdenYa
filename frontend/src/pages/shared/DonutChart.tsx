import React from "react";

const COLORS: Record<string, string> = {
  taller: "#534AB7",
  instalacion: "#1D9E75",
};
const LABELS: Record<string, string> = {
  taller: "Taller",
  instalacion: "Instalación",
};

interface Props {
  orders: any[];
}

export const DonutChart: React.FC<Props> = ({ orders }) => {
  const safeOrders = Array.isArray(orders) ? orders : [];
  const counts: Record<string, number> = {};
  safeOrders.forEach(o => {
    (o.departments ?? []).forEach((d: any) => {
      const slug = d.department?.slug;
      if (slug) counts[slug] = (counts[slug] ?? 0) + 1;
    });
  });

  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  const entries = Object.entries(counts);

  const R = 50, CX = 70, CY = 70, STROKE = 18;
  let cumulative = 0;
  const segments = entries.map(([slug, count]) => {
    const pct = total === 0 ? 0 : count / total;
    const dash = pct * 2 * Math.PI * R;
    const offset = -cumulative * 2 * Math.PI * R;
    cumulative += pct;
    return { slug, count, pct, dash, offset };
  });

  return (
    <div className="glass-card" style={{ padding: "1.2rem 1.4rem" }}>
      <h3 style={{ marginTop: 0, marginBottom: "1rem" }}>Carga por departamento</h3>
      {total === 0 ? (
        <p style={{ opacity: 0.6, margin: 0 }}>No hay departamentos activos.</p>
      ) : (
        <div style={{ display: "flex", alignItems: "center", gap: "1.5rem" }}>
          <svg width={140} height={140} viewBox="0 0 140 140">
            <circle cx={CX} cy={CY} r={R} fill="none" stroke="currentColor" strokeOpacity="0.1" strokeWidth={STROKE} />
            {segments.map(seg => (
              <circle key={seg.slug}
                cx={CX} cy={CY} r={R} fill="none"
                stroke={COLORS[seg.slug] ?? "#888"}
                strokeWidth={STROKE}
                strokeDasharray={`${seg.dash} ${2 * Math.PI * R}`}
                strokeDashoffset={seg.offset}
                transform={`rotate(-90 ${CX} ${CY})`}
                style={{ transition: "stroke-dasharray 0.6s" }} />
            ))}
            <text x={CX} y={CY - 4} textAnchor="middle" fontSize={22} fontWeight={800} fill="currentColor">{total}</text>
            <text x={CX} y={CY + 14} textAnchor="middle" fontSize={9} fill="currentColor" opacity={0.6}>asignaciones</text>
          </svg>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", flex: 1 }}>
            {segments.map(seg => (
              <div key={seg.slug} style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
                <span style={{ width: 12, height: 12, borderRadius: 3, background: COLORS[seg.slug] ?? "#888" }} />
                <span style={{ flex: 1, fontSize: "0.85rem" }}>{LABELS[seg.slug] ?? seg.slug}</span>
                <strong>{seg.count}</strong>
                <span style={{ opacity: 0.6, fontSize: "0.75rem", minWidth: 36, textAlign: "right" }}>
                  {(seg.pct * 100).toFixed(0)}%
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
