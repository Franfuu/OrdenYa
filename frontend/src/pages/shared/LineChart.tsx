import React from "react";

const DAYS = 30;

interface Props {
  orders: any[];
}

export const LineChart: React.FC<Props> = ({ orders }) => {
  const safeOrders = Array.isArray(orders) ? orders : [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const map: Record<string, { sessions: number; piezas: number }> = {};
  for (let i = DAYS - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    map[d.toISOString().substring(0, 10)] = { sessions: 0, piezas: 0 };
  }
  safeOrders.forEach(o => {
    (o.work_sessions ?? []).forEach((s: any) => {
      if (!s.start_time) return;
      const key = s.start_time.substring(0, 10);
      if (map[key]) {
        map[key].sessions++;
        map[key].piezas += s.piezas ?? 0;
      }
    });
  });
  const data = Object.entries(map).map(([date, v]) => ({ date, ...v }));

  const W = 600, H = 180, PAD = 24;
  const maxSessions = Math.max(1, ...data.map(d => d.sessions));
  const maxPiezas = Math.max(1, ...data.map(d => d.piezas));

  const xFor = (i: number) => PAD + (i / (data.length - 1 || 1)) * (W - PAD * 2);
  const yForS = (v: number) => H - PAD - (v / maxSessions) * (H - PAD * 2);
  const yForP = (v: number) => H - PAD - (v / maxPiezas) * (H - PAD * 2);

  const pathSessions = data.map((d, i) => `${i === 0 ? "M" : "L"} ${xFor(i)} ${yForS(d.sessions)}`).join(" ");
  const pathPiezas = data.map((d, i) => `${i === 0 ? "M" : "L"} ${xFor(i)} ${yForP(d.piezas)}`).join(" ");

  return (
    <div className="glass-card" style={{ padding: "1.2rem 1.4rem" }}>
      <h3 style={{ marginTop: 0, marginBottom: "0.6rem" }}>Tendencia últimos 30 días</h3>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "auto", display: "block" }}>
        {[0, 0.25, 0.5, 0.75, 1].map(t => (
          <line key={t} x1={PAD} x2={W - PAD} y1={PAD + t * (H - PAD * 2)} y2={PAD + t * (H - PAD * 2)}
            stroke="currentColor" strokeOpacity="0.08" />
        ))}
        <path d={pathSessions} fill="none" stroke="#534AB7" strokeWidth={2} strokeLinejoin="round" />
        <path d={pathPiezas} fill="none" stroke="#EF9F27" strokeWidth={2} strokeLinejoin="round" />
        {data.map((d, i) => (
          <g key={d.date}>
            <circle cx={xFor(i)} cy={yForS(d.sessions)} r={2.5} fill="#534AB7">
              <title>{d.date}: {d.sessions} sesiones, {d.piezas} piezas</title>
            </circle>
            <circle cx={xFor(i)} cy={yForP(d.piezas)} r={2.5} fill="#EF9F27" />
          </g>
        ))}
      </svg>
      <div style={{ display: "flex", gap: "1.2rem", fontSize: "0.75rem", opacity: 0.75, marginTop: 4 }}>
        <span><span style={{ display: "inline-block", width: 10, height: 10, background: "#534AB7", borderRadius: 2, marginRight: 4, verticalAlign: "middle" }} /> Sesiones</span>
        <span><span style={{ display: "inline-block", width: 10, height: 10, background: "#EF9F27", borderRadius: 2, marginRight: 4, verticalAlign: "middle" }} /> Piezas</span>
      </div>
    </div>
  );
};
