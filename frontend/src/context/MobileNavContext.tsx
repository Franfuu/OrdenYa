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

  // Lock body scroll + congelar posición mientras está abierto
  // (evita que la address bar móvil colapse/expanda y "salte" el viewport,
  // que causaba el bug donde el contenido bajo el drawer se asomaba)
  useEffect(() => {
    if (!open) return;
    const scrollY = window.scrollY;
    const { body, documentElement: html } = document;
    const prev = {
      bodyPosition: body.style.position,
      bodyTop: body.style.top,
      bodyLeft: body.style.left,
      bodyRight: body.style.right,
      bodyWidth: body.style.width,
      bodyOverflow: body.style.overflow,
      htmlOverflow: html.style.overflow,
    };
    body.style.position = "fixed";
    body.style.top = `-${scrollY}px`;
    body.style.left = "0";
    body.style.right = "0";
    body.style.width = "100%";
    body.style.overflow = "hidden";
    html.style.overflow = "hidden";
    return () => {
      body.style.position = prev.bodyPosition;
      body.style.top = prev.bodyTop;
      body.style.left = prev.bodyLeft;
      body.style.right = prev.bodyRight;
      body.style.width = prev.bodyWidth;
      body.style.overflow = prev.bodyOverflow;
      html.style.overflow = prev.htmlOverflow;
      window.scrollTo(0, scrollY);
    };
  }, [open]);

  return (
    <Ctx.Provider value={{ open, setOpen, toggle: () => setOpen(o => !o) }}>
      {children}
    </Ctx.Provider>
  );
};

export const useMobileNav = () => use(Ctx);
