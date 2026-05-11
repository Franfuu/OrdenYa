import React, { useEffect, useRef, useState } from "react";

interface Props {
  onResult: (text: string) => void;
  disabled?: boolean;
}

export const VoiceInput: React.FC<Props> = ({ onResult, disabled }) => {
  const [listening, setListening] = useState(false);
  const recogRef = useRef<any>(null);

  const Speech = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
  const supported = !!Speech;

  useEffect(() => {
    return () => {
      try { recogRef.current?.stop(); } catch {}
    };
  }, []);

  const toggle = () => {
    if (!supported) return;
    if (listening) {
      try { recogRef.current?.stop(); } catch {}
      setListening(false);
      return;
    }
    const rec = new Speech();
    rec.lang = "es-ES";
    rec.interimResults = false;
    rec.maxAlternatives = 1;
    rec.continuous = false;
    rec.onresult = (e: any) => {
      const text = e.results?.[0]?.[0]?.transcript ?? "";
      if (text) onResult(text);
    };
    rec.onend = () => setListening(false);
    rec.onerror = () => setListening(false);
    recogRef.current = rec;
    rec.start();
    setListening(true);
  };

  if (!supported) return null;

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={disabled}
      title={listening ? "Detener" : "Dictar nota"}
      style={{
        background: listening ? "#ef4444" : "var(--surface-2, #f1f5f9)",
        color: listening ? "white" : "inherit",
        border: "none",
        borderRadius: 8,
        padding: "0.4rem 0.7rem",
        cursor: "pointer",
        fontSize: "0.85rem",
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        animation: listening ? "voice-pulse 1.2s infinite" : "none",
      }}
    >
      <style>{`@keyframes voice-pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.6; } }`}</style>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="9" y="2" width="6" height="13" rx="3"/>
        <path d="M19 10a7 7 0 0 1-14 0 M12 19v4"/>
      </svg>
      {listening ? "Escuchando..." : "Dictar"}
    </button>
  );
};
