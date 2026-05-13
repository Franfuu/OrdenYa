import React from "react";
import { NavLink } from "react-router-dom";
import { useAuth } from "../../auth/authContext";
import { useMobileNav } from "../../context/MobileNavContext";
import { LogoutIcon } from "../Icons";
import { OrdenYaWordmark } from "../OrdenYaWordmark";
import { InstallPWAButton } from "../InstallPWAButton";
import "./Sidebar.css";

interface SidebarLink {
  path: string;
  label: string;
  icon?: React.ReactNode;
}

interface SidebarProps {
  links: SidebarLink[];
}

export const Sidebar: React.FC<SidebarProps> = ({ links }) => {
  const { logout, user } = useAuth();
  const { open, setOpen } = useMobileNav();
  const perfilPath = `/${user?.role}/perfil`;

  return (
    <>
      <div
        className={`sidebar__backdrop ${open ? "sidebar__backdrop--visible" : ""}`}
        onClick={() => setOpen(false)}
        aria-hidden="true"
      />
      <div className={`sidebar ${open ? "sidebar--open" : ""}`}>
      {/* Logo */}
      <div className="sidebar__brand">
        <OrdenYaWordmark size={38} variant="light" showTag />
        <button
          className="sidebar__close-btn"
          onClick={() => setOpen(false)}
          aria-label="Cerrar menú"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
            <path d="M18 6 6 18 M6 6l12 12"/>
          </svg>
        </button>
      </div>

      {/* User profile brief — clickable → perfil */}
      <NavLink to={perfilPath} className={({ isActive }) => `sidebar__user ${isActive ? 'sidebar__user--active' : ''}`}>
        <div className="sidebar__avatar">
          {user?.name?.charAt(0).toUpperCase() || "U"}
        </div>
        <div className="sidebar__user-info">
          <strong className="sidebar__user-name">{user?.name || "Usuario"}</strong>
          <span className="sidebar__user-role">
            {user?.role === 'jefe' ? 'superusuario' : (user?.role || "usuario")}
          </span>
        </div>
      </NavLink>

      {/* Navigation */}
      <nav className="sidebar__nav" aria-label="Navegación principal">
        {links.map(link => (
          <NavLink
            key={link.path}
            to={link.path}
            className={({ isActive }) => `sidebar__link ${isActive ? 'sidebar__link--active' : ''}`}
          >
            {link.icon && <span className="sidebar__link-icon" aria-hidden="true">{link.icon}</span>}
            <span className="sidebar__link-label">{link.label}</span>
          </NavLink>
        ))}
      </nav>

      {/* Install + Logout */}
      <div className="sidebar__logout">
        <div className="sidebar__install"><InstallPWAButton /></div>
        <button onClick={logout} className="sidebar__logout-btn" aria-label="Cerrar sesión">
          <LogoutIcon size={17} aria-hidden="true" />
          <span className="sidebar__logout-label">Cerrar Sesión</span>
        </button>
      </div>
    </div>
    </>
  );
};
