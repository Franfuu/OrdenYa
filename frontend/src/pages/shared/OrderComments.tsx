import React, { useEffect, useState } from "react";
import { http } from "../../services/http";
import { useAuth } from "../../auth/authContext";
import { useConfirm } from "../../components/ConfirmDialog";
import { sileo } from "sileo";

interface Comment {
  id: number;
  body: string;
  created_at: string;
  user: { id: number; name: string; role: string };
}

const ROLE_COLOR: Record<string, string> = {
  admin: "#ef4444",
  supervisor: "#f59e0b",
  trabajador: "#3b82f6",
};

export const OrderComments: React.FC<{ orderId: number }> = ({ orderId }) => {
  const { user } = useAuth();
  const confirm = useConfirm();
  const [comments, setComments] = useState<Comment[]>([]);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);

  const load = () => {
    http.get<Comment[]>(`/work-orders/${orderId}/comments`).then(r => setComments(r.data)).catch(() => {});
  };

  useEffect(() => { load(); }, [orderId]);

  const submit = async () => {
    const body = text.trim();
    if (!body) return;
    setLoading(true);
    try {
      const r = await http.post<Comment>(`/work-orders/${orderId}/comments`, { body });
      setComments(prev => [r.data, ...prev]);
      setText("");
    } catch {
      sileo.error({ title: "Error al publicar" });
    } finally {
      setLoading(false);
    }
  };

  const del = async (id: number) => {
    if (!await confirm({ message: "¿Eliminar este comentario?", danger: true, confirmText: "Eliminar" })) return;
    try {
      await http.delete(`/comments/${id}`);
      setComments(prev => prev.filter(c => c.id !== id));
    } catch {
      sileo.error({ title: "Sin permiso" });
    }
  };

  return (
    <div className="glass-card wo-detail__section">
      <h3 className="wo-detail__section-title">Comentarios ({comments.length})</h3>

      <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1rem" }}>
        <input
          type="text"
          value={text}
          onChange={e => setText(e.target.value)}
          placeholder="Escribe un comentario..."
          onKeyDown={e => { if (e.key === "Enter") submit(); }}
          style={{ flex: 1, padding: "0.5rem 0.7rem", borderRadius: 8, border: "1px solid var(--border, #cbd5e1)", background: "transparent", color: "inherit" }}
        />
        <button className="btn-primary" onClick={submit} disabled={loading || !text.trim()}>
          Publicar
        </button>
      </div>

      {comments.length === 0 ? (
        <p style={{ opacity: 0.6, margin: 0 }}>Aún no hay comentarios.</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.7rem" }}>
          {comments.map(c => {
            const color = ROLE_COLOR[c.user.role] ?? "#666";
            const canDelete = c.user.id === (user as any)?.id || (user as any)?.role === "admin";
            return (
              <div key={c.id} style={{
                background: "var(--surface-2, rgba(0,0,0,0.04))",
                padding: "0.7rem 0.9rem",
                borderRadius: 8,
                borderLeft: `3px solid ${color}`,
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4, fontSize: "0.75rem" }}>
                  <span><strong>{c.user.name}</strong> <span style={{ color, fontWeight: 600 }}>· {c.user.role}</span></span>
                  <span style={{ opacity: 0.55 }}>{new Date(c.created_at).toLocaleString("es-ES", { dateStyle: "short", timeStyle: "short" })}</span>
                </div>
                <div style={{ fontSize: "0.9rem", whiteSpace: "pre-wrap" }}>{c.body}</div>
                {canDelete && (
                  <button onClick={() => del(c.id)} style={{
                    background: "transparent", border: "none", color: "#ef4444",
                    cursor: "pointer", fontSize: "0.75rem", marginTop: 4, padding: 0,
                  }}>Eliminar</button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
