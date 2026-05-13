import React, { useEffect, useState } from "react";
import { useAuth } from "../auth/authContext";
import { http } from "../services/http";

interface ActiveInfo {
  orderName: string;
  orderCode: string;
  startTime: Date;
}

export const FloatingTimer: React.FC = () => {
  const { user } = useAuth();
  const [active, setActive] = useState<ActiveInfo | null>(null);
  const [elapsed, setElapsed] = useState(0);

  // Poll for active session every 8s
  useEffect(() => {
    if (!user || (user as any).role !== "trabajador") return;
    let cancelled = false;

    const check = async () => {
      try {
        const res = await http.get<{ session: { id: number; start_time: string; order_name: string; order_code: string } | null }>('/sessions/active');
        if (cancelled) return;
        const s = res.data.session;
        if (s) {
          setActive({ orderName: s.order_name, orderCode: s.order_code, startTime: new Date(s.start_time) });
        } else {
          setActive(null);
        }
      } catch { /* silent */ }
    };

    check();
    const id = setInterval(check, 8000);
    const onSessionEnded = () => setActive(null);
    window.addEventListener('session:ended', onSessionEnded);
    return () => {
      cancelled = true;
      clearInterval(id);
      window.removeEventListener('session:ended', onSessionEnded);
    };
  }, [user]);

  // Tick elapsed
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => {
      setElapsed(Math.floor((Date.now() - active.startTime.getTime()) / 1000));
    }, 1000);
    setElapsed(Math.floor((Date.now() - active.startTime.getTime()) / 1000));
    return () => clearInterval(id);
  }, [active]);

  // Toggle body class while floating timer is visible (para ocultar la quick bar)
  useEffect(() => {
    if (active) document.body.classList.add('has-floating-timer');
    else document.body.classList.remove('has-floating-timer');
    return () => document.body.classList.remove('has-floating-timer');
  }, [active]);

  if (!active) return null;

  const h = Math.floor(elapsed / 3600).toString().padStart(2, "0");
  const m = Math.floor((elapsed % 3600) / 60).toString().padStart(2, "0");
  const s = (elapsed % 60).toString().padStart(2, "0");

  return (
    <div className="floating-timer-card" style={{
      position: "fixed",
      bottom: 20,
      left: 20,
      right: 20,
      maxWidth: 460,
      marginLeft: "auto",
      marginRight: "auto",
      zIndex: 50,
      background: "linear-gradient(135deg, #10b981, #059669)",
      color: "white",
      padding: "1rem 1.3rem",
      borderRadius: 14,
      boxShadow: "0 14px 40px rgba(16, 185, 129, 0.45)",
      display: "flex",
      alignItems: "center",
      gap: "1rem",
      animation: "pulse-shadow 0.5s infinite",
    }}>
      <style>{`
        @keyframes pulse-shadow {
          0%, 100% { box-shadow: 0 14px 40px rgba(16, 185, 129, 0.45); }
          50% { box-shadow: 0 14px 40px rgba(16, 185, 129, 0.7); }
        }
        @keyframes blink-dot {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }
        @media (max-width: 768px) {
          .floating-timer-card {
            left: 0 !important;
            right: 0 !important;
            bottom: 0 !important;
            max-width: none !important;
            margin: 0 !important;
            padding: 1.1rem 1.25rem calc(1.1rem + env(safe-area-inset-bottom, 0px)) !important;
            gap: 1rem !important;
            border-radius: 0 !important;
            z-index: 70 !important;
            box-shadow: 0 -10px 30px rgba(16, 185, 129, 0.5) !important;
          }
          .floating-timer-card > div:last-child {
            font-size: 1.55rem !important;
            font-weight: 900 !important;
          }
          .floating-timer-card > div:nth-child(2) span:first-child {
            font-size: 0.72rem !important;
          }
          .floating-timer-card > div:nth-child(2) span:last-child {
            font-size: 1.02rem !important;
          }
          /* Cuando el timer flotante está activo, ocultar la barra Acceso Rápido */
          body.has-floating-timer .ordenes-timer__quick { display: none !important; }
        }
        @media (max-width: 420px) {
          .floating-timer-card {
            padding: 0.95rem 1.05rem calc(0.95rem + env(safe-area-inset-bottom, 0px)) !important;
            gap: 0.75rem !important;
          }
          .floating-timer-card > div:last-child { font-size: 1.35rem !important; }
        }
      `}</style>
      <div style={{
        width: 10, height: 10, borderRadius: "50%",
        background: "#fff", animation: "blink-dot 0.5s infinite",
      }} />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", lineHeight: 1.2 }}>
        <span style={{ fontSize: "0.7rem", opacity: 0.85, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em" }}>
          Trabajando en {active.orderCode}
        </span>
        <span style={{ fontSize: "0.95rem", fontWeight: 700 }}>{active.orderName}</span>
      </div>
      <div style={{ fontFamily: "monospace", fontSize: "1.4rem", fontWeight: 800, letterSpacing: "0.02em" }}>
        {h}:{m}:{s}
      </div>
    </div>
  );
};
