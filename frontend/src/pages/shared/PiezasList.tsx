import React, { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { sileo } from "sileo";
import { useAuth } from "../../auth/authContext";
import { http } from "../../services/http";
import { getErrorMessage } from "../../utils/errorHelper";
import { Spinner } from "../../components/Spinner";
import { FilterBar } from "../../components/FilterBar";
import { AddIcon, EditIcon, DeleteIcon } from "../../components/Icons";
import "../adminView/WorkOrdersManager.css";
import "../adminView/UsersManager.css";
import "../adminView/WorkOrderFormBrand.css";
import { useConfirm } from "../../components/ConfirmDialog";

interface Pieza {
  id: number;
  codigo: string;
  nombre: string;
  descripcion: string | null;
  foto: string | null;
}

const PAGE_SIZE = 15;

export const PiezasList: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const role = (user as any)?.role;
  const basePath = role === "supervisor" ? "/supervisor" : "/admin";
  const isReadOnly = role === "supervisor";
  const confirm = useConfirm();

  const [piezas, setPiezas] = useState<Pieza[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);

  const load = () => {
    setLoading(true);
    http.get<Pieza[]>("/piezas")
      .then(r => setPiezas(r.data))
      .catch(() => sileo.error({ title: "Error al cargar piezas" }))
      .finally(() => setLoading(false));
  };
  useEffect(load, []);
  useEffect(() => { setCurrentPage(1); }, [searchTerm]);

  const handleDelete = async (e: React.MouseEvent, id: number, codigo: string) => {
    e.stopPropagation();
    if (!await confirm({ message: `¿Eliminar la pieza ${codigo}? Las órdenes que la usen quedarán sin pieza asignada.`, danger: true, confirmText: "Eliminar" })) return;
    try {
      await http.delete(`/piezas/${id}`);
      sileo.success({ title: "Pieza eliminada" });
      load();
    } catch (err: any) {
      sileo.error({ title: "Error", description: getErrorMessage(err) });
    }
  };

  const filtered = useMemo(() => {
    const q = searchTerm.toLowerCase().trim();
    if (!q) return piezas;
    return piezas.filter(p =>
      p.codigo.toLowerCase().includes(q) ||
      p.nombre.toLowerCase().includes(q) ||
      (p.descripcion ?? "").toLowerCase().includes(q)
    );
  }, [piezas, searchTerm]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const pageNumbers = Array.from({ length: totalPages }, (_, i) => i + 1)
    .filter(p => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 1)
    .reduce<(number | "...")[]>((acc, p, i, arr) => {
      if (i > 0 && (p as number) - (arr[i - 1] as number) > 1) acc.push("...");
      acc.push(p);
      return acc;
    }, []);

  return (
    <div className="animate-fade-in work-orders-manager">
      <div className="work-orders-manager__page-header">
        <div>
          <span className="wo-form__title-eyebrow">Catálogo</span>
          <h2 className="wo-form__title" style={{ margin: 0 }}>Piezas</h2>
        </div>
        {!isReadOnly && (
          <button className="wo-form__btn-primary" onClick={() => navigate(`${basePath}/piezas/nueva`)}>
            <AddIcon size={15} color="white" /> Crear Pieza
          </button>
        )}
      </div>

      {loading ? (
        <Spinner message="Cargando piezas..." />
      ) : (
        <>
          <FilterBar
            searchTerm={searchTerm}
            onSearchChange={setSearchTerm}
            searchPlaceholder="Buscar por código, nombre o descripción..."
          />

          <div className="table-container">
            <table className="modern-table work-orders-manager__table--hoverable">
              <thead>
                <tr>
                  <th>Foto</th>
                  <th>Código</th>
                  <th>Nombre</th>
                  <th>Descripción</th>
                  <th className="users-manager__actions-cell">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {paginated.map(p => (
                  <tr key={p.id}
                    className="work-orders-manager__row--clickable"
                    onClick={() => navigate(`${basePath}/piezas/editar/${p.id}`)}>
                    <td onClick={e => e.stopPropagation()}>
                      <div style={{
                        width: 48, height: 48, borderRadius: 10, overflow: "hidden",
                        background: "var(--bg-subtle, var(--bg))",
                        border: "1px solid var(--border-color)",
                        display: "flex", alignItems: "center", justifyContent: "center",
                      }}>
                        {p.foto ? (
                          <img src={p.foto} alt={p.codigo} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                        ) : (
                          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ opacity: 0.35 }}>
                            <rect x="3" y="3" width="18" height="18" rx="2"/>
                            <circle cx="9" cy="9" r="2"/>
                            <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/>
                          </svg>
                        )}
                      </div>
                    </td>
                    <td className="work-orders-manager__code">{p.codigo}</td>
                    <td className="users-manager__name">{p.nombre}</td>
                    <td style={{ opacity: 0.75, fontSize: "0.88rem" }}>{p.descripcion ?? "—"}</td>
                    <td className="users-manager__actions-cell" onClick={e => e.stopPropagation()}>
                      {!isReadOnly && (
                        <div className="work-orders-manager__actions-flex">
                          <button onClick={() => navigate(`${basePath}/piezas/editar/${p.id}`)}
                            className="btn-primary users-manager__btn-sm">
                            <EditIcon size={14} color="white" /> Editar
                          </button>
                          <button onClick={(e) => handleDelete(e, p.id, p.codigo)}
                            className="btn-danger users-manager__btn-sm--last">
                            <DeleteIcon size={14} color="white" /> Eliminar
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={5} className="users-manager__empty">
                      No se encontraron piezas {searchTerm ? "que coincidan con la búsqueda" : "registradas"}.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>

            {totalPages > 1 && (
              <div className="pagination">
                <span className="pagination__info">
                  {(currentPage - 1) * PAGE_SIZE + 1}–{Math.min(currentPage * PAGE_SIZE, filtered.length)} de {filtered.length}
                </span>
                <div className="pagination__controls">
                  <button className="pagination__btn" disabled={currentPage === 1} onClick={() => setCurrentPage(p => p - 1)}>‹ Anterior</button>
                  {pageNumbers.map((p, i) =>
                    p === "..." ? (
                      <span key={`dots-${i}`} className="pagination__dots">…</span>
                    ) : (
                      <button key={p}
                        className={`pagination__btn ${currentPage === p ? "pagination__btn--active" : ""}`}
                        onClick={() => setCurrentPage(p as number)}>{p}</button>
                    )
                  )}
                  <button className="pagination__btn" disabled={currentPage === totalPages} onClick={() => setCurrentPage(p => p + 1)}>Siguiente ›</button>
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};
