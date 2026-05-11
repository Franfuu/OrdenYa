import React, { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { workOrderService } from "../../services/workOrderService";
import { useAuth } from "../../auth/authContext";
import { Spinner } from "../../components/Spinner";
import { formatDuration } from "../../utils/statusHelpers";
import { getErrorMessage, showHttpError } from "../../utils/errorHelper";
import type { WorkOrder, WorkOrderDepartment, WorkOrderPhase, WorkSession } from "../../types/WorkOrder";
import { isOrderFinalizada } from "../../types/WorkOrder";
import { sileo } from "sileo";
import { ClockIcon } from "../../components/Icons";
import { useFormFields } from '../../hooks/useFormFields';
import "./WorkOrderDetail.css";

const DEPT_LABELS: Record<string, string> = {
  taller: "Taller", instalacion: "Instalación",
};
const DEPT_COLORS: Record<string, string> = {
  taller: "#534AB7", instalacion: "#1D9E75",
};

export const TrabajadorWorkOrderDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { fields } = useFormFields();

  const [order, setOrder] = useState<WorkOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Active session
  const [activeSession, setActiveSession] = useState<WorkSession | null>(null);
  const [elapsed, setElapsed] = useState(0);

  // Start session modal
  const [startModal, setStartModal] = useState(false);
  const [selectedDept, setSelectedDept] = useState<WorkOrderDepartment | null>(null);
  const [selectedPhase, setSelectedPhase] = useState<WorkOrderPhase | null>(null);

  // Stop/pause input
  const [showStopInput, setShowStopInput] = useState(false);
  const [stopMode, setStopMode] = useState<"pause" | "stop">("stop");
  const [piezasInput, setPiezasInput] = useState("");
  const [piezasError, setPiezasError] = useState("");
  const [notasInput, setNotasInput] = useState("");
  const [actionLoading, setActionLoading] = useState(false);

  const loadOrder = useCallback(async () => {
    if (!id || !user) return;
    const data = await workOrderService.get(Number(id));
    setOrder(data);
    const active = (data.work_sessions ?? []).find(
      (s: WorkSession) => s.user_id === user.id && !s.end_time
    );
    setActiveSession(active ?? null);
  }, [id, user]);

  useEffect(() => {
    setLoading(true);
    loadOrder().catch(err => setError(getErrorMessage(err))).finally(() => setLoading(false));
  }, [loadOrder]);

  // Timer
  useEffect(() => {
    if (!activeSession) { setElapsed(0); return; }
    const start = new Date(activeSession.start_time).getTime();
    setElapsed(Math.floor((Date.now() - start) / 1000));
    const interval = setInterval(() => setElapsed(Math.floor((Date.now() - start) / 1000)), 1000);
    return () => clearInterval(interval);
  }, [activeSession]);

  // My dept assignments
  const myDepts = (order?.departments ?? []).filter(dept =>
    !dept.finalizado_at &&
    (dept.workers ?? []).some(w => w.user_id === user?.id)
  );

  const workerVisibleCustomFields = fields.filter(f => f.visible_to_worker && !f.is_base_field);
  const extraData = (order?.extra_data ?? {}) as Record<string, string | number | boolean | null>;

  const isGeneric = order?.codigo_orden?.startsWith("GEN-") ?? false;
  const finalizada = order ? isOrderFinalizada(order) : false;

  // Active session dept/phase info
  const activeDept = order?.departments?.find(d => d.id === activeSession?.work_order_department_id);
  const activePhaseEntry = activeDept?.phases?.find(p => p.id === activeSession?.work_order_phase_id);

  // Pieces tracking for active session's phase
  const myWorkerEntry = activeDept?.workers?.find(w => w.user_id === user?.id);
  const myPiecePieces = activePhaseEntry
    ? (myWorkerEntry?.phase_pieces ?? []).find(pp => pp.work_order_phase_id === activePhaseEntry.id)
    : null;
  const piecesTarget = myPiecePieces?.piezas_asignadas ?? 0;
  const piecesDone = myPiecePieces?.piezas_completadas ?? 0;

  const handleStart = async () => {
    if (!order || !selectedDept || !selectedPhase) return;
    setActionLoading(true);
    try {
      await workOrderService.startSession(order.id, {
        work_order_department_id: selectedDept.id,
        work_order_phase_id: selectedPhase.id,
      });
      await loadOrder();
      setStartModal(false);
      setSelectedDept(null);
      setSelectedPhase(null);
      sileo.success({ title: "Sesión iniciada" });
    } catch (err: any) {
      showHttpError(err, "Error al iniciar");
    } finally {
      setActionLoading(false);
    }
  };

  const handlePause = async () => {
    if (!order) return;
    const piezas = piezasInput !== "" ? parseInt(piezasInput, 10) : 0;
    if (piezasInput !== "" && (isNaN(piezas) || piezas < 0)) {
      setPiezasError("Valor inválido"); return;
    }
    setActionLoading(true);
    try {
      await workOrderService.pauseSession(order.id, {
        piezas: piezas > 0 ? piezas : undefined,
        notas: notasInput.trim() || undefined,
      });
      await loadOrder();
      setShowStopInput(false);
      setPiezasInput(""); setNotasInput("");
      sileo.success({ title: "Sesión pausada" });
    } catch (err: any) {
      showHttpError(err, "Error al pausar");
    } finally {
      setActionLoading(false);
    }
  };

  const handleStop = async () => {
    if (!order) return;
    const needsPiezas = activePhaseEntry?.phase?.pieces_from === true;
    const parsed = parseInt(piezasInput, 10);
    const piezas = isNaN(parsed) ? 0 : parsed;
    if (needsPiezas && (piezasInput.trim() === "" || piezas < 0)) {
      setPiezasError("Introduce un número válido");
      return;
    }
    setActionLoading(true);
    setPiezasError("");
    try {
      await workOrderService.stopSession(order.id, {
        piezas,
        notas: notasInput.trim() || undefined,
      });
      setShowStopInput(false);
      setPiezasInput("");
      setNotasInput("");
      setActiveSession(null);
      await loadOrder();
      sileo.success({ title: "Sesión finalizada", description: piezas > 0 ? `${piezas} piezas registradas` : undefined });
    } catch (err: any) {
      showHttpError(err, "Error al terminar");
    } finally {
      setActionLoading(false);
    }
  };

  const openStop = (mode: "pause" | "stop") => {
    setStopMode(mode);
    setPiezasInput("");
    setPiezasError("");
    setNotasInput("");
    setShowStopInput(true);
  };

  if (loading) return <Spinner message="Cargando orden..." />;
  if (error || !order) return <p className="trabajador-detail__error">{error ?? "Orden no encontrada."}</p>;

  const mySessions = (order.work_sessions ?? []).filter(s => s.user_id === user?.id && s.end_time);

  return (
    <div className="trabajador-detail animate-fade-in">
      <div className="trabajador-detail__header">
        <h2 className="trabajador-detail__title">{order.codigo_orden}</h2>
        <button className="btn-outline" onClick={() => navigate(-1)}>Volver</button>
      </div>

      {/* Order info */}
      <div className="trabajador-detail__card">
        <h3 className="trabajador-detail__card-title">Detalles</h3>
        <dl className="trabajador-detail__dl">
          <div className="trabajador-detail__dl-row"><dt>Nombre</dt><dd>{order.nombre_orden}</dd></div>
          {order.nombre_cliente && <div className="trabajador-detail__dl-row"><dt>Cliente</dt><dd>{order.nombre_cliente}</dd></div>}
          {order.modelo && <div className="trabajador-detail__dl-row"><dt>Modelo</dt><dd>{order.modelo}</dd></div>}
          {order.observacion && <div className="trabajador-detail__dl-row"><dt>Observación</dt><dd>{order.observacion}</dd></div>}
        </dl>
      </div>

      {/* Custom fields visible to worker */}
      {workerVisibleCustomFields.filter(f =>
        extraData[f.field_key] !== undefined &&
        extraData[f.field_key] !== null &&
        extraData[f.field_key] !== ''
      ).length > 0 && (
        <div className="trabajador-detail__card">
          <h3 className="trabajador-detail__card-title">Campos adicionales</h3>
          <dl className="trabajador-detail__dl">
            {workerVisibleCustomFields
              .flatMap(field => {
                const val = extraData[field.field_key];
                if (val === undefined || val === null || val === '') return [];
                return [(
                  <div key={field.field_key} className="trabajador-detail__dl-row">
                    <dt>{field.label}</dt>
                    <dd>
                      {field.type === 'checkbox'
                        ? (val ? 'Sí' : 'No')
                        : String(val)}
                    </dd>
                  </div>
                )];
              })}
          </dl>
        </div>
      )}

      {/* My departments */}
      {myDepts.length > 0 && (
        <div className="trabajador-detail__card">
          <h3 className="trabajador-detail__card-title">Mis departamentos</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            {myDepts.map(dept => {
              const slug = dept.department?.slug ?? "";
              const color = DEPT_COLORS[slug] ?? "#6b7280";
              const myWorker = (dept.workers ?? []).find(w => w.user_id === user?.id);
              const asignadas = myWorker?.piezas_asignadas ?? null;
              const completadas = myWorker?.piezas_completadas ?? 0;
              const pct = asignadas && asignadas > 0 ? Math.min(100, Math.round((completadas / asignadas) * 100)) : 0;
              return (
                <div key={dept.id} style={{
                  padding: "0.6rem 0.8rem", borderRadius: 8,
                  border: `1.5px solid ${color}40`, background: `${color}08`,
                }}>
                  <div style={{ fontWeight: 600, fontSize: "0.85rem", color, marginBottom: "0.35rem" }}>
                    {DEPT_LABELS[slug] ?? dept.department?.name}
                    {dept.piezas != null && (
                      <span style={{ fontWeight: 400, fontSize: "0.75rem", color: "var(--text-secondary)", marginLeft: "0.5rem" }}>
                        ({dept.piezas} piezas totales del dept)
                      </span>
                    )}
                  </div>
                  {/* Active phases */}
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "0.3rem", marginBottom: "0.35rem" }}>
                    {(dept.phases ?? []).flatMap(p => p.is_active ? [(
                      <span key={p.id} style={{
                        padding: "0.15rem 0.5rem", borderRadius: 10, fontSize: "0.73rem",
                        background: p.phase?.pieces_from ? `${color}20` : "var(--surface-elevated)",
                        border: `1px solid ${p.phase?.pieces_from ? color : "#e5e7eb"}`,
                        color: p.phase?.pieces_from ? color : "var(--text-secondary)",
                      }}>
                        {p.phase?.name ?? p.custom_name}
                      </span>
                    )] : [])}
                  </div>
                  {/* My piece progress */}
                  {asignadas != null && (
                    <div style={{ marginTop: "0.25rem" }}>
                      <div style={{ height: 6, borderRadius: 3, background: "#e5e7eb", overflow: "hidden", marginBottom: "0.2rem" }}>
                        <div style={{ width: `${pct}%`, height: "100%", background: color, transition: "width 0.3s" }} />
                      </div>
                      <span style={{ fontSize: "0.78rem", fontWeight: 600, color }}>
                        {completadas} / {asignadas} piezas ({pct}%)
                      </span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Timer */}
      {!finalizada && (
        <div className="trabajador-detail__card trabajador-detail__timer-card">
          <h3 className="trabajador-detail__card-title">Temporizador</h3>

          <div className={`trabajador-detail__clock-display ${activeSession ? "trabajador-detail__clock-display--active" : ""}`}>
            <span className="trabajador-detail__clock-icon"><ClockIcon size={22} /></span>
            <span className="trabajador-detail__clock-time">{formatDuration(elapsed)}</span>
          </div>

          {activeSession && activeDept && (
            <div style={{ textAlign: "center", fontSize: "0.8rem", color: "var(--text-secondary)", marginBottom: "0.5rem" }}>
              {DEPT_LABELS[activeDept.department?.slug ?? ""] ?? activeDept.department?.name}
              {activePhaseEntry?.phase?.name && ` · ${activePhaseEntry.phase.name}`}
              {piecesTarget > 0 && ` · ${piecesDone}/${piecesTarget} piezas`}
            </div>
          )}

          {!showStopInput ? (
            <div className="trabajador-detail__timer-actions">
              {!activeSession ? (
                myDepts.length > 0 || isGeneric ? (
                  <button className="trabajador-detail__btn-start" onClick={() => setStartModal(true)} disabled={actionLoading}>
                    Iniciar
                  </button>
                ) : (
                  <p style={{ textAlign: "center", fontSize: "0.83rem", color: "var(--text-secondary)" }}>
                    No estás asignado a ningún departamento activo.
                  </p>
                )
              ) : (
                <>
                  <button className="trabajador-detail__btn-pause" onClick={() => openStop("pause")} disabled={actionLoading}>Pausar</button>
                  <button className="trabajador-detail__btn-stop" onClick={() => openStop("stop")} disabled={actionLoading}>Terminar</button>
                </>
              )}
            </div>
          ) : (
            <div className="trabajador-detail__piezas-input">
              {activePhaseEntry?.phase?.pieces_from ? (
                <>
                  <label htmlFor="td-piezas" className="trabajador-detail__piezas-label">Piezas completadas en esta sesión:</label>
                  <input
                    id="td-piezas"
                    type="number" min="0"
                    value={piezasInput}
                    onChange={e => { setPiezasInput(e.target.value); setPiezasError(""); }}
                    className="trabajador-detail__piezas-field"
                    placeholder="0"
                  />
                  {piezasError && <span className="trabajador-detail__piezas-error">{piezasError}</span>}
                </>
              ) : (
                <>
                  <label htmlFor="td-notas" className="trabajador-detail__piezas-label">Notas (opcional):</label>
                  <textarea
                    id="td-notas"
                    value={notasInput}
                    onChange={e => setNotasInput(e.target.value)}
                    className="trabajador-detail__piezas-field"
                    placeholder="Observaciones de la sesión..."
                    rows={2}
                    style={{ resize: "vertical", width: "100%" }}
                  />
                </>
              )}
              <div className="trabajador-detail__piezas-row">
                {stopMode === "pause" ? (
                  <button className="trabajador-detail__btn-confirm-pause" onClick={handlePause} disabled={actionLoading}>
                    {actionLoading ? "..." : "Pausar"}
                  </button>
                ) : (
                  <button className="trabajador-detail__btn-confirm-stop" onClick={handleStop} disabled={actionLoading}>
                    {actionLoading ? "..." : "Terminar"}
                  </button>
                )}
                <button className="trabajador-detail__btn-cancel" onClick={() => setShowStopInput(false)} disabled={actionLoading}>
                  Cancelar
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Sessions history */}
      {mySessions.length > 0 && (
        <div className="trabajador-detail__card">
          <h3 className="trabajador-detail__card-title">Historial de Sesiones</h3>
          <div className="trabajador-detail__table-wrap">
            <table className="trabajador-detail__table">
              <thead>
                <tr>
                  <th>Fecha</th><th>Inicio</th><th>Fin</th><th>Duración</th><th>Piezas</th><th>Notas</th>
                </tr>
              </thead>
              <tbody>
                {mySessions.map((s) => {
                  const start = new Date(s.start_time);
                  const deptLabel = order.departments?.find(d => d.id === s.work_order_department_id)?.department?.name;
                  return (
                    <tr key={s.id}>
                      <td>{start.toLocaleDateString()}</td>
                      <td>{start.toLocaleTimeString()}</td>
                      <td>{s.end_time ? new Date(s.end_time).toLocaleTimeString() : "—"}</td>
                      <td>{s.duration_in_seconds ? formatDuration(s.duration_in_seconds) : "—"}</td>
                      <td>{s.piezas ?? "—"}</td>
                      <td style={{ maxWidth: 200, fontSize: "0.78rem", color: "var(--text-secondary)" }}>
                        {deptLabel ? <span style={{ fontWeight: 500 }}>{deptLabel}</span> : null}
                        {s.notas && <span>{deptLabel ? " · " : ""}{s.notas}</span>}
                        {!deptLabel && !s.notas && "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Start session modal */}
      {startModal && (
        <div
          className="ordenes-timer__overlay"
          role="button"
          tabIndex={0}
          onClick={() => !actionLoading && setStartModal(false)}
          onKeyDown={(e) => { if ((e.key === 'Enter' || e.key === ' ') && !actionLoading) setStartModal(false); }}
        >
          <div className="ordenes-timer__popup" onClick={e => e.stopPropagation()} style={{ maxWidth: 400 }}>
            <h3 style={{ marginBottom: "1rem", fontSize: "1rem" }}>Iniciar sesión</h3>

            {isGeneric ? (
              <button className="btn-primary" style={{ width: "100%" }}
                onClick={async () => {
                  setActionLoading(true);
                  try {
                    const keyword = order.codigo_orden.replace("GEN-", "").toLowerCase();
                    const result = await workOrderService.startGenericSession(keyword);
                    setOrder(result.work_order);
                    const active = (result.work_order.work_sessions ?? []).find(
                      (s: WorkSession) => s.user_id === user?.id && !s.end_time
                    );
                    setActiveSession(active ?? null);
                    setStartModal(false);
                    sileo.success({ title: "Sesión iniciada" });
                  } catch (err: any) {
                    showHttpError(err, "Error");
                  } finally {
                    setActionLoading(false);
                  }
                }}
                disabled={actionLoading}
              >
                {actionLoading ? "..." : "Iniciar sesión genérica"}
              </button>
            ) : (
              <>
                {/* Step 1: select dept */}
                {!selectedDept ? (
                  <div>
                    <p style={{ fontSize: "0.83rem", color: "var(--text-secondary)", marginBottom: "0.75rem" }}>
                      Selecciona departamento:
                    </p>
                    <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                      {myDepts.map(dept => {
                        const slug = dept.department?.slug ?? "";
                        const color = DEPT_COLORS[slug] ?? "#6b7280";
                        return (
                          <button key={dept.id}
                            onClick={() => setSelectedDept(dept)}
                            style={{
                              padding: "0.6rem 1rem", borderRadius: 8, cursor: "pointer",
                              border: `2px solid ${color}`, background: `${color}10`,
                              color, fontWeight: 600, fontSize: "0.88rem", textAlign: "left",
                            }}
                          >
                            {DEPT_LABELS[slug] ?? dept.department?.name}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  /* Step 2: select phase */
                  <div>
                    <button
                      onClick={() => { setSelectedDept(null); setSelectedPhase(null); }}
                      style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-secondary)", fontSize: "0.8rem", marginBottom: "0.75rem" }}
                    >
                      ← Cambiar departamento
                    </button>
                    <p style={{ fontSize: "0.83rem", color: "var(--text-secondary)", marginBottom: "0.75rem" }}>
                      Selecciona fase en {DEPT_LABELS[selectedDept.department?.slug ?? ""] ?? selectedDept.department?.name}:
                    </p>
                    <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem", marginBottom: "0.75rem" }}>
                      {(selectedDept.phases ?? []).flatMap(p => {
                        if (!p.is_active) return [];
                        const active = selectedPhase?.id === p.id;
                        return [(
                          <button key={p.id}
                            onClick={() => setSelectedPhase(p)}
                            style={{
                              padding: "0.5rem 0.8rem", borderRadius: 6, cursor: "pointer", textAlign: "left",
                              border: `1.5px solid ${active ? "#3b82f6" : "#d1d5db"}`,
                              background: active ? "#eff6ff" : "var(--surface-elevated)",
                              color: active ? "#1d4ed8" : "var(--text-primary)",
                              fontWeight: active ? 600 : 400, fontSize: "0.85rem",
                            }}
                          >
                            {p.phase?.name ?? p.custom_name ?? "Fase"}
                            {p.phase?.pieces_from && <span style={{ marginLeft: 6, fontSize: "0.7rem", color: "#10b981", fontWeight: 600 }}>● piezas</span>}
                          </button>
                        )];
                      })}
                    </div>
                    <button className="btn-primary" style={{ width: "100%" }}
                      onClick={handleStart}
                      disabled={!selectedPhase || actionLoading}
                    >
                      {actionLoading ? "Iniciando..." : "Iniciar sesión"}
                    </button>
                  </div>
                )}
              </>
            )}

            <button className="btn-outline" style={{ width: "100%", marginTop: "0.5rem" }}
              onClick={() => { setStartModal(false); setSelectedDept(null); setSelectedPhase(null); }}
              disabled={actionLoading}
            >
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
