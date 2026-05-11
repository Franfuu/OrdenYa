import React, { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../auth/authContext";
import { storageUrl } from "../../utils/storageUrl";
import { workOrderService } from "../../services/workOrderService";
import { Spinner } from "../../components/Spinner";
import { StatsGrid } from "../../components/StatsGrid";
import { FilterBar } from "../../components/FilterBar";
import { ImageIcon } from "../../components/Icons";
import { ImageModal } from "../../components/ImageModal";
import type { WorkOrder } from "../../types/WorkOrder";
import { isOrderFinalizada } from "../../types/WorkOrder";
import "../adminView/WorkOrdersManager.css";

const DEPT_COLORS: Record<string, string> = {
  taller: "#534AB7", instalacion: "#1D9E75",
};
const DEPT_LABELS: Record<string, string> = {
  taller: "Taller", instalacion: "Instalación",
};

const PAGE_SIZE = 15;
type SortKey = "codigo_orden" | "nombre_orden" | "fecha_fin" | null;

function getDeadlineBadge(fechaFin: string | null | undefined) {
  if (!fechaFin) return null;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const deadline = new Date(fechaFin); deadline.setHours(0, 0, 0, 0);
  const diffDays = Math.ceil((deadline.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  const dateStr = deadline.toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit", year: "2-digit" });
  if (diffDays < 0)  return { label: dateStr, cls: "deadline--overdue" };
  if (diffDays <= 7) return { label: dateStr, cls: "deadline--soon" };
  return { label: dateStr, cls: "deadline--ok" };
}

function SortIndicator({ col, sortKey, sortDir }: { col: SortKey; sortKey: SortKey; sortDir: "asc" | "desc" }) {
  if (sortKey !== col) return <span className="sort-icon sort-icon--neutral">↕</span>;
  return <span className="sort-icon">{sortDir === "asc" ? "↑" : "↓"}</span>;
}

export const TrabajadorWorkOrdersList: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const detailBasePath = user?.role === "supervisor" ? "/supervisor/mis-trabajos" : "/trabajador/ordenes";

  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState("Todos");
  const [selectedImage, setSelectedImage] = useState<{ src: string; alt: string } | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [sortKey, setSortKey] = useState<SortKey>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const res = await workOrderService.getAll();
        setWorkOrders(Array.isArray(res) ? res : ((res as any).data || []));
        setError(null);
      } catch (err: any) {
        setError(err.response?.data?.message || err.message || "Error al obtener órdenes");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  useEffect(() => { setCurrentPage(1); }, [searchTerm, filterStatus, sortKey]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDir("asc"); }
  };

  const filteredOrders = useMemo(() => {
    let result = workOrders.filter(o => {
      const finalizada = isOrderFinalizada(o);
      const matchStatus =
        filterStatus === "Todos" ||
        (filterStatus === "En curso" && !finalizada) ||
        (filterStatus === "Finalizada" && finalizada);

      const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
      const q = norm(searchTerm);
      const matchSearch = !q || [
        o.codigo_orden, o.nombre_orden, o.codigo_cliente?.toString(),
        o.nombre_cliente, o.numero_pedido?.toString(), o.modelo,
      ].some(v => v && norm(v).includes(q));

      return matchStatus && matchSearch;
    });

    if (sortKey) {
      const getVal = (o: WorkOrder): string => {
        if (sortKey === "codigo_orden") return o.codigo_orden ?? "";
        if (sortKey === "nombre_orden") return o.nombre_orden ?? "";
        if (sortKey === "fecha_fin")    return o.fecha_fin ?? "9999";
        return "";
      };
      result = [...result].sort((a, b) => {
        const cmp = getVal(a).localeCompare(getVal(b), "es", { numeric: true });
        return sortDir === "asc" ? cmp : -cmp;
      });
    }

    return result;
  }, [workOrders, searchTerm, filterStatus, sortKey, sortDir]);

  const stats = useMemo(() => ({
    total: filteredOrders.length,
    enCurso: filteredOrders.filter(o => !isOrderFinalizada(o)).length,
    finalizadas: filteredOrders.filter(o => isOrderFinalizada(o)).length,
  }), [filteredOrders]);

  const totalPages = Math.max(1, Math.ceil(filteredOrders.length / PAGE_SIZE));
  const paginated = filteredOrders.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const pageNumbers = Array.from({ length: totalPages }, (_, i) => i + 1)
    .filter(p => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 1)
    .reduce<(number | "...")[]>((acc, p, i, arr) => {
      if (i > 0 && (p as number) - (arr[i - 1] as number) > 1) acc.push("...");
      acc.push(p);
      return acc;
    }, []);

  if (loading) return <Spinner message="Cargando mis trabajos..." />;

  return (
    <div className="animate-fade-in work-orders-manager">
      <div className="work-orders-manager__page-header">
        <h2 className="work-orders-manager__title">Mis Trabajos Asignados</h2>
      </div>

      {error ? (
        <p className="work-orders-manager__error">{error}</p>
      ) : (
        <>
          <StatsGrid stats={[
            { label: "Total Asignados", value: stats.total },
            { label: "En curso", value: stats.enCurso, colorClass: "text-taller" },
            { label: "Finalizadas", value: stats.finalizadas, colorClass: "text-finalizada" },
          ]} />

          <FilterBar
            searchTerm={searchTerm}
            onSearchChange={setSearchTerm}
            searchPlaceholder="Buscar por código, nombre, cliente, modelo..."
            filterValue={filterStatus}
            onFilterChange={setFilterStatus}
            filterOptions={[
              { value: "Todos", label: "Todos" },
              { value: "En curso", label: "En curso" },
              { value: "Finalizada", label: "Finalizadas" },
            ]}
          />

          <div className="table-container">
            {selectedImage && (
              <ImageModal src={selectedImage.src} alt={selectedImage.alt} onClose={() => setSelectedImage(null)} />
            )}
            <table className="modern-table work-orders-manager__table--hoverable">
              <thead>
                <tr>
                  <th className="sortable-th" onClick={() => handleSort("codigo_orden")}>
                    Código <SortIndicator col="codigo_orden" sortKey={sortKey} sortDir={sortDir} />
                  </th>
                  <th>Foto</th>
                  <th className="sortable-th" onClick={() => handleSort("nombre_orden")}>
                    Nombre <SortIndicator col="nombre_orden" sortKey={sortKey} sortDir={sortDir} />
                  </th>
                  <th>Modelo</th>
                  <th>Estado</th>
                  <th className="sortable-th" onClick={() => handleSort("fecha_fin")}>
                    Fecha límite <SortIndicator col="fecha_fin" sortKey={sortKey} sortDir={sortDir} />
                  </th>
                  <th>Mis Departamentos</th>
                </tr>
              </thead>
              <tbody>
                {paginated.map(o => {
                  const finalizada = isOrderFinalizada(o);
                  const deadline = getDeadlineBadge(o.fecha_fin);
                  const myDepts = (o.departments ?? []).filter(d =>
                    (d.workers ?? []).some(w => w.user_id === user?.id)
                  );
                  return (
                    <tr
                      key={o.id}
                      className="work-orders-manager__row--clickable"
                      onClick={() => navigate(`${detailBasePath}/${o.id}`)}
                    >
                      <td className="work-orders-manager__code">{o.codigo_orden}</td>
                      <td onClick={e => e.stopPropagation()}>
                        {o.imagen ? (
                          <div className="work-orders-manager__thumbnail-wrap"
                            onClick={() => setSelectedImage({ src: storageUrl(o.imagen)!, alt: o.nombre_orden })}>
                            <img src={storageUrl(o.imagen) ?? ''} alt="Miniatura" className="work-orders-manager__thumbnail" />
                          </div>
                        ) : (
                          <div className="work-orders-manager__no-image"><ImageIcon size={16} color="#ccc" /></div>
                        )}
                      </td>
                      <td><strong>{o.nombre_orden}</strong></td>
                      <td>{o.modelo || "—"}</td>
                      <td>
                        <span className={`work-orders-manager__status-badge ${finalizada ? "work-orders-manager__status-badge--finalizada" : "work-orders-manager__status-badge--taller"}`}>
                          {finalizada ? "Finalizada" : "En curso"}
                        </span>
                      </td>
                      <td>
                        {deadline
                          ? <span className={`deadline-badge ${deadline.cls}`}>{deadline.label}</span>
                          : <span className="deadline-badge deadline--none">—</span>
                        }
                      </td>
                      <td>
                        <div style={{ display: "flex", gap: "0.3rem", flexWrap: "wrap" }}>
                          {myDepts.length > 0 ? myDepts.map(d => {
                            const slug = d.department?.slug ?? "";
                            const color = DEPT_COLORS[slug] ?? "#6b7280";
                            return (
                              <span key={d.id} style={{ fontSize: "0.72rem", padding: "0.1rem 0.5rem", borderRadius: 999, background: `${color}20`, color, border: `1px solid ${color}40`, fontWeight: 600 }}>
                                {DEPT_LABELS[slug] ?? slug}
                              </span>
                            );
                          }) : <span style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>—</span>}
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {filteredOrders.length === 0 && (
                  <tr><td colSpan={7} className="work-orders-manager__empty">No se encontraron órdenes asignadas.</td></tr>
                )}
              </tbody>
            </table>

            {totalPages > 1 && (
              <div className="pagination">
                <span className="pagination__info">
                  {(currentPage - 1) * PAGE_SIZE + 1}–{Math.min(currentPage * PAGE_SIZE, filteredOrders.length)} de {filteredOrders.length}
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
