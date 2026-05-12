import React, { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../../auth/authContext";
import { storageUrl } from "../../utils/storageUrl";
import { sileo } from "sileo";
import { showHttpError, getErrorMessage } from "../../utils/errorHelper";
import { workOrderService } from "../../services/workOrderService";
import { Spinner } from "../../components/Spinner";
import type { WorkOrder } from "../../types/WorkOrder";
import { isOrderFinalizada } from "../../types/WorkOrder";
import { EditIcon, DeleteIcon, CancelIcon, CheckIcon } from "../../components/Icons";
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
  const isReadOnly = (user as any)?.role === "supervisor";
  const confirm = useConfirm();
  const basePath = (user as any)?.role === "supervisor" ? "/supervisor" : "/admin";

  const { customFields } = useFormFields();

  const [order, setOrder] = useState<WorkOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    workOrderService.get(Number(id))
      .then(data => { setOrder(data); setError(null); })
      .catch(err => setError(err.response?.data?.message || err.message || "Error al cargar"))
      .finally(() => setLoading(false));
  }, [id]);

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

  if (loading) return <Spinner message="Cargando orden..." />;
  if (error)   return <p className="detail-error">{error}</p>;
  if (!order)  return null;

  const finalizada = isOrderFinalizada(order);
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

      {/* Header */}
      <div className="detail-header">
        <button className="btn-outline" onClick={() => navigate(`${basePath}/ordenes/lista`)}>
          <CancelIcon size={15} /> Volver
        </button>
        {!isReadOnly && (
          <div className="detail-header__actions">
            <button className="btn-primary" onClick={() => navigate(`${basePath}/ordenes/editar/${order.id}`)}>
              <EditIcon size={15} color="white" /> Editar
            </button>
            <button className="btn-danger" onClick={handleDelete}>
              <DeleteIcon size={15} color="white" /> Eliminar
            </button>
          </div>
        )}
      </div>

      {/* Hero */}
      <div className="glass-card wo-detail__hero-card">
        <div className="wo-detail__hero-left">
          <span className="wo-detail__code">{order.codigo_orden}</span>
          <h2 className="wo-detail__title">{order.nombre_orden}</h2>
          <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", marginTop: "0.4rem" }}>
            {order.tipo && (
              <span className="wo-detail__badge" style={{ background: "#3b82f620", color: "#3b82f6", border: "1px solid #3b82f630" }}>
                Tipo {order.tipo}
              </span>
            )}
            {(order as any).prioridad && (() => {
              const p = (order as any).prioridad as keyof typeof PRIORIDAD_META;
              const meta = PRIORIDAD_META[p];
              return (
                <span className="wo-detail__badge" style={{ background: `${meta.color}20`, color: meta.color, border: `1px solid ${meta.color}40` }}>
                  ● Prioridad {meta.label}
                </span>
              );
            })()}
            {finalizada ? (
              <span className="wo-detail__badge wo-detail__badge--finalizada">
                <CheckIcon size={11} /> Finalizada
              </span>
            ) : (
              <span className="wo-detail__badge" style={{ background: "#f59e0b20", color: "#f59e0b", border: "1px solid #f59e0b30" }}>
                En curso
              </span>
            )}
          </div>
        </div>
        {order.imagen && (
          <div className="wo-detail__hero-image-wrap" role="button" tabIndex={0} onClick={() => setIsModalOpen(true)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setIsModalOpen(true); }} style={{ cursor: "pointer" }}>
            <img src={storageUrl(order.imagen) ?? ''} alt="Imagen" className="wo-detail__hero-image" />
          </div>
        )}
        <div className="wo-detail__hero-qr" title="Escanea para abrir esta orden en el móvil">
          <div className="wo-detail__hero-qr-frame">
            <QRCodeSVG
              value={(order as any).qr_codigo ?? `${window.location.origin}/trabajador/ordenes/${order.id}`}
              size={120}
              level="M"
            />
          </div>
          <span className="wo-detail__hero-qr-label">Código QR</span>
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
        {/* Datos del pedido */}
        <div className="glass-card wo-detail__section">
          <h3 className="wo-detail__section-title">Datos del pedido</h3>
          <dl className="wo-detail__dl">
            <dt>Nº Pedido</dt>     <dd>{fmt(order.numero_pedido)}</dd>
            <dt>Cod. Cliente</dt>  <dd>{fmt(order.codigo_cliente)}</dd>
            <dt>Cliente</dt>       <dd>{fmt(order.nombre_cliente)}</dd>
            <dt>Pieza</dt>         <dd>{(order as any).pieza ? `${(order as any).pieza.codigo} · ${(order as any).pieza.nombre}` : "—"}</dd>
            <dt>Nº OP</dt>         <dd>{fmt(order.numero_op)}</dd>
            <dt>Festividad</dt>    <dd>{fmt(order.festividad)}</dd>
            <dt>Unidades</dt>      <dd>{fmt(order.unidades)}</dd>
          </dl>
        </div>

        {/* Fechas + departamentos */}
        <div className="wo-detail__right-col">
          <div className="glass-card wo-detail__section">
            <h3 className="wo-detail__section-title">Fechas</h3>
            <dl className="wo-detail__dl">
              <dt>Inicio</dt>      <dd>{fmtDate(order.fecha_inicio)}</dd>
              <dt>Fin previsto</dt> <dd>{fmtDate(order.fecha_fin)}</dd>
              <dt>Creada</dt>      <dd>{fmtDate(order.created_at)}</dd>
            </dl>
          </div>

          <div className="glass-card wo-detail__section">
            <h3 className="wo-detail__section-title">Departamentos</h3>
            {(order.departments ?? []).length === 0 ? (
              <span className="wo-detail__chip-empty">Sin departamentos</span>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
                {(order.departments ?? []).map(dept => {
                  const slug = dept.department?.slug ?? "";
                  const color = DEPT_COLORS[slug] ?? "#6b7280";
                  const completadas = (dept.workers ?? []).reduce((s, w) => s + (w.piezas_completadas ?? 0), 0);
                  const workers = (dept.workers ?? []).map(w => w.user?.name ?? `#${w.user_id}`);
                  const pct = dept.piezas && dept.piezas > 0 ? Math.min(100, Math.round((completadas / dept.piezas) * 100)) : 0;
                  return (
                    <div key={dept.id} style={{ padding: "0.5rem 0.7rem", borderRadius: 8, border: `1.5px solid ${color}40`, background: `${color}08` }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.3rem" }}>
                        <span style={{ fontWeight: 700, fontSize: "0.82rem", color }}>{DEPT_LABELS[slug] ?? dept.department?.name}</span>
                        {dept.finalizado_at
                          ? <span style={{ fontSize: "0.72rem", color: "#10b981", fontWeight: 600 }}><CheckIcon size={10} /> Finalizado</span>
                          : <span style={{ fontSize: "0.72rem", color: "#f59e0b" }}>● En curso</span>
                        }
                        {dept.piezas != null && (
                          <span style={{ fontSize: "0.72rem", color, fontWeight: 600 }}>· {completadas}/{dept.piezas} piezas</span>
                        )}
                      </div>
                      {dept.piezas != null && dept.piezas > 0 && (
                        <div style={{ height: 4, borderRadius: 2, background: "#e5e7eb", overflow: "hidden", marginBottom: "0.3rem" }}>
                          <div style={{ width: `${pct}%`, height: "100%", background: color, transition: "width 0.3s" }} />
                        </div>
                      )}
                      {workers.length > 0 && (
                        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.3rem" }}>
                          {(dept.workers ?? []).map(w => (
                            <span key={w.id} className="wo-detail__chip wo-detail__chip--trabajador" style={{ fontSize: "0.73rem" }}>
                              {w.user?.name ?? `#${w.user_id}`}
                              {w.piezas_asignadas != null && (
                                <span style={{ color, marginLeft: 4 }}>{w.piezas_completadas}/{w.piezas_asignadas}</span>
                              )}
                            </span>
                          ))}
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

      <OrderAuditLog orderId={order.id} />

      <div className="glass-card wo-detail__section">
        <h3 className="wo-detail__section-title">Historial de sesiones</h3>
        {((order as any).work_sessions ?? []).length === 0 ? (
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
                {((order as any).work_sessions ?? []).map((s: any) => {
                  const dur = s.duration_in_seconds ?? 0;
                  const h = Math.floor(dur / 3600);
                  const m = Math.floor((dur % 3600) / 60);
                  return (
                    <tr key={s.id} style={{ borderBottom: "1px solid var(--border-subtle, #f1f5f9)" }}>
                      <td style={{ padding: "0.5rem" }}>{s.user?.name ?? `#${s.user_id}`}</td>
                      <td style={{ padding: "0.5rem" }}>{s.start_time ? new Date(s.start_time).toLocaleString("es-ES", { dateStyle: "short", timeStyle: "short" }) : "—"}</td>
                      <td style={{ padding: "0.5rem" }}>{s.end_time ? new Date(s.end_time).toLocaleString("es-ES", { dateStyle: "short", timeStyle: "short" }) : <span style={{ color: "#10b981", fontWeight: 600 }}>● Activa</span>}</td>
                      <td style={{ padding: "0.5rem", textAlign: "right" }}>{h}h {m}m</td>
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
