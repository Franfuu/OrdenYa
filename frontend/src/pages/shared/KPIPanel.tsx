import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../auth/authContext";
import { workOrderService } from "../../services/workOrderService";
import { userService } from "../../services/userService";
import { Spinner } from "../../components/Spinner";
import { WorkOrderIcon, CompletedIcon, UsersIcon, DashboardIcon } from "../../components/Icons";
import type { WorkOrder } from "../../types/WorkOrder";
import { isOrderFinalizada } from "../../types/WorkOrder";
import { LineChart } from "./LineChart";
import { DonutChart } from "./DonutChart";

interface Props {
  showUsers?: boolean;
}

interface KPI {
  label: string;
  value: string | number;
  sub?: string;
  color: string;
  icon: React.ReactNode;
}

const daysBetween = (a: Date, b: Date) =>
  Math.ceil((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24));

export const KPIPanel: React.FC<Props> = ({ showUsers = true }) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const basePath = (user as any)?.role === "supervisor" ? "/supervisor" : "/admin";
  const [orders, setOrders] = useState<WorkOrder[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      workOrderService.getAll().catch(() => []),
      showUsers ? userService.getUsers().catch(() => []) : Promise.resolve([]),
    ]).then(([o, u]) => {
      setOrders(Array.isArray(o) ? o : (o as any).data ?? []);
      setUsers(Array.isArray(u) ? u : []);
      setLoading(false);
    });
  }, [showUsers]);

  if (loading) return <Spinner message="Cargando panel..." />;

  const total = orders.length;
  const enCurso = orders.filter(o => !isOrderFinalizada(o)).length;
  const finalizadas = orders.filter(o => isOrderFinalizada(o)).length;
  const trabajadores = users.filter(u => u.role === "trabajador").length;

  const kpis: (KPI & { onClick?: () => void })[] = [
    { label: "Órdenes totales", value: total, sub: `${enCurso} activas`, color: "#3C3489", icon: <WorkOrderIcon size={22} color="#3C3489" />, onClick: () => navigate(`${basePath}/ordenes/lista`) },
    { label: "En curso",        value: enCurso, sub: "Sin finalizar",     color: "#EF9F27", icon: <DashboardIcon size={22} color="#EF9F27" />, onClick: () => navigate(`${basePath}/ordenes/lista`) },
    { label: "Finalizadas",     value: finalizadas, sub: "Todos los deptos.", color: "#1D9E75", icon: <CompletedIcon size={22} color="#1D9E75" />, onClick: () => navigate(`${basePath}/ordenes/lista`) },
  ];

  const now = new Date();
  const ordersWithDeadline = orders
    .filter(o => !isOrderFinalizada(o) && o.fecha_fin)
    .map(o => ({ order: o, dias: daysBetween(now, new Date(o.fecha_fin!)) }))
    .sort((a, b) => a.dias - b.dias)
    .slice(0, 5);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      <div className="kpi-grid">
        {kpis.map((k, i) => (
          <div key={i} className="glass-card kpi-card" onClick={k.onClick} style={{
            borderLeft: `4px solid ${k.color}`,
            cursor: k.onClick ? "pointer" : "default",
            transition: "transform 0.15s, box-shadow 0.15s",
          }}
          onMouseEnter={k.onClick ? (e) => { e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.boxShadow = `0 10px 28px ${k.color}30`; } : undefined}
          onMouseLeave={k.onClick ? (e) => { e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.boxShadow = ""; } : undefined}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: "0.7rem", fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", opacity: 0.7 }}>
                {k.label}
              </span>
              {k.icon}
            </div>
            <div className="kpi-card__num" style={{ color: k.color }}>{k.value}</div>
            {k.sub && <div style={{ fontSize: "0.78rem", opacity: 0.65 }}>{k.sub}</div>}
          </div>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "1rem" }}>
        <LineChart orders={orders} />
        <DonutChart orders={orders} />
      </div>

      <div className="glass-card" style={{ padding: "1.2rem 1.4rem" }}>
        <h3 style={{ margin: 0, marginBottom: "0.8rem", fontSize: "1rem" }}>Próximas a vencer</h3>
        {ordersWithDeadline.length === 0 ? (
          <p style={{ opacity: 0.6, margin: 0 }}>No hay órdenes con fecha de fin definida.</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            {ordersWithDeadline.map(({ order, dias }) => {
              const color = dias < 0 ? "#ef4444" : dias <= 2 ? "#f59e0b" : "#10b981";
              const txt = dias < 0 ? `Vencida ${-dias}d` : dias === 0 ? "Vence hoy" : `${dias} día${dias === 1 ? "" : "s"}`;
              return (
                <button
                  key={order.id}
                  type="button"
                  onClick={() => navigate(`${basePath}/ordenes/ver/${order.id}`)}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "0.7rem 0.9rem",
                    borderRadius: 10,
                    background: `${color}10`,
                    border: `1px solid ${color}40`,
                    color: "inherit",
                    cursor: "pointer",
                    fontFamily: "var(--font)",
                    textAlign: "left",
                    width: "100%",
                    transition: "transform 0.15s, box-shadow 0.15s, border-color 0.15s",
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.transform = "translateX(2px)";
                    e.currentTarget.style.boxShadow = `0 4px 12px ${color}25`;
                    e.currentTarget.style.borderColor = color;
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.transform = "translateX(0)";
                    e.currentTarget.style.boxShadow = "none";
                    e.currentTarget.style.borderColor = `${color}40`;
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", minWidth: 0 }}>
                    <strong style={{ fontSize: "0.88rem", fontFamily: "var(--font-display)", color: "var(--text-primary)" }}>{order.codigo_orden}</strong>
                    <span style={{ opacity: 0.75, fontSize: "0.85rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{order.nombre_orden}</span>
                  </div>
                  <span style={{ color, fontWeight: 700, fontSize: "0.85rem", flexShrink: 0, marginLeft: 12 }}>{txt} →</span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
