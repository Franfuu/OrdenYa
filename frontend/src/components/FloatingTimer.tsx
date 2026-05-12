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

  if (!active) return null;

  const h = Math.floor(elapsed / 3600).toString().padStart(2, "0");
  const m = Math.floor((elapsed % 3600) / 60).toString().padStart(2, "0");
  const s = (elapsed % 60).toString().padStart(2, "0");

  return (
    <div style={{
      position: "fixed",
      bottom: 20,
      right: 20,
      zIndex: 50,
      background: "linear-gradient(135deg, #10b981, #059669)",
      color: "white",
      padding: "0.8rem 1.2rem",
      borderRadius: 12,
      boxShadow: "0 10px 30px rgba(16, 185, 129, 0.4)",
      display: "flex",
      alignItems: "center",
      gap: "0.8rem",
      minWidth: 240,
      animation: "pulse-shadow 0.5s infinite",
    }}>
      <style>{`
        @keyframes pulse-shadow {
          0%, 100% { box-shadow: 0 10px 30px rgba(16, 185, 129, 0.4); }
          50% { box-shadow: 0 10px 30px rgba(16, 185, 129, 0.7); }
        }
        @keyframes blink-dot {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
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
