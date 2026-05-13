import React, { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { sileo } from "sileo";
import { userService, User, Departamento } from "../../services/userService";
import { SaveIcon, CancelIcon } from "../../components/Icons";
import { showHttpError } from "../../utils/errorHelper";
import "./WorkOrderFormBrand.css";

export const UserForm: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id?: string }>();
  const isEditing = Boolean(id);

  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    role: "trabajador" as User["role"],
    departamento: "Taller" as Departamento,
  });
  const [loading, setLoading] = useState(false);
  const [fetchLoading, setFetchLoading] = useState(isEditing);

  useEffect(() => {
    if (isEditing && id) {
      setFetchLoading(true);
      userService.getUser(Number(id))
        .then(user => {
          setFormData({
            name: user.name,
            email: user.email,
            password: "",
            role: user.role || "trabajador",
            departamento: user.departamento || "Taller",
          });
        })
        .catch(() => sileo.error({ title: "Error al cargar", description: "No se pudo cargar el usuario." }))
        .finally(() => setFetchLoading(false));
    }
  }, [id]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    try {
      const payload: any = { ...formData };
      if (isEditing && !payload.password) delete payload.password;
      if (isEditing && id) {
        await userService.updateUser(Number(id), payload);
      } else {
        await userService.createUser(payload);
      }
      sileo.success({ title: isEditing ? "Usuario actualizado" : "Usuario creado" });
      navigate("/admin/usuarios/lista");
    } catch (err: any) {
      showHttpError(err, "Error al guardar usuario");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="wo-form">
      <div className="wo-form__header">
        <div>
          <span className="wo-form__title-eyebrow">{isEditing ? "Edición" : "Nuevo usuario"}</span>
          <h2 className="wo-form__title">{isEditing ? "Editar Usuario" : "Crear Nuevo Usuario"}</h2>
        </div>
        <button type="button" className="wo-form__btn-outline" onClick={() => navigate(-1)}>
          <CancelIcon size={15} /> Volver
        </button>
      </div>

      <form onSubmit={handleSubmit} className="wo-form__card">
        <section className="wo-form__section">
          <h3 className="wo-form__section-title">Datos personales</h3>
          <div className="wo-form__grid">
            <div className="wo-form__field">
              <label htmlFor="uf-name" className="wo-form__field-label wo-form__field-label--required">Nombre completo</label>
              <input id="uf-name" type="text" value={formData.name} disabled={fetchLoading}
                onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))}
                placeholder="Ej: Juan Pérez" required />
            </div>
            <div className="wo-form__field">
              <label htmlFor="uf-email" className="wo-form__field-label wo-form__field-label--required">Correo electrónico</label>
              <input id="uf-email" type="email" value={formData.email} disabled={fetchLoading}
                onChange={e => setFormData(prev => ({ ...prev, email: e.target.value }))}
                placeholder="usuario@empresa.com" required />
            </div>
          </div>
        </section>

        <section className="wo-form__section">
          <h3 className="wo-form__section-title">Acceso y rol</h3>
          <div className="wo-form__grid">
            <div className="wo-form__field">
              <label htmlFor="uf-password" className="wo-form__field-label">
                Contraseña{isEditing && <span style={{ opacity: 0.6, marginLeft: 6, textTransform: "none", letterSpacing: 0 }}>(opcional)</span>}
              </label>
              <input id="uf-password" type="password" value={formData.password} disabled={fetchLoading}
                onChange={e => setFormData(prev => ({ ...prev, password: e.target.value }))}
                placeholder={isEditing ? "••••••••" : "Contraseña segura"}
                required={!isEditing} autoComplete="new-password" />
            </div>
            <div className="wo-form__field">
              <label htmlFor="uf-role" className="wo-form__field-label wo-form__field-label--required">Rol</label>
              <select id="uf-role" value={formData.role} disabled={fetchLoading}
                onChange={e => setFormData(prev => ({ ...prev, role: e.target.value as User["role"] }))}>
                <option value="admin">Administrador</option>
                <option value="supervisor">Supervisor</option>
                <option value="trabajador">Trabajador</option>
              </select>
            </div>
            <div className="wo-form__field">
              <label htmlFor="uf-dept" className="wo-form__field-label">Departamento</label>
              <select id="uf-dept" value={formData.departamento} disabled={fetchLoading}
                onChange={e => setFormData(prev => ({ ...prev, departamento: e.target.value as Departamento }))}>
                <option value="Taller">Taller</option>
                <option value="Instalacion">Instalación</option>
              </select>
            </div>
          </div>
        </section>

        <div className="wo-form__actions">
          <button type="submit" className="wo-form__btn-primary" disabled={loading || fetchLoading}>
            <SaveIcon size={15} /> {loading ? "Guardando..." : (isEditing ? "Guardar cambios" : "Crear Usuario")}
          </button>
          <button type="button" className="wo-form__btn-outline" onClick={() => navigate(-1)}>
            <CancelIcon size={15} /> Cancelar
          </button>
        </div>
      </form>
    </div>
  );
};
