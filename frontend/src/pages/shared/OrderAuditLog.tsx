import React, { useEffect, useState } from "react";
import { http } from "../../services/http";

interface AuditEntry {
  id: number;
  action: string;
  summary: string | null;
  created_at: string;
  user: { id: number; name: string; role: string } | null;
}

const ACTION_META: Record<string, { color: string; label: string }> = {
  created:    { color: "#10b981", label: "Creada" },
  updated:    { color: "#3b82f6", label: "Modificada" },
  deleted:    { color: "#ef4444", label: "Eliminada" },
  duplicated: { color: "#8b5cf6", label: "Duplicada" },
  finalized:       { color: "#f59e0b", label: "Cerrada" },
  "auto-finalized": { color: "#f59e0b", label: "AutoCerrada" },
  reopened:        { color: "#6366f1", label: "Reabierta" },
};

export const OrderAuditLog: React.FC<{ orderId: number; refreshKey?: number }> = ({ orderId, refreshKey }) => {
  const [entries, setEntries] = useState<AuditEntry[]>([]);

  useEffect(() => {
    http.get<AuditEntry[]>(`/work-orders/${orderId}/audit`)
      .then(r => setEntries(r.data))
      .catch(() => {});
  }, [orderId, refreshKey]);

  if (entries.length === 0) return null;

  return (
    <div className="glass-card wo-detail__section" data-audit-log>
      <h3 className="wo-detail__section-title">Historial de cambios</h3>
      <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
        {entries.map(e => {
          const meta = ACTION_META[e.action] ?? { color: "#666", label: e.action };
          return (
            <div key={e.id} data-audit-row style={{ display: "flex", alignItems: "center", gap: "0.7rem", fontSize: "0.83rem" }}>
              <span style={{
                padding: "0.15rem 0.5rem",
                borderRadius: 4,
                background: `${meta.color}20`,
                color: meta.color,
                fontWeight: 700,
                fontSize: "0.7rem",
                minWidth: 80,
                textAlign: "center",
              }}>{meta.label}</span>
              <span style={{ flex: 1, opacity: 0.85 }}>{e.summary ?? "—"}</span>
              <span data-audit-meta style={{ opacity: 0.6, fontSize: "0.75rem", textAlign: "right" }}>
                {e.user?.name ?? "Sistema"} · {new Date(e.created_at).toLocaleString("es-ES", { dateStyle: "short", timeStyle: "short" })}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};
