import React, { useEffect, useState, useRef } from "react";
import { createPortal } from "react-dom";
import { http } from "../services/http";
import { getEcho } from "../services/echo";
import { useAuth } from "../auth/authContext";

interface Notif {
  id: number;
  title: string;
  body: string | null;
  link: string | null;
  read_at: string | null;
  acted_at?: string | null;
  type?: string | null;
  data?: Record<string, any> | null;
  created_at: string;
}

export const NotificationBell: React.FC = () => {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [notifs, setNotifs] = useState<Notif[]>([]);
  const ref = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const [pos, setPos] = useState<{ top: number; right: number }>({ top: 60, right: 16 });

  const load = () => {
    if (!user) return;
    http.get<Notif[]>("/notifications")
      .then(r => setNotifs(r.data))
      .catch(() => {});
  };

  useEffect(() => {
    load();
    // Fallback polling cada 60s por si se cae la conexión WebSocket
    const id = setInterval(load, 60000);
    return () => clearInterval(id);
  }, [user]);

  // Live updates vía Reverb (canal privado por usuario). Si Reverb está caído, sigue funcionando por polling.
  useEffect(() => {
    if (!user?.id) return;
    let channel: any = null;
    try {
      const echo = getEcho();
      channel = echo.private(`App.Models.User.${user.id}`);
      channel.listen('.notification.created', (e: { notification: Notif }) => {
        setNotifs(prev => {
          if (prev.some(n => n.id === e.notification.id)) return prev;
          return [e.notification, ...prev].slice(0, 30);
        });
      });
    } catch { /* noop */ }
    return () => {
      try { getEcho().leave(`App.Models.User.${user.id}`); } catch { /* noop */ }
    };
  }, [user?.id]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const target = e.target as Node;
      const insideBtn = btnRef.current?.contains(target);
      const insideDropdown = (e.target as HTMLElement)?.closest?.("[data-notif-dropdown]");
      if (!insideBtn && !insideDropdown) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  // Recalcular posición al abrir o redimensionar
  useEffect(() => {
    if (!open) return;
    const update = () => {
      const rect = btnRef.current?.getBoundingClientRect();
      if (!rect) return;
      setPos({ top: rect.bottom + 8, right: window.innerWidth - rect.right });
    };
    update();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [open]);

  const unread = notifs.filter(n => !n.read_at).length;

  const markAllRead = async () => {
    try {
      await http.post("/notifications/mark-all-read");
      setNotifs(prev => prev.map(n => ({ ...n, read_at: n.read_at ?? new Date().toISOString() })));
    } catch {}
  };

  const [approvingId, setApprovingId] = useState<number | null>(null);
  const approve = async (id: number) => {
    setApprovingId(id);
    try {
      await http.post(`/notifications/${id}/approve`);
      setNotifs(prev => prev.map(n => n.id === id ? { ...n, acted_at: new Date().toISOString(), read_at: n.read_at ?? new Date().toISOString() } : n));
    } catch {
      // Silent — interceptor toasts on error
    } finally {
      setApprovingId(null);
    }
  };

  if (!user) return null;

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        ref={btnRef}
        onClick={() => { setOpen(o => !o); if (!open && unread > 0) markAllRead(); }}
        className="topbar__theme-btn"
        aria-label="Notificaciones"
        style={{ position: "relative" }}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/>
          <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>
        </svg>
        {unread > 0 && (
          <span style={{
            position: "absolute",
            top: -2, right: -2,
            background: "#ef4444",
            color: "white",
            fontSize: "0.65rem",
            fontWeight: 800,
            minWidth: 16, height: 16,
            borderRadius: 8,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "0 4px",
            border: "2px solid var(--card-bg, white)",
          }}>{unread}</span>
        )}
      </button>

      {open && createPortal(
        <div data-notif-dropdown className="notif-dropdown" style={{
          position: "fixed",
          top: pos.top, right: pos.right,
          width: 340,
          maxHeight: 440,
          overflowY: "auto",
          background: "var(--card-bg, white)",
          color: "var(--text-primary, #0f172a)",
          border: "1px solid var(--border-color, #cbd5e1)",
          borderRadius: 14,
          boxShadow: "0 24px 60px rgba(0,0,0,0.40), 0 0 0 1px rgba(83, 74, 183, 0.10)",
          zIndex: 50,
          animation: "notifSlide 0.18s cubic-bezier(0.16, 1, 0.3, 1)",
        }}>
          <style>{`
            @keyframes notifSlide{from{opacity:0;transform:translateY(-6px)}to{opacity:1;transform:translateY(0)}}
            @media (max-width: 480px) {
              .notif-dropdown {
                left: 8px !important;
                right: 8px !important;
                width: auto !important;
                max-height: 70vh !important;
              }
            }
          `}</style>
          <div style={{
            padding: "0.85rem 1rem",
            borderBottom: "1px solid var(--border-color, #e2e8f0)",
            fontWeight: 800,
            fontFamily: "var(--font-display)",
            fontSize: "0.85rem",
            letterSpacing: "-0.01em",
            display: "flex",
            alignItems: "center",
            gap: 8,
            background: "linear-gradient(90deg, rgba(60,52,137,0.06), transparent)",
          }}>
            <span style={{ width: 6, height: 6, borderRadius: 3, background: "#EF9F27", boxShadow: "0 0 8px #EF9F27" }} />
            Notificaciones
            {unread > 0 && (
              <span style={{ marginLeft: "auto", fontSize: "0.65rem", fontWeight: 700, padding: "2px 8px", borderRadius: 999, background: "rgba(239,68,68,0.12)", color: "#ef4444" }}>
                {unread} nueva{unread === 1 ? "" : "s"}
              </span>
            )}
          </div>
          {notifs.length === 0 ? (
            <div style={{ padding: "2rem 1rem", color: "var(--text-secondary)", fontSize: "0.85rem", textAlign: "center" }}>
              No tienes notificaciones.
            </div>
          ) : (
            <div>
              {notifs.map(n => (
                <div key={n.id} style={{
                  padding: "0.8rem 1rem",
                  borderBottom: "1px solid var(--border-color, #f1f5f9)",
                  background: n.read_at ? "transparent" : "rgba(83, 74, 183, 0.08)",
                  position: "relative",
                }}>
                  {!n.read_at && (
                    <span style={{
                      position: "absolute", left: 0, top: 0, bottom: 0,
                      width: 3, background: "#EF9F27",
                    }} />
                  )}
                  <div style={{ fontSize: "0.85rem", fontWeight: 700, color: "var(--text-primary)" }}>{n.title}</div>
                  {n.body && <div style={{ fontSize: "0.78rem", color: "var(--text-secondary)", marginTop: 3 }}>{n.body}</div>}
                  <div style={{ fontSize: "0.7rem", color: "var(--text-secondary)", opacity: 0.7, marginTop: 5 }}>
                    {new Date(n.created_at).toLocaleString("es-ES", { dateStyle: "short", timeStyle: "short" })}
                  </div>
                  {n.type === 'worker_completion_approval' && (
                    <div style={{ marginTop: 8 }}>
                      {n.acted_at ? (
                        <span style={{ fontSize: "0.72rem", fontWeight: 700, padding: "3px 9px", borderRadius: 999, background: "rgba(29,158,117,0.15)", color: "#1D9E75" }}>
                          ✓ Aprobado
                        </span>
                      ) : (
                        <button
                          onClick={() => approve(n.id)}
                          disabled={approvingId === n.id}
                          style={{
                            background: "linear-gradient(135deg, #EF9F27 0%, #ffb84d 100%)",
                            color: "#1a1640",
                            border: "none",
                            borderRadius: 8,
                            padding: "6px 14px",
                            fontSize: "0.78rem",
                            fontWeight: 700,
                            cursor: approvingId === n.id ? "not-allowed" : "pointer",
                            opacity: approvingId === n.id ? 0.6 : 1,
                            boxShadow: "0 2px 8px rgba(239, 159, 39, 0.3)",
                          }}
                        >
                          {approvingId === n.id ? "Aprobando…" : "Aprobar"}
                        </button>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>,
        document.body
      )}
    </div>
  );
};
