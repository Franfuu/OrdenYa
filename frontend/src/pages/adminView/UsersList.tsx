import React, { useState, useEffect, useMemo } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../../auth/authContext";
import { sileo } from "sileo";
import { userService, User } from "../../services/userService";
import { Spinner } from "../../components/Spinner";
import { StatsGrid } from "../../components/StatsGrid";
import { FilterBar } from "../../components/FilterBar";
import { EditIcon, DeleteIcon, AddIcon } from "../../components/Icons";
import { getErrorMessage } from "../../utils/errorHelper";
import "./UsersManager.css";
import "./WorkOrdersManager.css";
import "./WorkOrderFormBrand.css";
import { useConfirm } from "../../components/ConfirmDialog";

const PAGE_SIZE = 15;
type SortKey = "id" | "name" | "email" | "role" | "departamento" | null;

function SortIndicator({ col, sortKey, sortDir }: { col: SortKey; sortKey: SortKey; sortDir: "asc" | "desc" }) {
  if (sortKey !== col) return <span className="sort-icon sort-icon--neutral">↕</span>;
  return <span className="sort-icon">{sortDir === "asc" ? "↑" : "↓"}</span>;
}

const ROLE_LABEL: Record<string, string> = {
  admin: "Admin", supervisor: "Supervisor", trabajador: "Trabajador", jefe: "Superusuario",
};

export const UsersList: React.FC = () => {
  const navigate = useNavigate();
  const { key: locationKey } = useLocation();
  const { user } = useAuth();
  const isReadOnly = (user as any)?.role === "jefe";
  const basePath = isReadOnly ? "/jefe" : "/admin";
  const confirm = useConfirm();

  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterRole, setFilterRole] = useState("Todos");
  const [currentPage, setCurrentPage] = useState(1);
  const [sortKey, setSortKey] = useState<SortKey>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const data = await userService.getUsers();
      setUsers(data);
      setError(null);
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || "Error al obtener usuarios");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchUsers(); }, [locationKey]);
  useEffect(() => { setCurrentPage(1); }, [searchTerm, filterRole, sortKey]);

  const handleDelete = async (e: React.MouseEvent, id: number) => {
    e.stopPropagation();
    if (!await confirm({ message: "¿Eliminar este usuario? La acción es irreversible.", danger: true, confirmText: "Eliminar" })) return;
    try {
      await userService.deleteUser(id);
      sileo.success({ title: "Usuario eliminado", description: "El usuario ha sido borrado del sistema." });
      fetchUsers();
    } catch (err: any) {
      sileo.error({ title: "Error al eliminar", description: getErrorMessage(err) });
    }
  };

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDir("asc"); }
  };

  const filteredUsers = useMemo(() => {
    let result = users.filter(u => {
      const matchRole = filterRole === "Todos" || u.role === filterRole;
      const q = searchTerm.toLowerCase();
      const matchSearch = !q || u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q);
      return matchRole && matchSearch;
    });

    if (sortKey) {
      result = [...result].sort((a, b) => {
        const va = String((a as any)[sortKey] ?? "");
        const vb = String((b as any)[sortKey] ?? "");
        const cmp = sortKey === "id"
          ? (Number(va) - Number(vb))
          : va.localeCompare(vb, "es", { numeric: true });
        return sortDir === "asc" ? cmp : -cmp;
      });
    }

    return result;
  }, [users, searchTerm, filterRole, sortKey, sortDir]);

  const stats = useMemo(() => ({
    total: filteredUsers.length,
    admins: filteredUsers.filter(u => u.role === "admin").length,
    supervisors: filteredUsers.filter(u => u.role === "supervisor").length,
    workers: filteredUsers.filter(u => u.role === "trabajador").length,
    jefes: filteredUsers.filter(u => u.role === "jefe").length,
  }), [filteredUsers]);

  const totalPages = Math.max(1, Math.ceil(filteredUsers.length / PAGE_SIZE));
  const paginated = filteredUsers.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const pageNumbers = Array.from({ length: totalPages }, (_, i) => i + 1)
    .filter(p => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 1)
    .reduce<(number | "...")[]>((acc, p, i, arr) => {
      if (i > 0 && (p as number) - (arr[i - 1] as number) > 1) acc.push("...");
      acc.push(p);
      return acc;
    }, []);

  return (
    <div className="animate-fade-in users-manager">
      <div className="users-manager__header">
        <div>
          <span className="wo-form__title-eyebrow">Equipo</span>
          <h2 className="wo-form__title" style={{ margin: 0 }}>Usuarios</h2>
        </div>
        {!isReadOnly && (
          <button className="wo-form__btn-primary" onClick={() => navigate("/admin/usuarios/nuevo")}>
            <AddIcon size={15} color="white" /> Crear Usuario
          </button>
        )}
      </div>

      {loading ? (
        <Spinner message="Cargando usuarios..." />
      ) : error ? (
        <p className="users-manager__error">{error}</p>
      ) : (
        <>
          <StatsGrid stats={[
            { label: "Total Usuarios", value: stats.total },
            { label: "Admins", value: stats.admins },
            { label: "Supervisores", value: stats.supervisors },
            { label: "Trabajadores", value: stats.workers },
            ...(stats.jefes > 0 ? [{ label: "Jefes", value: stats.jefes }] : []),
          ]} />

          <FilterBar
            searchTerm={searchTerm}
            onSearchChange={setSearchTerm}
            searchPlaceholder="Buscar por nombre o email..."
            filterValue={filterRole}
            onFilterChange={setFilterRole}
            filterOptions={[
              { value: "Todos", label: "Todos los Roles" },
              { value: "admin", label: "Admin" },
              { value: "supervisor", label: "Supervisor" },
              { value: "trabajador", label: "Trabajador" },
            ]}
          />

          <div className="table-container">
            <table className="modern-table work-orders-manager__table--hoverable">
              <thead>
                <tr>
                  <th className="sortable-th" onClick={() => handleSort("id")}>
                    ID <SortIndicator col="id" sortKey={sortKey} sortDir={sortDir} />
                  </th>
                  <th className="sortable-th" onClick={() => handleSort("name")}>
                    Nombre <SortIndicator col="name" sortKey={sortKey} sortDir={sortDir} />
                  </th>
                  <th className="sortable-th" onClick={() => handleSort("email")}>
                    Email <SortIndicator col="email" sortKey={sortKey} sortDir={sortDir} />
                  </th>
                  <th className="sortable-th" onClick={() => handleSort("role")}>
                    Rol <SortIndicator col="role" sortKey={sortKey} sortDir={sortDir} />
                  </th>
                  <th className="sortable-th" onClick={() => handleSort("departamento")}>
                    Departamento <SortIndicator col="departamento" sortKey={sortKey} sortDir={sortDir} />
                  </th>
                  {!isReadOnly && <th className="users-manager__actions-cell">Acciones</th>}
                </tr>
              </thead>
              <tbody>
                {paginated.map(u => (
                  <tr
                    key={u.id}
                    className="work-orders-manager__row--clickable"
                    onClick={() => navigate(`${basePath}/usuarios/ver/${u.id}`)}
                  >
                    <td>{u.id}</td>
                    <td className="users-manager__name">{u.name}</td>
                    <td>{u.email}</td>
                    <td>
                      <span className={`badge badge-${u.role}`}>
                        {ROLE_LABEL[u.role] ?? u.role}
                      </span>
                    </td>
                    <td>{u.departamento ?? "—"}</td>
                    {!isReadOnly && (
                      <td className="users-manager__actions-cell" onClick={e => e.stopPropagation()}>
                        <div className="work-orders-manager__actions-flex">
                          <button
                            onClick={() => navigate(`/admin/usuarios/editar/${u.id}`)}
                            className="btn-primary users-manager__btn-sm"
                          >
                            <EditIcon size={14} color="white" /> Editar
                          </button>
                          <button
                            onClick={(e) => handleDelete(e, u.id)}
                            className="btn-danger users-manager__btn-sm--last"
                          >
                            <DeleteIcon size={14} color="white" /> Eliminar
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
                {filteredUsers.length === 0 && (
                  <tr>
                    <td colSpan={isReadOnly ? 5 : 6} className="users-manager__empty">
                      No se encontraron usuarios que coincidan con la búsqueda.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>

            {totalPages > 1 && (
              <div className="pagination">
                <span className="pagination__info">
                  {(currentPage - 1) * PAGE_SIZE + 1}–{Math.min(currentPage * PAGE_SIZE, filteredUsers.length)} de {filteredUsers.length}
                </span>
                <div className="pagination__controls">
                  <button className="pagination__btn" disabled={currentPage === 1} onClick={() => setCurrentPage(p => p - 1)}>
                    ‹ Anterior
                  </button>
                  {pageNumbers.map((p, i) =>
                    p === "..." ? (
                      <span key={`dots-${i}`} className="pagination__dots">…</span>
                    ) : (
                      <button
                        key={p}
                        className={`pagination__btn ${currentPage === p ? "pagination__btn--active" : ""}`}
                        onClick={() => setCurrentPage(p as number)}
                      >
                        {p}
                      </button>
                    )
                  )}
                  <button className="pagination__btn" disabled={currentPage === totalPages} onClick={() => setCurrentPage(p => p + 1)}>
                    Siguiente ›
                  </button>
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};
