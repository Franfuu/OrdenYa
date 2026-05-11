import React, { useEffect, useState } from "react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export const InstallPWAButton: React.FC = () => {
  const [evt, setEvt] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setEvt(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => { setInstalled(true); setEvt(null); };

    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);

    // Detect standalone (ya instalada)
    if (window.matchMedia?.("(display-mode: standalone)").matches) setInstalled(true);

    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (installed || !evt) return null;

  const install = async () => {
    if (!evt) return;
    await evt.prompt();
    const { outcome } = await evt.userChoice;
    if (outcome === "accepted") setEvt(null);
  };

  return (
    <button
      onClick={install}
      title="Instalar OrdenYa en este dispositivo"
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        padding: "8px 14px",
        borderRadius: 10,
        background: "linear-gradient(135deg, #EF9F27 0%, #BA7517 100%)",
        color: "#1a1640",
        border: "none",
        fontFamily: "var(--font)",
        fontWeight: 700,
        fontSize: "0.82rem",
        letterSpacing: "0.01em",
        cursor: "pointer",
        boxShadow: "0 6px 16px rgba(239, 159, 39, 0.32)",
        transition: "transform 0.15s, box-shadow 0.15s",
      }}
      onMouseEnter={e => Object.assign(e.currentTarget.style, { transform: "translateY(-1px)", boxShadow: "0 10px 22px rgba(239,159,39,0.45)" })}
      onMouseLeave={e => Object.assign(e.currentTarget.style, { transform: "translateY(0)", boxShadow: "0 6px 16px rgba(239,159,39,0.32)" })}
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4 M7 10l5 5 5-5 M12 15V3"/>
      </svg>
      Instalar app
    </button>
  );
};
