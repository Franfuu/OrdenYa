import React, { useState, useEffect, useMemo } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../../auth/authContext";
import { storageUrl } from "../../utils/storageUrl";
import { sileo } from "sileo";
import { workOrderService } from "../../services/workOrderService";
import { Spinner } from "../../components/Spinner";
import { StatsGrid } from "../../components/StatsGrid";
import { FilterBar } from "../../components/FilterBar";
import type { WorkOrder } from "../../types/WorkOrder";
import { isOrderFinalizada } from "../../types/WorkOrder";
import { EditIcon, DeleteIcon, AddIcon, ImageIcon } from "../../components/Icons";
import { http } from "../../services/http";
import { QRCodeSVG } from "qrcode.react";
import { useConfirm } from "../../components/ConfirmDialog";
import "./WorkOrderFormBrand.css";
import { getErrorMessage } from "../../utils/errorHelper";
import { ImageModal } from "../../components/ImageModal";
import { useWorkOrdersChannel } from "../../hooks/useWorkOrdersChannel";
import "./WorkOrdersManager.css";

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
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const deadline = new Date(fechaFin);
  deadline.setHours(0, 0, 0, 0);
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

export const WorkOrdersList: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { key: locationKey } = location;
  const { user } = useAuth();
  const role = (user as any)?.role;
  const basePath = role === "supervisor" ? "/supervisor" : "/admin";
  // Supervisor: puede crear órdenes pero NO editar/eliminar/duplicar existentes
  const isReadOnly = role !== "admin" && role !== "supervisor";
  const canModifyExisting = role === "admin";
  const confirm = useConfirm();

  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState("Todos");
  const [selectedImage, setSelectedImage] = useState<{ src: string; alt: string } | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [qrPreview, setQrPreview] = useState<{ value: string; codigo: string; nombre: string } | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [sortKey, setSortKey] = useState<SortKey>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  const fetchOrders = async () => {
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
  };

  useEffect(() => { fetchOrders(); }, [locationKey]);

  // ESC closes QR preview modal
  useEffect(() => {
    if (!qrPreview) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setQrPreview(null); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [qrPreview]);

  // Live: refetch al recibir cambios por WebSocket
  useWorkOrdersChannel(() => { fetchOrders(); });
  useEffect(() => { setCurrentPage(1); }, [searchTerm, filterStatus, sortKey]);

  const handleDelete = async (e: React.MouseEvent, id: number) => {
    e.stopPropagation();
    if (!await confirm({ message: "¿Eliminar esta orden? Esta acción no se puede deshacer.", danger: true, confirmText: "Eliminar" })) return;
    try {
      await workOrderService.delete(id);
      sileo.success({ title: "Orden eliminada" });
      fetchOrders();
    } catch (err: any) {
      sileo.error({ title: "Error al eliminar", description: getErrorMessage(err) });
    }
  };

  const toggleSelect = (id: number) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const handleDuplicate = async (e: React.MouseEvent, id: number) => {
    e.stopPropagation();
    try {
      await http.post(`/work-orders/${id}/duplicate`);
      sileo.success({ title: "Orden duplicada" });
      fetchOrders();
    } catch (err: any) {
      sileo.error({ title: "Error", description: getErrorMessage(err) });
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    if (!await confirm({ title: "Eliminar en lote", message: `Vas a eliminar ${selectedIds.size} órdenes. Esta acción no se puede deshacer.`, danger: true, confirmText: `Eliminar ${selectedIds.size}` })) return;
    try {
      await http.post("/work-orders/bulk", { action: "delete", ids: Array.from(selectedIds) });
      sileo.success({ title: `${selectedIds.size} órdenes eliminadas` });
      setSelectedIds(new Set());
      fetchOrders();
    } catch (err: any) {
      sileo.error({ title: "Error", description: getErrorMessage(err) });
    }
  };

  const handleBulkPrioridad = async (prioridad: string) => {
    if (selectedIds.size === 0) return;
    try {
      await http.post("/work-orders/bulk", { action: "set_prioridad", ids: Array.from(selectedIds), prioridad });
      sileo.success({ title: `Prioridad actualizada en ${selectedIds.size} órdenes` });
      setSelectedIds(new Set());
      fetchOrders();
    } catch (err: any) {
      sileo.error({ title: "Error", description: getErrorMessage(err) });
    }
  };

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
        (filterStatus === "Finalizada" && finalizada) ||
        (filterStatus !== "Todos" && filterStatus !== "En curso" && filterStatus !== "Finalizada" &&
          (o.departments ?? []).some(d => d.department?.slug === filterStatus));

      const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
      const q = norm(searchTerm);
      const workers = (o.departments ?? []).flatMap(d => (d.workers ?? []).map(w => w.user?.name ?? ""));
      const matchSearch = !q || [
        o.codigo_orden, o.nombre_orden, o.codigo_cliente?.toString(),
        o.nombre_cliente, (o as any).pieza?.codigo, (o as any).pieza?.nombre, ...workers,
      ].some(v => v && norm(v).includes(q));

      return matchStatus && matchSearch;
    });

    if (sortKey) {
      result = result.toSorted((a, b) => {
        const vals: Record<string, [string, string]> = {
          codigo_orden: [a.codigo_orden ?? "", b.codigo_orden ?? ""],
          nombre_orden: [a.nombre_orden ?? "", b.nombre_orden ?? ""],
          fecha_fin:    [a.fecha_fin ?? "9999", b.fecha_fin ?? "9999"],
        };
        const [va, vb] = vals[sortKey];
        const cmp = va.localeCompare(vb, "es", { numeric: true });
        return sortDir === "asc" ? cmp : -cmp;
      });
    }

    return result;
  }, [workOrders, searchTerm, filterStatus, sortKey, sortDir]);

  const stats = useMemo(() => ({
    total: workOrders.length,
    enCurso: workOrders.filter(o => !isOrderFinalizada(o)).length,
    finalizadas: workOrders.filter(o => isOrderFinalizada(o)).length,
  }), [workOrders]);

  const totalPages = Math.max(1, Math.ceil(filteredOrders.length / PAGE_SIZE));
  const paginated = filteredOrders.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

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
          <h2 className="wo-form__title" style={{ margin: 0 }}>Órdenes de Trabajo</h2>
        </div>
        <div style={{ display: "flex", gap: "0.5rem" }}>
          <button className="btn-outline" onClick={() => {
            const SEP = ";"; // Excel ES por defecto usa ';'
            const esc = (v: any) => {
              const s = v === null || v === undefined ? "" : String(v);
              return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
            };
            const fmtDate = (s?: string | null) => s ? new Date(s).toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit", year: "numeric" }) : "";
            const PRIO_LABEL: Record<string, string> = { alta: "Alta", media: "Media", baja: "Baja" };

            const now = new Date();
            const finalizadas = workOrders.filter(o => isOrderFinalizada(o)).length;
            const enCurso = workOrders.length - finalizadas;

            const lines: string[] = [];
            // ── Encabezado del informe ──
            lines.push(["OrdenYa — Listado de Órdenes de Trabajo"].map(esc).join(SEP));
            lines.push(["Generado", now.toLocaleString("es-ES", { dateStyle: "long", timeStyle: "short" })].map(esc).join(SEP));
            lines.push(["Total órdenes", workOrders.length, "En curso", enCurso, "Finalizadas", finalizadas].map(esc).join(SEP));
            lines.push("");
            // ── Cabeceras tabla ──
            lines.push(["Código", "Nombre", "Cliente", "Pieza (código)", "Pieza (nombre)", "Prioridad", "Unidades", "Fecha inicio", "Fecha fin", "Departamentos", "Trabajadores asignados", "Estado"].map(esc).join(SEP));

            // ── Datos ordenados por código ──
            const sorted = workOrders.toSorted((a, b) => a.codigo_orden.localeCompare(b.codigo_orden, "es", { numeric: true }));
            sorted.forEach(o => {
              const depts = (o.departments ?? []).flatMap((d: any) => { const r = d.department?.name; return r ? [r] : []; }).join(" + ");
              const workers = Array.from(new Set(
                (o.departments ?? []).flatMap((d: any) => (d.workers ?? []).flatMap((w: any) => { const r = w.user?.name; return r ? [r] : []; }))
              )).join(", ");
              const p = (o as any).pieza;
              lines.push([
                o.codigo_orden,
                o.nombre_orden,
                o.nombre_cliente ?? "",
                p?.codigo ?? "",
                p?.nombre ?? "",
                PRIO_LABEL[(o as any).prioridad as string] ?? "",
                o.unidades ?? "",
                fmtDate(o.fecha_inicio),
                fmtDate(o.fecha_fin),
                depts,
                workers,
                isOrderFinalizada(o) ? "Finalizada" : "En curso",
              ].map(esc).join(SEP));
            });

            // ── Totales al final ──
            lines.push("");
            lines.push(["TOTAL", workOrders.length].map(esc).join(SEP));
            lines.push(["En curso", enCurso].map(esc).join(SEP));
            lines.push(["Finalizadas", finalizadas].map(esc).join(SEP));

            const csv = lines.join("\r\n");
            const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            const stamp = now.toISOString().slice(0, 10).replace(/-/g, "");
            a.href = url;
            a.download = `OrdenYa_ordenes_${stamp}.csv`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
          }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: 6, verticalAlign: "middle" }}>
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4 M7 10l5 5 5-5 M12 15V3"/>
            </svg>
            Exportar CSV
          </button>
          {!isReadOnly && (
            <button className="btn-primary" onClick={() => navigate(`${basePath}/ordenes/nuevo`)}>
              <AddIcon size={15} color="white" /> Crear Orden
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <Spinner message="Cargando órdenes..." />
      ) : error ? (
        <p className="work-orders-manager__error">{error}</p>
      ) : (
        <>
          <StatsGrid stats={[
            { label: "Total Órdenes", value: stats.total },
            { label: "En curso", value: stats.enCurso, colorClass: "text-taller" },
            { label: "Finalizadas", value: stats.finalizadas, colorClass: "text-finalizada" },
          ]} />

          <FilterBar
            searchTerm={searchTerm}
            onSearchChange={setSearchTerm}
            searchPlaceholder="Buscar por código, nombre, cliente, pieza, trabajadores..."
            filterValue={filterStatus}
            onFilterChange={setFilterStatus}
            filterOptions={[
              { value: "Todos", label: "Todos" },
              { value: "En curso", label: "En curso" },
              { value: "Finalizada", label: "Finalizadas" },
              { value: "taller", label: "Taller" },
              { value: "instalacion", label: "Instalación" },
            ]}
          />

          <div className="table-container">
            {selectedImage && (
              <ImageModal src={selectedImage.src} alt={selectedImage.alt} onClose={() => setSelectedImage(null)} />
            )}

            {selectedIds.size > 0 && (
              <div className="bulk-bar">
                <div className="bulk-bar__count">
                  <span className="bulk-bar__count-num">{selectedIds.size}</span>
                  <span className="bulk-bar__count-label">seleccionada{selectedIds.size === 1 ? "" : "s"}</span>
                </div>

                <span className="bulk-bar__count-label" style={{ marginLeft: 8 }}>Prioridad</span>
                <div className="bulk-bar__group">
                  <button className="bulk-bar__chip bulk-bar__chip--alta"  onClick={() => handleBulkPrioridad("alta")}>
                    <span className="bulk-bar__chip-dot" /> Alta
                  </button>
                  <button className="bulk-bar__chip bulk-bar__chip--media" onClick={() => handleBulkPrioridad("media")}>
                    <span className="bulk-bar__chip-dot" /> Media
                  </button>
                  <button className="bulk-bar__chip bulk-bar__chip--baja"  onClick={() => handleBulkPrioridad("baja")}>
                    <span className="bulk-bar__chip-dot" /> Baja
                  </button>
                </div>

                <span className="bulk-bar__spacer" />

                <button className="bulk-bar__btn bulk-bar__btn--danger" onClick={handleBulkDelete}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 6h18 M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6 M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                  </svg>
                  Eliminar
                </button>
                <button className="bulk-bar__btn bulk-bar__btn--ghost" onClick={() => setSelectedIds(new Set())}>
                  Cancelar
                </button>
              </div>
            )}

            <table className="modern-table work-orders-manager__table--hoverable">
              <thead>
                <tr>
                  {canModifyExisting && (
                    <th style={{ width: 36 }}>
                      <input type="checkbox" className="brand-check"
                        ref={el => {
                          if (!el) return;
                          const some = paginated.some(o => selectedIds.has(o.id));
                          const all = paginated.length > 0 && paginated.every(o => selectedIds.has(o.id));
                          el.indeterminate = some && !all;
                        }}
                        checked={paginated.length > 0 && paginated.every(o => selectedIds.has(o.id))}
                        onChange={e => {
                          const next = new Set(selectedIds);
                          if (e.target.checked) paginated.forEach(o => next.add(o.id));
                          else paginated.forEach(o => next.delete(o.id));
                          setSelectedIds(next);
                        }} />
                    </th>
                  )}
                  <th className="sortable-th" onClick={() => handleSort("codigo_orden")}>
                    Código <SortIndicator col="codigo_orden" sortKey={sortKey} sortDir={sortDir} />
                  </th>
                  <th>QR</th>
                  <th className="sortable-th" onClick={() => handleSort("nombre_orden")}>
                    Nombre <SortIndicator col="nombre_orden" sortKey={sortKey} sortDir={sortDir} />
                  </th>
                  <th>Estado</th>
                  <th className="sortable-th" onClick={() => handleSort("fecha_fin")}>
                    Fecha límite <SortIndicator col="fecha_fin" sortKey={sortKey} sortDir={sortDir} />
                  </th>
                  <th>Departamentos</th>
                  <th className="work-orders-manager__actions-cell">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {paginated.map(o => {
                  const finalizada = isOrderFinalizada(o);
                  const deadline = getDeadlineBadge(o.fecha_fin);
                  return (
                    <tr
                      key={o.id}
                      className="work-orders-manager__row--clickable"
                      onClick={() => navigate(`${basePath}/ordenes/ver/${o.id}`)}
                    >
                      {canModifyExisting && (
                        <td onClick={e => e.stopPropagation()}>
                          <input type="checkbox" className="brand-check"
                            checked={selectedIds.has(o.id)}
                            onChange={() => toggleSelect(o.id)} />
                        </td>
                      )}
                      <td className="work-orders-manager__code">{o.codigo_orden}</td>
                      <td onClick={e => e.stopPropagation()}>
                        <button
                          type="button"
                          onClick={() => setQrPreview({
                            value: (o as any).qr_codigo ?? `${window.location.origin}/trabajador/ordenes/${o.id}`,
                            codigo: o.codigo_orden,
                            nombre: o.nombre_orden,
                          })}
                          title="Previsualizar QR"
                          style={{
                            width: 48, height: 48, padding: 4,
                            background: "#fff", borderRadius: 8,
                            display: "flex", alignItems: "center", justifyContent: "center",
                            border: "1px solid var(--border-color)",
                            cursor: "pointer",
                            transition: "transform 0.15s, box-shadow 0.15s",
                          }}
                          onMouseEnter={e => Object.assign(e.currentTarget.style, { transform: "scale(1.08)", boxShadow: "0 6px 18px rgba(60,52,137,0.25)" })}
                          onMouseLeave={e => Object.assign(e.currentTarget.style, { transform: "scale(1)", boxShadow: "none" })}
                        >
                          <QRCodeSVG
                            value={(o as any).qr_codigo ?? `${window.location.origin}/trabajador/ordenes/${o.id}`}
                            size={40} level="M" />
                        </button>
                      </td>
                      <td>{o.nombre_orden}</td>
                      <td>
                        <span className={`work-orders-manager__status-badge ${finalizada ? "work-orders-manager__status-badge--finalizada" : "work-orders-manager__status-badge--taller"}`}>
                          {finalizada ? "Finalizada" : "En curso"}
                        </span>
                      </td>
                      <td>
                        {deadline
                          ? <span className={`deadline-badge ${deadline.cls}`}>{deadline.label}</span>
                          : <span className="deadline-badge deadline--none">Sin fecha</span>
                        }
                      </td>
                      <td>
                        <div style={{ display: "flex", gap: "0.3rem", flexWrap: "wrap" }}>
                          {(o.departments ?? []).map(d => {
                            const slug = d.department?.slug ?? "";
                            const color = DEPT_COLORS[slug] ?? "#6b7280";
                            return (
                              <span
                                key={d.id}
                                style={{ fontSize: "0.72rem", padding: "0.1rem 0.5rem", borderRadius: 999, background: `${color}20`, color, border: `1px solid ${color}40`, fontWeight: 600 }}
                              >
                                {DEPT_LABELS[slug] ?? slug}{d.finalizado_at ? " ✓" : ""}
                              </span>
                            );
                          })}
                        </div>
                      </td>
                      <td className="work-orders-manager__actions-cell" onClick={e => e.stopPropagation()}>
                        <div className="work-orders-manager__actions-flex">
                          {canModifyExisting && (
                            <button
                              onClick={() => navigate(`${basePath}/ordenes/editar/${o.id}`)}
                              className="btn-primary work-orders-manager__btn-sm"
                            >
                              <EditIcon size={14} color="white" /> Editar
                            </button>
                          )}
                          {canModifyExisting && (
                            <button
                              onClick={(e) => handleDuplicate(e, o.id)}
                              className="btn-outline work-orders-manager__btn-sm"
                              title="Duplicar"
                            >
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <rect x="9" y="9" width="13" height="13" rx="2"/>
                                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                              </svg>
                            </button>
                          )}
                          {canModifyExisting && (
                            <button
                              onClick={(e) => handleDelete(e, o.id)}
                              className="btn-danger work-orders-manager__btn-sm"
                            >
                              <DeleteIcon size={14} color="white" /> Eliminar
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {filteredOrders.length === 0 && (
                  <tr>
                    <td colSpan={canModifyExisting ? 7 : 6} className="work-orders-manager__empty">No se encontraron órdenes.</td>
                  </tr>
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
                      <span key={`dots-after-${pageNumbers[i - 1]}`} className="pagination__dots">…</span>
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

      {qrPreview && (
        <div
          role="button"
          tabIndex={0}
          onClick={() => setQrPreview(null)}
          onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") setQrPreview(null); }}
          style={{
            position: "fixed", inset: 0, zIndex: 50,
            background: "rgba(13, 10, 31, 0.78)",
            backdropFilter: "blur(10px)",
            WebkitBackdropFilter: "blur(10px)",
            display: "grid",
            placeItems: "center",
            padding: "1.5rem",
            overflowY: "auto",
            animation: "qrModalFade 0.18s ease",
          }}
        >
          <style>{`
            @keyframes qrModalFade { from{opacity:0} to{opacity:1} }
            @keyframes qrModalPop { from{opacity:0;transform:scale(0.94) translateY(8px)} to{opacity:1;transform:scale(1) translateY(0)} }
          `}</style>
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: "var(--card-bg)",
              border: "1px solid var(--border-color)",
              borderRadius: 20,
              maxWidth: 440, width: "100%",
              boxShadow: "0 40px 100px rgba(0,0,0,0.55), 0 0 0 1px rgba(60,52,137,0.10)",
              animation: "qrModalPop 0.3s cubic-bezier(0.16, 1, 0.3, 1)",
              position: "relative",
              overflow: "hidden",
            }}
          >
            <div style={{
              position: "absolute", top: 0, left: 0, right: 0,
              height: 4,
              background: "linear-gradient(90deg, var(--brand) 0%, var(--brand-light) 40%, var(--amber) 100%)",
            }} />

            {/* Header */}
            <div style={{
              padding: "22px 24px 18px",
              borderBottom: "1px solid var(--border-color)",
              display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16,
            }}>
              <div style={{ minWidth: 0, flex: 1 }}>
                <span className="wo-form__title-eyebrow" style={{ marginBottom: 6, display: "inline-block" }}>Código QR</span>
                <h3 style={{
                  margin: 0, fontFamily: "var(--font-display)",
                  fontSize: "1.35rem", fontWeight: 600, letterSpacing: "-0.025em",
                  color: "var(--text-primary)",
                }}>
                  {qrPreview.codigo}
                </h3>
                <p style={{
                  margin: "4px 0 0", color: "var(--text-secondary)",
                  fontSize: "0.85rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                }}>
                  {qrPreview.nombre}
                </p>
              </div>
              <button
                onClick={() => setQrPreview(null)}
                style={{
                  width: 36, height: 36, borderRadius: 10,
                  background: "var(--bg-subtle, var(--bg))",
                  border: "1px solid var(--border-color)",
                  color: "var(--text-secondary)", cursor: "pointer",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  flexShrink: 0,
                  transition: "background-color 0.15s, color 0.15s, border-color 0.15s",
                }}
                onMouseEnter={e => Object.assign(e.currentTarget.style, { borderColor: "#ef4444", color: "#ef4444" })}
                onMouseLeave={e => Object.assign(e.currentTarget.style, { borderColor: "var(--border-color)", color: "var(--text-secondary)" })}
                aria-label="Cerrar"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <path d="M18 6 6 18 M6 6l12 12"/>
                </svg>
              </button>
            </div>

            {/* QR */}
            <div style={{ padding: "24px", background: "var(--bg-subtle, var(--bg))" }}>
              <div style={{
                background: "#fff",
                padding: 20,
                borderRadius: 14,
                display: "flex", justifyContent: "center", alignItems: "center",
                boxShadow: "0 4px 16px rgba(0,0,0,0.08), 0 0 0 1px rgba(60,52,137,0.08)",
                position: "relative",
              }}>
                {/* Corner decorations */}
                {[{ k: "tl", t: 6, l: 6, br: false, bl: false }, { k: "tr", t: 6, r: 6 }, { k: "bl", b: 6, l: 6 }, { k: "br", b: 6, r: 6 }].map((c) => (
                  <span key={c.k} style={{
                    position: "absolute",
                    top: (c as any).t, left: (c as any).l, right: (c as any).r, bottom: (c as any).b,
                    width: 14, height: 14,
                    borderTop: c.t !== undefined ? "2px solid #EF9F27" : undefined,
                    borderLeft: (c as any).l !== undefined ? "2px solid #EF9F27" : undefined,
                    borderRight: (c as any).r !== undefined ? "2px solid #EF9F27" : undefined,
                    borderBottom: c.b !== undefined ? "2px solid #EF9F27" : undefined,
                    borderRadius: 3,
                  }} />
                ))}
                <QRCodeSVG value={qrPreview.value} size={240} level="M" />
              </div>
            </div>

            {/* URL preview + helper */}
            <div style={{ padding: "0 24px 16px", textAlign: "center" }}>
              <p style={{
                margin: "0 0 10px", fontSize: "0.78rem",
                color: "var(--text-secondary)", lineHeight: 1.5,
              }}>
                Escanea con cualquier móvil para abrir el detalle de la orden.
              </p>
              <code style={{
                display: "inline-block",
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: "0.7rem",
                padding: "5px 10px",
                borderRadius: 6,
                background: "var(--bg-subtle, var(--bg))",
                border: "1px solid var(--border-color)",
                color: "var(--brand-light)",
                maxWidth: "100%",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                verticalAlign: "middle",
              }}>
                {qrPreview.value}
              </code>
            </div>

            {/* Actions */}
            <div style={{
              padding: "16px 24px 22px",
              borderTop: "1px solid var(--border-color)",
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 10,
            }}>
              <button
                onClick={() => {
                  const dialog = (document.querySelector('[data-qr-modal]') as HTMLElement | null);
                  const target = dialog?.querySelector("svg") as SVGElement | null;
                  if (!target) return;
                  const xml = new XMLSerializer().serializeToString(target);
                  const blob = new Blob([xml], { type: "image/svg+xml" });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url; a.download = `qr-${qrPreview.codigo}.svg`;
                  a.click();
                  URL.revokeObjectURL(url);
                }}
                className="wo-form__btn-outline"
                style={{ width: "100%", justifyContent: "center", whiteSpace: "nowrap", padding: "11px 14px" }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4 M7 10l5 5 5-5 M12 15V3"/>
                </svg>
                Descargar
              </button>
              <button
                onClick={() => { navigator.clipboard?.writeText(qrPreview.value); }}
                className="wo-form__btn-primary"
                style={{ width: "100%", justifyContent: "center", whiteSpace: "nowrap", padding: "11px 14px" }}
                data-qr-modal
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="9" y="9" width="13" height="13" rx="2"/>
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                </svg>
                Copiar URL
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
