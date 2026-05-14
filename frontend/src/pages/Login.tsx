import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { authService } from "../services/authService";
import { useAuth } from "../auth/authContext";
import { sileo } from "sileo";
import { getErrorMessage } from "../utils/errorHelper";
import { OrdenYaWordmark } from "../components/OrdenYaWordmark";
import "./Login.css";

export const Login: React.FC = () => {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [email, setEmail] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const resp = await authService.login(email, password);
      login(resp.user);
      sileo.success({
        title: "¡Bienvenido!",
        description: `Hola ${resp.user.name}, has iniciado sesión.`
      });
      const role = String((resp.user as any)?.role || "").toLowerCase().trim();
      if (role === "admin") navigate("/admin", { replace: true });
      else if (role === "supervisor") navigate("/supervisor", { replace: true });
      else navigate("/trabajador", { replace: true });
    } catch (err: any) {
      sileo.error({ title: "Fallo al entrar", description: getErrorMessage(err) });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="login-wrapper">
      <aside className="login-hero">
        <div className="login-hero__orb login-hero__orb--amber" />
        <div className="login-hero__orb login-hero__orb--violet" />

        <div className="login-hero__top">
          <div className="login-hero__brand">
            <OrdenYaWordmark size={48} variant="light" showTag />
          </div>

          <span className="login-hero__eyebrow">Gestión industrial · Tiempo real</span>

          <h1 className="login-hero__headline">
            Tu taller,<br />
            en <em>orden</em><br />
            al instante.
          </h1>

          <p className="login-hero__sub">
            Centraliza órdenes de trabajo, asigna piezas y trabajadores, y mide el rendimiento
            de tu equipo desde una plataforma diseñada para no perder el tiempo.
          </p>

          <div className="login-hero__stats">
            <div className="login-hero__stat">
              <div className="login-hero__stat-num">3<span>.</span></div>
              <div className="login-hero__stat-label">Roles definidos</div>
            </div>
            <div className="login-hero__stat">
              <div className="login-hero__stat-num">24<span>/7</span></div>
              <div className="login-hero__stat-label">Seguimiento</div>
            </div>
            <div className="login-hero__stat">
              <div className="login-hero__stat-num">100<span>%</span></div>
              <div className="login-hero__stat-label">Trazabilidad</div>
            </div>
          </div>
        </div>

        <div className="login-hero__footer">
          <span>© OrdenYa 2026 · Todos los derechos reservados</span>
          <div className="login-hero__footer-dots">
            <span /><span /><span />
          </div>
        </div>
      </aside>

      <main className="login-form-side">
        <div className="login-card">
          <span className="login-eyebrow">Acceso seguro</span>
          <h2 className="login-title">Bienvenido.</h2>
          <p className="login-title-sub">Inicia sesión para seguir con tu jornada.</p>

          <form onSubmit={handleSubmit} className="login-form">
            <div className="login-field">
              <label htmlFor="login-email" className="login-label">Correo electrónico</label>
              <input
                id="login-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="tu@email.com"
                autoComplete="email"
              />
            </div>
            <div className="login-field">
              <label htmlFor="login-password" className="login-label">Contraseña</label>
              <input
                id="login-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder="••••••••"
                autoComplete="current-password"
              />
            </div>
            <button type="submit" disabled={isLoading} className="login-submit">
              {isLoading ? 'Comprobando…' : 'Entrar →'}
            </button>
          </form>

          <div className="login-hint">
            <strong>Demo:</strong> usa <code>admin@admin.com</code> / <code>carlos@supervisor.com</code> / <code>maria@trabajador.com</code> con contraseña <code>admin123</code>.
          </div>
        </div>
      </main>
    </div>
  );
};
