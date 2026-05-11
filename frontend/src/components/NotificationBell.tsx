import React, { useEffect, useState, useRef } from "react";
import { createPortal } from "react-dom";
import { http } from "../services/http";
import { useAuth } from "../auth/authContext";

interface Notif {
  id: number;
  title: string;
  body: string | null;
  link: string | null;
  read_at: string | null;
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
    const id = setInterval(load, 30000);
    return () => clearInterval(id);
  }, [user]);

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
        <div data-notif-dropdown style={{
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
          <style>{`@keyframes notifSlide{from{opacity:0;transform:translateY(-6px)}to{opacity:1;transform:translateY(0)}}`}</style>
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
