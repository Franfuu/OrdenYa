import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../../auth/authContext";
import { storageUrl } from "../../utils/storageUrl";
import { sileo } from "sileo";
import { showHttpError } from "../../utils/errorHelper";
import { workOrderService } from "../../services/workOrderService";
import { Spinner } from "../../components/Spinner";
import type { WorkOrder, WorkOrderDepartment } from "../../types/WorkOrder";
import { isOrderFinalizada } from "../../types/WorkOrder";
import { EditIcon, DeleteIcon, CancelIcon, CheckIcon, LockIcon } from "../../components/Icons";
import { PRIORIDAD_META } from "./WorkOrderForm";
import { QRCodeSVG } from "qrcode.react";
import { useConfirm } from "../../components/ConfirmDialog";
import { OrderAuditLog } from "../shared/OrderAuditLog";
import { ImageModal } from "../../components/ImageModal";
import { useFormFields } from '../../hooks/useFormFields';
import "./WorkOrderDetail.css";

const fmt = (v: any) => v ?? "—";
const fmtDate = (v: string | null | undefined) =>
  v ? new Date(v).toLocaleDateString("es-ES", { day: "2-digit", month: "long", year: "numeric" }) : "—";

const DEPT_COLORS: Record<string, string> = {
  taller: "#534AB7", instalacion: "#1D9E75",
};
const DEPT_LABELS: Record<string, string> = {
  taller: "Taller", instalacion: "Instalación",
};

export const WorkOrderDetail: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const isReadOnly = (user as any)?.role !== "admin" && (user as any)?.role !== "supervisor";
  const confirm = useConfirm();
  const basePath = (user as any)?.role === "supervisor" ? "/supervisor" : "/admin";

  const { customFields } = useFormFields();

  const [order, setOrder] = useState<WorkOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [approvingWorker, setApprovingWorker] = useState<number | null>(null);
  const [showCloseOrderModal, setShowCloseOrderModal] = useState(false);
  const [auditKey, setAuditKey] = useState(0);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    workOrderService.get(Number(id))
      .then(data => { setOrder(data); setError(null); })
      .catch(err => setError(err.response?.data?.message || err.message || "Error al cargar"))
      .finally(() => setLoading(false));
  }, [id]);

  const handleReopen = async () => {
    if (!order) return;
    if (!await confirm({ message: `¿Reabrir la orden "${order.nombre_orden}"? Los departamentos volverán a estar en curso.`, confirmText: "Reabrir orden" })) return;
    try {
      const res = await workOrderService.reopenOrder(order.id);
      setOrder(res.work_order);
      setAuditKey(k => k + 1);
      sileo.success({ title: "Orden reabierta" });
    } catch (err: any) {
      showHttpError(err, "Error al reabrir la orden");
    }
  };

  const handleFinalize = async () => {
    if (!order) return;
    if (!await confirm({ message: `¿Cerrar la orden "${order.nombre_orden}"? Se finalizarán todos los departamentos y sesiones activas.`, confirmText: "Cerrar orden" })) return;
    try {
      const res = await workOrderService.finalizeOrder(order.id);
      setOrder(res.work_order);
      setAuditKey(k => k + 1);
      sileo.success({ title: "Orden cerrada" });
    } catch (err: any) {
      showHttpError(err, "Error al cerrar la orden");
    }
  };

  const handleDelete = async () => {
    if (!order) return;
    if (!await confirm({ message: `¿Eliminar la orden "${order.nombre_orden}"? Esta acción no se puede deshacer.`, danger: true, confirmText: "Eliminar" })) return;
    try {
      await workOrderService.delete(order.id);
      sileo.success({ title: "Orden eliminada" });
      navigate(`${basePath}/ordenes/lista`);
    } catch (err: any) {
      showHttpError(err, "Error al eliminar");
    }
  };

  const handleApproveWorker = async (dept: WorkOrderDepartment, workerId: number) => {
    if (!order) return;
    setApprovingWorker(workerId);
    try {
      const res = await workOrderService.approveWorker(order.id, dept.id, workerId);
      const updatedOrder = res.work_order;
      setOrder(updatedOrder);
      sileo.success({ title: "Trabajador aprobado" });

      // Check if ALL workers with pieces across ALL depts are now approved → auto-prompt close order
      const allWorkers = (updatedOrder.departments ?? []).flatMap(d => d.workers ?? []);
      const workersWithPieces = allWorkers.filter(
        w => (w.piezas_asignadas != null && w.piezas_asignadas > 0) || ((w.piezas_completadas ?? 0) > 0)
      );
      const allApproved = workersWithPieces.length > 0 && workersWithPieces.every(w => w.approved_at);
      if (allApproved && !updatedOrder.cerrada_at && !isReadOnly) {
        setShowCloseOrderModal(true);
      }
    } catch (err: any) {
      showHttpError(err, "Error al aprobar trabajador");
    } finally {
      setApprovingWorker(null);
    }
  };

  if (loading) return <Spinner message="Cargando orden..." />;
  if (error)   return <p className="detail-error">{error}</p>;
  if (!order)  return null;

  const finalizada = isOrderFinalizada(order);
  const allWorkersWithPieces = (order.departments ?? []).flatMap(d => d.workers ?? []).filter(
    w => (w.piezas_asignadas != null && w.piezas_asignadas > 0) || ((w.piezas_completadas ?? 0) > 0)
  );
  const allWorkersApproved = allWorkersWithPieces.length > 0 && allWorkersWithPieces.every(w => w.approved_at);
  const extraData = (order?.extra_data ?? {}) as Record<string, string | number | boolean | null>;
  const visibleCustomFields = customFields.filter(f =>
    extraData[f.field_key] !== undefined &&
    extraData[f.field_key] !== null &&
    extraData[f.field_key] !== ''
  );

  return (
    <div className="animate-fade-in wo-detail">
      {isModalOpen && order.imagen && (
        <ImageModal src={storageUrl(order.imagen) ?? ''} alt={order.nombre_orden} onClose={() => setIsModalOpen(false)} />
      )}

      {/* Close order modal */}
      {showCloseOrderModal && createPortal(
        <div className="wo-detail__close-dept-modal-overlay" onClick={() => setShowCloseOrderModal(false)}>
          <div className="wo-detail__close-dept-modal-card" onClick={e => e.stopPropagation()}>
            <h3 className="wo-detail__close-dept-modal-title">¿Cerrar la orden?</h3>
            <p className="wo-detail__close-dept-modal-body">
              Todos los departamentos están finalizados. ¿Deseas cerrar la orden <strong>{order.nombre_orden}</strong>?
            </p>
            <div className="wo-detail__close-dept-modal-actions">
              <button className="btn-primary" onClick={async () => { setShowCloseOrderModal(false); try { const res = await workOrderService.finalizeOrder(order!.id); setOrder(res.work_order); setAuditKey(k => k + 1); sileo.success({ title: "Orden cerrada" }); } catch(err: any) { showHttpError(err, "Error al cerrar la orden"); } }}>
                Cerrar orden
              </button>
              <button className="btn-outline" onClick={() => setShowCloseOrderModal(false)}>
                Ahora no
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Hero card — código + título + acciones + info clave + QR */}
      <div className="glass-card wo-detail__hero-card">
        {/* Top row: volver + acciones */}
        <div className="wo-detail__hero-topbar">
          <button className="btn-outline wo-detail__back-btn" onClick={() => navigate(`${basePath}/ordenes/lista`)}>
            <CancelIcon size={14} /> Volver
          </button>
          {!isReadOnly && (
            <div className="wo-detail__hero-actions">
              <button className="wo-detail__action-btn wo-detail__action-btn--edit" onClick={() => navigate(`${basePath}/ordenes/editar/${order.id}`)}>
                <EditIcon size={14} color="white" /> Editar
              </button>
              {finalizada ? (
                <button className="wo-detail__action-btn wo-detail__action-btn--reopen" onClick={handleReopen}>
                  <CheckIcon size={14} /> Reabrir orden
                </button>
              ) : (
                <button
                  className="wo-detail__action-btn wo-detail__action-btn--close"
                  onClick={handleFinalize}
                  disabled={!allWorkersApproved}
                  title={!allWorkersApproved ? "Aprueba todas las piezas antes de cerrar la orden" : "Cerrar orden"}
                >
                  <LockIcon size={14} /> Cerrar orden
                </button>
              )}
              <button className="wo-detail__action-btn wo-detail__action-btn--delete" onClick={handleDelete}>
                <DeleteIcon size={14} color="white" /> Eliminar
              </button>
            </div>
          )}
        </div>

        {/* Main hero content */}
        <div className="wo-detail__hero-body">
          <div className="wo-detail__hero-left">
            <span className="wo-detail__code">{order.codigo_orden}</span>
            <h2 className="wo-detail__title">{order.nombre_orden}</h2>
            <div className="wo-detail__hero-badges">
              {finalizada ? (
                <span className="wo-detail__badge wo-detail__badge--finalizada"><CheckIcon size={11} /> Finalizada</span>
              ) : (
                <span className="wo-detail__badge wo-detail__badge--encurso">● En curso</span>
              )}
              {order.prioridad && (() => {
                const p = order.prioridad as keyof typeof PRIORIDAD_META;
                const meta = PRIORIDAD_META[p];
                return <span className="wo-detail__badge" style={{ background: `${meta.color}20`, color: meta.color, border: `1px solid ${meta.color}40` }}>● Prioridad {meta.label}</span>;
              })()}
              {order.tipo && (
                <span className="wo-detail__badge" style={{ background: "#3b82f620", color: "#3b82f6", border: "1px solid #3b82f630" }}>Tipo {order.tipo}</span>
              )}
            </div>
            {/* Quick info pills */}
            <div className="wo-detail__hero-meta">
              {order.nombre_cliente && <span className="wo-detail__meta-pill">{order.nombre_cliente}</span>}
              {order.unidades != null && <span className="wo-detail__meta-pill">{order.unidades} uds</span>}
              {order.fecha_inicio && <span className="wo-detail__meta-pill">{fmtDate(order.fecha_inicio)}</span>}
              {order.fecha_fin && <span className="wo-detail__meta-pill">{fmtDate(order.fecha_fin)}</span>}
            </div>
          </div>

          {order.imagen && (
            <div className="wo-detail__hero-right">
              <div className="wo-detail__hero-image-wrap" role="button" tabIndex={0}
                onClick={() => setIsModalOpen(true)}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setIsModalOpen(true); }}
                style={{ cursor: "pointer" }}>
                <img src={storageUrl(order.imagen) ?? ''} alt="Imagen" className="wo-detail__hero-image" />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Panel HL specs */}
      {order.hl_referencia && (
        <div className="glass-card" style={{ marginBottom: 20 }}>
          <h3 style={{ color: '#3b82f6', marginBottom: 12, fontSize: 15, fontWeight: 600 }}>
            Especificaciones HL: {order.hl_referencia.referencia}
          </h3>
          {order.hl_referencia.imagen && (
            <img
              src={order.hl_referencia.imagen}
              alt={order.hl_referencia.referencia}
              style={{ maxHeight: 160, borderRadius: 8, marginBottom: 12, display: 'block' }}
            />
          )}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: 10 }}>
            {([
              { label: 'Ancho',      value: `${order.hl_referencia.ancho_cm} cm` },
              { label: 'Alto',       value: `${order.hl_referencia.alto_cm} cm` },
              { label: 'Peso',       value: `${order.hl_referencia.peso_kg} kg` },
              { label: 'Consumo',    value: `${order.hl_referencia.consumo_w} W` },
              { label: 'Nº LED',     value: order.hl_referencia.n_led },
              { label: 'Superficie', value: `${order.hl_referencia.superficie_m2} m²` },
              { label: 'W/m²',       value: order.hl_referencia.w_m2 },
              { label: 'W/LED',      value: order.hl_referencia.w_led },
            ] as { label: string; value: string | number }[]).map(spec => (
              <div key={spec.label} style={{
                background: 'var(--surface-2, #f8fafc)',
                borderRadius: 8, padding: '10px 14px',
                border: '1px solid var(--border, #e2e8f0)',
              }}>
                <div style={{ fontSize: 11, color: 'var(--text-muted, #64748b)', fontWeight: 600, marginBottom: 4 }}>
                  {spec.label}
                </div>
                <div style={{ fontSize: 15, fontWeight: 700 }}>{spec.value}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="wo-detail__body">
        {/* Columna izquierda: Datos del pedido + Fechas */}
        <div className="wo-detail__left-col">
          <div className="glass-card wo-detail__section">
            <h3 className="wo-detail__section-title">Datos del pedido</h3>
            <dl className="wo-detail__dl">
              <dt>Nº Pedido</dt>     <dd>{fmt(order.numero_pedido)}</dd>
              <dt>Cod. Cliente</dt>  <dd>{fmt(order.codigo_cliente)}</dd>
              <dt>Cliente</dt>       <dd>{fmt(order.nombre_cliente)}</dd>
              <dt>Pieza</dt>         <dd>{order.pieza ? `${order.pieza.codigo} · ${order.pieza.nombre}` : "—"}</dd>
              <dt>Nº OP</dt>         <dd>{fmt(order.numero_op)}</dd>
              <dt>Festividad</dt>    <dd>{fmt(order.festividad)}</dd>
              <dt>Unidades</dt>      <dd>{fmt(order.unidades)}</dd>
            </dl>
          </div>
          <div className="glass-card wo-detail__section">
            <h3 className="wo-detail__section-title">Fechas</h3>
            <dl className="wo-detail__dl">
              <dt>Inicio</dt>       <dd>{fmtDate(order.fecha_inicio)}</dd>
              <dt>Fin previsto</dt> <dd>{fmtDate(order.fecha_fin)}</dd>
              <dt>Creada</dt>       <dd>{fmtDate(order.created_at)}</dd>
            </dl>
          </div>
        </div>

        {/* Columna derecha: QR + Departamentos */}
        <div className="wo-detail__right-col">
          <div className="glass-card wo-detail__section wo-detail__qr-card">
            <h3 className="wo-detail__section-title">Código QR</h3>
            <div className="wo-detail__qr-inner" title="Escanea para abrir esta orden en el móvil">
              <div className="wo-detail__hero-qr-frame">
                <QRCodeSVG
                  value={order.qr_codigo ?? `${window.location.origin}/trabajador/ordenes/${order.id}`}
                  size={180}
                  level="M"
                />
              </div>
            </div>
          </div>

          <div className="glass-card wo-detail__section">
            <h3 className="wo-detail__section-title">Departamentos</h3>
            {(order.departments ?? []).length === 0 ? (
              <span className="wo-detail__chip-empty">Sin departamentos</span>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "0.8rem" }}>
                {(order.departments ?? []).map(dept => {
                  const slug = dept.department?.slug ?? "";
                  const color = DEPT_COLORS[slug] ?? "#6b7280";
                  const completadas = (dept.workers ?? []).reduce((s, w) => s + (w.piezas_completadas ?? 0), 0);
                  const pct = dept.piezas && dept.piezas > 0 ? Math.min(100, Math.round((completadas / dept.piezas) * 100)) : 0;
                  return (
                    <div key={dept.id} style={{ padding: "0.6rem 0.8rem", borderRadius: 10, border: `1.5px solid ${color}40`, background: `${color}08` }}>
                      {/* Dept header */}
                      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.3rem" }}>
                        <span style={{ fontWeight: 700, fontSize: "0.85rem", color }}>{DEPT_LABELS[slug] ?? dept.department?.name}</span>
                        {dept.piezas != null && (
                          <span style={{ fontSize: "0.72rem", color, fontWeight: 600 }}>{completadas}/{dept.piezas} piezas</span>
                        )}
                      </div>
                      {/* Dept progress bar */}
                      {dept.piezas != null && dept.piezas > 0 && (
                        <div style={{ height: 4, borderRadius: 2, background: "#e5e7eb", overflow: "hidden", marginBottom: "0.5rem" }}>
                          <div style={{ width: "100%", height: "100%", background: color, transform: `scaleX(${pct / 100})`, transformOrigin: "left", transition: "transform 0.3s ease-out" }} />
                        </div>
                      )}
                      {/* Worker rows */}
                      {(dept.workers ?? []).length > 0 && (
                        <div style={{ display: "flex", flexDirection: "column" }}>
                          {(dept.workers ?? []).map(w => {
                            const workerPct = w.piezas_asignadas && w.piezas_asignadas > 0
                              ? Math.min(100, Math.round(((w.piezas_completadas ?? 0) / w.piezas_asignadas) * 100))
                              : 0;
                            const completadas = w.piezas_completadas ?? 0;
                            const canApprove = !isReadOnly && !w.approved_at && (
                              (w.piezas_asignadas != null && w.piezas_asignadas > 0 && completadas >= w.piezas_asignadas) ||
                              ((!w.piezas_asignadas || w.piezas_asignadas === 0) && completadas > 0)
                            );
                            return (
                              <div key={w.id} className="wo-detail__worker-row">
                                <span style={{ fontSize: "0.8rem", fontWeight: 600, minWidth: 90, flex: "0 0 auto" }}>
                                  {w.user?.name ?? `#${w.user_id}`}
                                </span>
                                {(completadas > 0 || (w.piezas_asignadas != null && w.piezas_asignadas > 0)) && (
                                  <>
                                    <span style={{ fontSize: "0.75rem", color, fontWeight: 600, whiteSpace: "nowrap" }}>
                                      {completadas}{w.piezas_asignadas ? `/${w.piezas_asignadas}` : " pzs"}
                                    </span>
                                    {w.piezas_asignadas != null && w.piezas_asignadas > 0 && (
                                      <div className="wo-detail__worker-progress">
                                        <div
                                          className="wo-detail__worker-progress-fill"
                                          style={{ background: w.approved_at ? "#1D9E75" : color, transform: `scaleX(${workerPct / 100})` }}
                                        />
                                      </div>
                                    )}
                                  </>
                                )}
                                {w.approved_at ? (
                                  <span className="wo-detail__approved-badge">
                                    ✓ Aprobado
                                  </span>
                                ) : canApprove ? (
                                  <button
                                    className="wo-detail__approve-btn"
                                    disabled={approvingWorker === w.id}
                                    onClick={() => handleApproveWorker(dept, w.id)}
                                  >
                                    {approvingWorker === w.id ? "..." : "Aprobar"}
                                  </button>
                                ) : null}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {order.observacion && (
        <div className="glass-card wo-detail__section wo-detail__obs">
          <h3 className="wo-detail__section-title">Observaciones</h3>
          <p className="wo-detail__obs-text">{order.observacion}</p>
        </div>
      )}

      <OrderAuditLog orderId={order.id} refreshKey={auditKey} />

      <div className="glass-card wo-detail__section">
        <h3 className="wo-detail__section-title">Historial de sesiones</h3>
        {(order.work_sessions ?? []).length === 0 ? (
          <p style={{ opacity: 0.6, margin: 0 }}>Aún no hay sesiones registradas.</p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid var(--border, #e2e8f0)" }}>
                  <th style={{ textAlign: "left", padding: "0.5rem" }}>Trabajador</th>
                  <th style={{ textAlign: "left", padding: "0.5rem" }}>Inicio</th>
                  <th style={{ textAlign: "left", padding: "0.5rem" }}>Fin</th>
                  <th style={{ textAlign: "right", padding: "0.5rem" }}>Duración</th>
                  <th style={{ textAlign: "right", padding: "0.5rem" }}>Piezas</th>
                </tr>
              </thead>
              <tbody>
                {(order.work_sessions ?? []).map((s: any) => {
                  const dur = s.duration_in_seconds ?? 0;
                  const h = Math.floor(dur / 3600);
                  const m = Math.floor((dur % 3600) / 60);
                  return (
                    <tr key={s.id} style={{ borderBottom: "1px solid var(--border-subtle, #f1f5f9)" }}>
                      <td style={{ padding: "0.5rem" }}>{s.user?.name ?? `#${s.user_id}`}</td>
                      <td style={{ padding: "0.5rem" }}>{s.start_time ? new Date(s.start_time).toLocaleString("es-ES", { dateStyle: "short", timeStyle: "short" }) : "—"}</td>
                      <td style={{ padding: "0.5rem" }}>{s.end_time ? new Date(s.end_time).toLocaleString("es-ES", { dateStyle: "short", timeStyle: "short" }) : <span style={{ color: "#10b981", fontWeight: 600 }}>● Activa</span>}</td>
                      <td style={{ padding: "0.5rem", textAlign: "right" }}>{s.end_time ? `${h}h ${m}m` : "—"}</td>
                      <td style={{ padding: "0.5rem", textAlign: "right" }}>{s.piezas ?? 0}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {visibleCustomFields.length > 0 && (
        <div className="wo-detail__section">
          <h3 className="wo-detail__section-title">Campos adicionales</h3>
          <div className="wo-detail__fields-grid">
            {visibleCustomFields.map(field => (
              <div key={field.field_key} className="wo-detail__field">
                <span className="wo-detail__field-label">{field.label}</span>
                <span className="wo-detail__field-value">
                  {field.type === 'checkbox'
                    ? (extraData[field.field_key] ? 'Sí' : 'No')
                    : String(extraData[field.field_key])}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
