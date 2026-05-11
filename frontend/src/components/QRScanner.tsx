import React, { useEffect, useRef, useState } from "react";
import { Html5Qrcode, Html5QrcodeScannerState } from "html5-qrcode";

interface Props {
  onResult: (decoded: string) => void;
  onClose: () => void;
}

export const QRScanner: React.FC<Props> = ({ onResult, onClose }) => {
  const ref = useRef<HTMLDivElement>(null);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const handledRef = useRef(false);
  const [error, setError] = useState<string | null>(null);

  const safeStop = async () => {
    const sc = scannerRef.current;
    if (!sc) return;
    try {
      const state = sc.getState();
      if (state === Html5QrcodeScannerState.SCANNING || state === Html5QrcodeScannerState.PAUSED) {
        await sc.stop();
      }
    } catch { /* ignore */ }
    try { await sc.clear(); } catch { /* ignore */ }
    scannerRef.current = null;
  };

  useEffect(() => {
    if (!ref.current) return;
    const id = "qr-scanner-region";
    ref.current.id = id;
    let cancelled = false;

    const scanner = new Html5Qrcode(id);
    scannerRef.current = scanner;

    scanner.start(
      { facingMode: "environment" },
      { fps: 10, qrbox: { width: 240, height: 240 } },
      (decoded) => {
        if (handledRef.current || cancelled) return;
        handledRef.current = true;
        onResult(decoded);
        safeStop();
      },
      () => { /* ignore frame errors */ }
    ).catch(err => {
      if (!cancelled) setError(err?.message ?? "No se pudo abrir la cámara");
    });

    return () => {
      cancelled = true;
      safeStop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div onClick={onClose} style={{
      position: "fixed", inset: 0,
      background: "rgba(0,0,0,0.8)",
      zIndex: 10000,
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: "1rem",
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: "var(--card-bg, white)",
        borderRadius: 16, padding: "1rem",
        maxWidth: 380, width: "100%",
      }}>
        <h3 style={{ margin: 0, marginBottom: "0.7rem", display: "flex", alignItems: "center", gap: 8 }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="7" height="7" rx="1"/>
            <rect x="14" y="3" width="7" height="7" rx="1"/>
            <rect x="3" y="14" width="7" height="7" rx="1"/>
            <path d="M14 14h3v3h-3z M19 14h2 M14 19h3 M19 19v2"/>
          </svg>
          Escanea QR de la orden
        </h3>
        <div ref={ref} style={{ width: "100%", minHeight: 300, borderRadius: 8, overflow: "hidden", background: "#000" }} />
        {error && <p style={{ color: "#ef4444", margin: "0.5rem 0 0" }}>{error}</p>}
        <button onClick={onClose} className="wo-form__btn-outline" style={{ marginTop: "0.7rem", width: "100%" }}>
          Cerrar
        </button>
      </div>
    </div>
  );
};
