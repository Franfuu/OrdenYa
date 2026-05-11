import React, { useState, useEffect } from "react";
import { sileo } from "sileo";
import { useAuth } from "../../auth/authContext";
import { http } from "../../services/http";
import { getErrorMessage } from "../../utils/errorHelper";
import "./Profile.css";

interface Stats {
  total_seconds?: number;
  total_piezas?: number;
  orders?: { sessions_count?: number }[];
}

const fmtHours = (secs: number) => {
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  return `${h}h ${m}m`;
};

export const Profile: React.FC = () => {
  const { user, updateUser } = useAuth();
  const [stats, setStats] = useState<Stats | null>(null);

  const role = (user as any)?.role;
  const showStats = role === "trabajador";

  useEffect(() => {
    const uid = (user as any)?.id;
    if (!uid || !showStats) return;
    http.get<any>(`/users/${uid}/stats`)
      .then(r => setStats(r.data ?? null))
      .catch(() => setStats(null));
  }, [user, showStats]);

  const [formData, setFormData] = useState({
    name:     (user as any)?.name  || "",
    email:    (user as any)?.email || "",
    password: "",
  });
  const [loading, setLoading] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);

    try {
      const payload: any = { ...formData };
      if (!payload.password) delete payload.password;

      // Usamos PUT /auth/profile — endpoint accesible para cualquier rol autenticado.
      // Admin, supervisor y trabajador pueden actualizar su propio perfil.
      const response = await http.put<any>("/auth/profile", payload);
      const updatedUser = response.data?.data ?? response.data;

      // Propaga el cambio al AuthContext → Sidebar y Topbar se actualizan al momento
      updateUser({ name: updatedUser.name ?? formData.name, email: updatedUser.email ?? formData.email });

      // Limpia la contraseña por seguridad tras guardar
      setFormData(prev => ({ ...prev, password: "" }));

      sileo.success({ 
        title: "Perfil actualizado", 
        description: "Tus datos personales se han guardado correctamente." 
      });
    } catch (err: any) {
      sileo.error({ 
        title: "Error al actualizar", 
        description: getErrorMessage(err) 
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="animate-fade-in profile-wrapper">
      <h2 className="profile-title">Mi Perfil</h2>

      {showStats && stats && (
        <div className="glass-card" style={{ padding: "1.2rem 1.4rem", marginBottom: "1rem" }}>
          <h3 style={{ margin: 0, marginBottom: "0.8rem", fontSize: "1rem" }}>Estadísticas de actividad</h3>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: "0.8rem" }}>
            <div>
              <div style={{ fontSize: "0.75rem", opacity: 0.7, textTransform: "uppercase", fontWeight: 700 }}>Sesiones</div>
              <div style={{ fontSize: "1.6rem", fontWeight: 800, color: "#3b82f6" }}>{(stats.orders ?? []).reduce((s, o) => s + (o.sessions_count ?? 0), 0)}</div>
            </div>
            <div>
              <div style={{ fontSize: "0.75rem", opacity: 0.7, textTransform: "uppercase", fontWeight: 700 }}>Tiempo total</div>
              <div style={{ fontSize: "1.6rem", fontWeight: 800, color: "#10b981" }}>{fmtHours(stats.total_seconds ?? 0)}</div>
            </div>
            <div>
              <div style={{ fontSize: "0.75rem", opacity: 0.7, textTransform: "uppercase", fontWeight: 700 }}>Piezas</div>
              <div style={{ fontSize: "1.6rem", fontWeight: 800, color: "#f59e0b" }}>{stats.total_piezas ?? 0}</div>
            </div>
          </div>
        </div>
      )}

      <div className="glass-card profile-card">
        <form onSubmit={handleSubmit} className="profile-form">
          <div>
            <label className="profile-label">Nombre</label>
            <input
              name="name"
              value={formData.name}
              onChange={handleChange}
              required
              className="input-base profile-input"
              placeholder="Tu nombre completo"
            />
          </div>
          <div>
            <label className="profile-label">Correo Electrónico</label>
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              required
              className="input-base profile-input"
              placeholder="correo@ejemplo.com"
            />
          </div>
          <div>
            <label className="profile-label">
              Nueva Contraseña{" "}
              <span className="profile-label-hint">(Dejar en blanco para no cambiar)</span>
            </label>
            <input
              type="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              autoComplete="new-password"
              className="input-base profile-input"
              placeholder="Nueva contraseña"
            />
          </div>

          <button type="submit" className="btn-primary profile-submit" disabled={loading}>
            {loading ? "Guardando..." : "Guardar Cambios"}
          </button>
        </form>
      </div>
    </div>
  );
};
