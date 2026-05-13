import React from "react";

const COLORS: Record<string, string> = {
  taller: "#534AB7",
  instalacion: "#1D9E75",
  mixto: "#EF9F27",
};
const LABELS: Record<string, string> = {
  taller: "Taller",
  instalacion: "Instalación",
  mixto: "Mixto",
};

interface Props {
  orders: any[];
}

export const DonutChart: React.FC<Props> = ({ orders }) => {
  const safeOrders = Array.isArray(orders) ? orders : [];
  const counts: Record<string, number> = {};
  safeOrders.forEach(o => {
    const slugs = (o.departments ?? [])
      .map((d: any) => d.department?.slug)
      .filter(Boolean);
    if (slugs.length === 0) return;
    const key = slugs.length > 1 ? "mixto" : slugs[0];
    counts[key] = (counts[key] ?? 0) + 1;
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
        <div className="donut-chart__row">
          <div className="donut-chart__svg-wrap">
            <svg viewBox="0 0 140 140" preserveAspectRatio="xMidYMid meet" style={{ width: "100%", height: "100%", display: "block" }}>
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
              <text x={CX} y={CY - 2} textAnchor="middle" fontSize={26} fontWeight={800} fill="currentColor">{total}</text>
              <text x={CX} y={CY + 16} textAnchor="middle" fontSize={9} fill="currentColor" opacity={0.6}>órdenes</text>
            </svg>
          </div>
          <div className="donut-chart__legend">
            {segments.map(seg => (
              <div key={seg.slug} style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
                <span style={{ width: 12, height: 12, borderRadius: 3, background: COLORS[seg.slug] ?? "#888", flexShrink: 0 }} />
                <span style={{ flex: 1, fontSize: "0.9rem" }}>{LABELS[seg.slug] ?? seg.slug}</span>
                <strong>{seg.count}</strong>
                <span style={{ opacity: 0.6, fontSize: "0.78rem", minWidth: 40, textAlign: "right" }}>
                  {(seg.pct * 100).toFixed(0)}%
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
      <style>{`
        .donut-chart__row {
          display: flex;
          align-items: center;
          gap: 1.5rem;
        }
        .donut-chart__svg-wrap {
          width: clamp(160px, 28vw, 240px);
          aspect-ratio: 1 / 1;
          flex-shrink: 0;
        }
        .donut-chart__legend {
          display: flex;
          flex-direction: column;
          gap: 0.65rem;
          flex: 1;
          min-width: 0;
        }
        @media (max-width: 560px) {
          .donut-chart__row { flex-direction: column; align-items: stretch; gap: 1rem; }
          .donut-chart__svg-wrap { width: 60%; max-width: 220px; margin: 0 auto; }
        }
      `}</style>
    </div>
  );
};
