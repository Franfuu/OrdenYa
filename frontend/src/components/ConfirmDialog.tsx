import React, { createContext, useContext, useState, useCallback } from "react";
import { createPortal } from "react-dom";

interface ConfirmOptions {
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  danger?: boolean;
}

type ConfirmFn = (opts: ConfirmOptions | string) => Promise<boolean>;

const Ctx = createContext<ConfirmFn>(() => Promise.resolve(false));

export const useConfirm = (): ConfirmFn => useContext(Ctx);

interface State extends ConfirmOptions {
  open: boolean;
  resolve?: (v: boolean) => void;
}

export const ConfirmProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, setState] = useState<State>({ open: false, message: "" });

  const confirm: ConfirmFn = useCallback((opts) => {
    const options: ConfirmOptions = typeof opts === "string" ? { message: opts } : opts;
    return new Promise<boolean>((resolve) => {
      setState({ open: true, ...options, resolve });
    });
  }, []);

  const close = (value: boolean) => {
    state.resolve?.(value);
    setState({ open: false, message: "" });
  };

  return (
    <Ctx.Provider value={confirm}>
      {children}
      {state.open && createPortal(
        <div
          onClick={() => close(false)}
          style={{
            position: "fixed", inset: 0, zIndex: 10001,
            background: "rgba(13, 10, 31, 0.78)",
            backdropFilter: "blur(8px)",
            WebkitBackdropFilter: "blur(8px)",
            display: "grid", placeItems: "center", padding: "1.5rem",
            animation: "confirmFade 0.16s ease",
          }}
        >
          <style>{`
            @keyframes confirmFade{from{opacity:0}to{opacity:1}}
            @keyframes confirmPop{from{opacity:0;transform:scale(0.94) translateY(8px)}to{opacity:1;transform:scale(1) translateY(0)}}
          `}</style>
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: "var(--card-bg)",
              border: "1px solid var(--border-color)",
              borderRadius: 18,
              maxWidth: 420, width: "100%",
              boxShadow: "0 40px 90px rgba(0,0,0,0.55)",
              animation: "confirmPop 0.24s cubic-bezier(0.16, 1, 0.3, 1)",
              position: "relative",
              overflow: "hidden",
            }}
          >
            <div style={{
              position: "absolute", top: 0, left: 0, right: 0, height: 3,
              background: state.danger
                ? "linear-gradient(90deg, #ef4444 0%, #BA7517 100%)"
                : "linear-gradient(90deg, var(--brand) 0%, var(--amber) 100%)",
            }} />

            <div style={{ padding: "1.6rem 1.6rem 0.8rem", display: "flex", gap: 16, alignItems: "flex-start" }}>
              <div style={{
                width: 44, height: 44, borderRadius: 12, flexShrink: 0,
                background: state.danger ? "rgba(239,68,68,0.14)" : "rgba(60,52,137,0.12)",
                color: state.danger ? "#ef4444" : "var(--brand-light)",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                {state.danger ? (
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/>
                    <path d="M12 9v4 M12 17h.01"/>
                  </svg>
                ) : (
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10"/>
                    <path d="M12 8v4 M12 16h.01"/>
                  </svg>
                )}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <h3 style={{
                  margin: 0, marginBottom: 6,
                  fontFamily: "var(--font-display)",
                  fontSize: "1.15rem", fontWeight: 700,
                  letterSpacing: "-0.02em",
                  color: "var(--text-primary)",
                }}>
                  {state.title ?? (state.danger ? "Confirmar eliminación" : "Confirmar")}
                </h3>
                <p style={{
                  margin: 0, color: "var(--text-secondary)",
                  fontSize: "0.92rem", lineHeight: 1.5,
                }}>
                  {state.message}
                </p>
              </div>
            </div>

            <div style={{
              padding: "1.2rem 1.6rem",
              display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10,
              borderTop: "1px solid var(--border-color)", marginTop: "0.8rem",
            }}>
              <button
                onClick={() => close(false)}
                style={{
                  background: "transparent",
                  border: "1.5px solid var(--border-strong)",
                  color: "var(--text-primary)",
                  fontFamily: "var(--font)", fontWeight: 600, fontSize: "0.92rem",
                  padding: "11px 16px", borderRadius: 11, cursor: "pointer",
                  transition: "border-color 0.15s",
                }}
                onMouseEnter={e => e.currentTarget.style.borderColor = "var(--brand-light)"}
                onMouseLeave={e => e.currentTarget.style.borderColor = "var(--border-strong)"}
              >
                {state.cancelText ?? "Cancelar"}
              </button>
              <button
                onClick={() => close(true)}
                autoFocus
                style={{
                  background: state.danger
                    ? "linear-gradient(135deg, #ef4444 0%, #b91c1c 100%)"
                    : "linear-gradient(135deg, var(--brand) 0%, var(--brand-deep) 100%)",
                  color: "white",
                  border: "none",
                  fontFamily: "var(--font)", fontWeight: 700, fontSize: "0.92rem",
                  padding: "11px 16px", borderRadius: 11, cursor: "pointer",
                  boxShadow: state.danger
                    ? "0 8px 22px rgba(239,68,68,0.35)"
                    : "0 8px 22px rgba(38,33,92,0.32)",
                  transition: "transform 0.15s, box-shadow 0.15s",
                }}
                onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-1px)"; }}
                onMouseLeave={e => { e.currentTarget.style.transform = "translateY(0)"; }}
              >
                {state.confirmText ?? (state.danger ? "Eliminar" : "Confirmar")}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </Ctx.Provider>
  );
};
