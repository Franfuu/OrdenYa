import React from 'react';
import { Link } from 'react-router-dom';
import { OrdenYaWordmark } from '../components/OrdenYaWordmark';
import './LandingPage.css';

const LandingPage: React.FC = () => {
  return (
    <div className="landing">
      <div className="landing__bg" />
      <div className="landing__grid" />
      <div className="landing__orb landing__orb--amber" />
      <div className="landing__orb landing__orb--violet" />

      <nav className="landing__nav">
        <OrdenYaWordmark size={46} variant="light" showTag />
        <div className="landing__nav-status">
          <span className="landing__nav-dot" />
          Sistema operativo
        </div>
      </nav>

      <div className="landing__hero">
        <div className="landing__hero-content">
          <span className="landing__eyebrow">Gestión industrial · Tiempo real</span>

          <h1 className="landing__headline">
            Tu taller,<br />
            en <em>orden</em><br />
            al instante.
          </h1>

          <p className="landing__sub">
            Centraliza órdenes de trabajo, asigna piezas y trabajadores, y mide el rendimiento
            de tu equipo desde una plataforma diseñada para no perder el tiempo.
          </p>

          <div className="landing__cta-row">
            <Link to="/login" className="landing__cta-primary">
              Iniciar sesión
              <svg width="18" height="14" viewBox="0 0 18 14" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M1 7H17M17 7L11 1M17 7L11 13" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </Link>
            <span className="landing__cta-helper">
              Tu equipo te está esperando.
            </span>
          </div>

          <div className="landing__stats">
            <div className="landing__stat">
              <div className="landing__stat-num">3<span>·</span></div>
              <div className="landing__stat-label">Roles definidos</div>
            </div>
            <div className="landing__stat">
              <div className="landing__stat-num">24<span>/7</span></div>
              <div className="landing__stat-label">Seguimiento</div>
            </div>
            <div className="landing__stat">
              <div className="landing__stat-num">100<span>%</span></div>
              <div className="landing__stat-label">Trazabilidad</div>
            </div>
          </div>
        </div>

        <div className="landing__visual">
          <div className="landing__ring" />
          <div className="landing__ring landing__ring--inner" />
          <img src="/logo_ordenya_pro.svg" alt="OrdenYa" className="landing__visual-logo" />
        </div>
      </div>

      <footer className="landing__footer">
        <span>© OrdenYa 2026 · Todos los derechos reservados</span>
        <div className="landing__footer-meta">
          <div className="landing__footer-dots">
            <span /><span /><span />
          </div>
          <span>Gestión de órdenes de trabajo</span>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
