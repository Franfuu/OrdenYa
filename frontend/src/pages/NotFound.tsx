import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/authContext';
import { OrdenYaWordmark } from '../components/OrdenYaWordmark';
import './NotFound.css';

export const NotFound: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  const homePath = (() => {
    const role = String((user as any)?.role ?? '').toLowerCase();
    if (role === 'admin') return '/admin';
    if (role === 'supervisor') return '/supervisor';
    if (role === 'trabajador') return '/trabajador';
    return '/login';
  })();

  return (
    <div className="notfound">
      <div className="notfound__orb notfound__orb--amber" />
      <div className="notfound__orb notfound__orb--violet" />

      <div className="notfound__brand">
        <OrdenYaWordmark size={42} variant="light" showTag />
      </div>

      <div className="notfound__content">
        <span className="notfound__eyebrow">Error 404</span>
        <h1 className="notfound__code">4<span className="notfound__zero">0</span>4</h1>
        <h2 className="notfound__title">Página no encontrada</h2>
        <p className="notfound__sub">
          La ruta que buscas no existe, fue movida o nunca formó parte de OrdenYa.
        </p>

        <div className="notfound__actions">
          <button
            type="button"
            className="notfound__btn notfound__btn--ghost"
            onClick={() => navigate(-1)}
          >
            ← Volver atrás
          </button>
          <Link to={homePath} className="notfound__btn notfound__btn--primary">
            Ir al inicio
          </Link>
        </div>
      </div>
    </div>
  );
};
