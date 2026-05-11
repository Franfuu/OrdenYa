import React from "react";
import { useTheme } from "../../context/ThemeContext";
import { useMobileNav } from "../../context/MobileNavContext";
import { SunIcon, MoonIcon } from "../Icons";
import { NotificationBell } from "../NotificationBell";
import { InstallPWAButton } from "../InstallPWAButton";
import "./Topbar.css";

interface TopbarProps {
  title: string;
}

export const Topbar: React.FC<TopbarProps> = ({ title }) => {
  const { theme, toggleTheme } = useTheme();
  const { toggle } = useMobileNav();

  return (
    <div className="topbar">
      <button
        onClick={toggle}
        className="topbar__hamburger"
        aria-label="Abrir menú"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 6h18 M3 12h18 M3 18h18"/>
        </svg>
      </button>

      <h1 className="topbar__title">{title}</h1>

      <div className="topbar__actions">
        <InstallPWAButton />
        <NotificationBell />
        <button
          onClick={toggleTheme}
          className="topbar__theme-btn"
          aria-label="Cambiar tema"
        >
          {theme === 'light' ? <MoonIcon size={16} /> : <SunIcon size={16} />}
        </button>
      </div>
    </div>
  );
};
