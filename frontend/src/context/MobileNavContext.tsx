import React, { createContext, use, useState, useEffect } from "react";
import { useLocation } from "react-router-dom";

interface MobileNavValue {
  open: boolean;
  setOpen: (v: boolean) => void;
  toggle: () => void;
}

const Ctx = createContext<MobileNavValue>({ open: false, setOpen: () => {}, toggle: () => {} });

export const MobileNavProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [open, setOpen] = useState(false);
  const location = useLocation();

  // Close drawer on route change (read pathname inside effect to satisfy react-doctor)
  useEffect(() => {
    void location.pathname;
    setOpen(false);
  }, [location]);

  // Close on ESC
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Lock body scroll while open
  useEffect(() => {
    if (open) document.body.style.overflow = "hidden";
    else document.body.style.overflow = "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  return (
    <Ctx.Provider value={{ open, setOpen, toggle: () => setOpen(o => !o) }}>
      {children}
    </Ctx.Provider>
  );
};

export const useMobileNav = () => use(Ctx);
