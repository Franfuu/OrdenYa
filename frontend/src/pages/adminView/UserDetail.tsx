import React, { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../../auth/authContext";
import { sileo } from "sileo";
import { userService, User } from "../../services/userService";
import { Spinner } from "../../components/Spinner";
import { EditIcon, DeleteIcon, CancelIcon } from "../../components/Icons";
import { getErrorMessage } from "../../utils/errorHelper";
import { useConfirm } from "../../components/ConfirmDialog";
import "./UserDetail.css";

export const UserDetail: React.FC = () => {
  const confirm = useConfirm();
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { user: authUser } = useAuth();
  const isReadOnly = (authUser as any)?.role === 'jefe';

  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    userService
      .getUser(Number(id))
      .then((data) => {
        setUser(data);
        setError(null);
      })
      .catch((err: any) => {
        setError(err.response?.data?.message || err.message || "Error al cargar usuario");
      })
      .finally(() => setLoading(false));
  }, [id]);

  const handleDelete = async () => {
    if (!user) return;
    if (!await confirm({ message: `¿Eliminar a "${user.name}"? Esta acción es irreversible.`, danger: true, confirmText: "Eliminar" })) return;
    try {
      await userService.deleteUser(user.id);
      sileo.success({ 
        title: "Usuario eliminado", 
        description: "La cuenta de usuario ha sido borrada del sistema." 
      });
      navigate("/admin/usuarios/lista");
    } catch (err: any) {
      sileo.error({ 
        title: "Error al eliminar", 
        description: getErrorMessage(err) 
      });
    }
  };

  const roleLabel: Record<string, string> = {
    admin: "Administrador",
    supervisor: "Supervisor",
    trabajador: "Trabajador",
  };

  if (loading) return <Spinner message="Cargando usuario..." />;
  if (error)   return <p className="detail-error">{error}</p>;
  if (!user)   return null;

  return (
    <div className="animate-fade-in user-detail">
      {/* Header */}
      <div className="detail-header">
        <button className="btn-outline" onClick={() => navigate("/admin/usuarios/lista")}>
          <CancelIcon size={15} /> Volver a la lista
        </button>
        {!isReadOnly && (
          <div className="detail-header__actions">
            <button
              className="btn-primary"
              onClick={() => navigate(`/admin/usuarios/editar/${user.id}`)}
            >
              <EditIcon size={15} color="white" /> Editar
            </button>
            <button className="btn-danger" onClick={handleDelete}>
              <DeleteIcon size={15} color="white" /> Eliminar
            </button>
          </div>
        )}
      </div>

      {/* Card principal */}
      <div className="glass-card user-detail__card">
        {/* Avatar + nombre + badge */}
        <div className="user-detail__hero">
          <div className="user-detail__avatar">
            {user.name.charAt(0).toUpperCase()}
          </div>
          <div className="user-detail__hero-info">
            <h2 className="user-detail__name">{user.name}</h2>
            <span className={`badge badge-${user.role} user-detail__role-badge`}>
              {roleLabel[user.role] ?? user.role}
            </span>
          </div>
        </div>

        {/* Grid de campos */}
        <div className="user-detail__grid">
          <div className="user-detail__field">
            <span className="user-detail__field-label">ID</span>
            <span className="user-detail__field-value">#{user.id}</span>
          </div>
          <div className="user-detail__field">
            <span className="user-detail__field-label">Correo electrónico</span>
            <span className="user-detail__field-value">{user.email}</span>
          </div>
          <div className="user-detail__field">
            <span className="user-detail__field-label">Rol</span>
            <span className="user-detail__field-value">{roleLabel[user.role] ?? user.role}</span>
          </div>
          <div className="user-detail__field">
            <span className="user-detail__field-label">Departamento</span>
            <span className="user-detail__field-value">{user.departamento ?? 'General'}</span>
          </div>
          {user.created_at && (
            <div className="user-detail__field">
              <span className="user-detail__field-label">Fecha de creación</span>
              <span className="user-detail__field-value">
                {new Date(user.created_at).toLocaleDateString("es-ES", {
                  day: "2-digit", month: "long", year: "numeric",
                })}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
