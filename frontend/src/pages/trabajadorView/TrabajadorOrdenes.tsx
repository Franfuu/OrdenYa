import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { workOrderService } from "../../services/workOrderService";
import { userService } from "../../services/userService";
import { Spinner } from "../../components/Spinner";
import { formatDuration } from "../../utils/statusHelpers";
import { useAuth } from "../../auth/authContext";
import type { WorkOrder, WorkSession, WorkOrderDepartment, WorkOrderPhase } from "../../types/WorkOrder";
import { isGenericOrder } from "../../types/WorkOrder";
import { sileo } from "sileo";
import { showHttpError } from "../../utils/errorHelper";
import { LockIcon, MedicalIcon, BroomIcon, SearchIcon, SettingsIcon, ClockIcon, PlayIcon, PauseIcon, StopIcon } from "../../components/Icons";
import { QRScanner } from "../../components/QRScanner";
import { VoiceInput } from "../../components/VoiceInput";
import { useWorkOrdersChannel } from "../../hooks/useWorkOrdersChannel";
import "./OrdenesTemporizador.css";

type ActionMode = "pause" | "stop";

export const TrabajadorOrdenes: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const isSupervisor = user?.role === 'supervisor';
  const detailBasePath = isSupervisor ? '/supervisor/mis-trabajos' : '/trabajador/ordenes';

  const [orders, setOrders] = useState<WorkOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeOrderId, setActiveOrderId] = useState<number | null>(null);
  const [activeSession, setActiveSession] = useState<WorkSession | null>(null);
  const sessionStartRef = useRef<Date | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [actionLoading, setActionLoading] = useState<number | null>(null);

  // Phase selection modal (for starting a session)
  const [phaseModalOrderId, setPhaseModalOrderId] = useState<number | null>(null);
  const [phaseModalDeptId, setPhaseModalDeptId] = useState<number | null>(null);

  // Stop/Pause piezas input
  const [inputOrderId, setInputOrderId] = useState<number | null>(null);
  const [inputMode, setInputMode] = useState<ActionMode>("stop");
  const [piezasInput, setPiezasInput] = useState("");
  const [piezasError, setPiezasError] = useState("");
  const [notasInput, setNotasInput] = useState("");

  const showInactivePopupRef = useRef(false);
  const [showQR, setShowQR] = useState(false);

  // Manual entry modal
  const [showManualModal, setShowManualModal] = useState(false);
  const [manualOrderId, setManualOrderId] = useState<number | null>(null);
  const [manualDeptId, setManualDeptId] = useState<number | null>(null);
  const [manualPhaseId, setManualPhaseId] = useState<number | null>(null);
  const [manualFecha, setManualFecha] = useState("");
  const [manualHoraInicio, setManualHoraInicio] = useState("");
  const [manualHoraFin, setManualHoraFin] = useState("");
  const [manualPiezas, setManualPiezas] = useState("");
  const [manualLoading, setManualLoading] = useState(false);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const inactiveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const userRef = useRef(user);
  useEffect(() => { userRef.current = user; }, [user]);

  // ─── Helpers ───

  const userDeptSlug = (() => {
    const d = (user?.departamento ?? "").toLowerCase();
    if (d === "taller") return "taller";
    if (d === "instalacion" || d === "instalación") return "instalacion";
    return null; // General / null → both
  })();

  const getMyDepts = (order: WorkOrder): WorkOrderDepartment[] => {
    if (!user) return [];
    const restrict = user.role === 'trabajador' && userDeptSlug !== null;
    return (order.departments ?? []).filter(d =>
      !d.finalizado_at &&
      (!restrict || d.department?.slug === userDeptSlug) &&
      (d.workers ?? []).some(w => w.user_id === user.id && !w.approved_at)
    );
  };

  const getActivePhasesForDept = (dept: WorkOrderDepartment): WorkOrderPhase[] =>
    (dept.phases ?? []).filter(p => p.is_active);

  const getMyPhasesForDept = (dept: WorkOrderDepartment): WorkOrderPhase[] => {
    if (!user) return [];
    const worker = (dept.workers ?? []).find(w => w.user_id === user.id);
    if (!worker) return [];
    const assignedIds = new Set((worker.phase_pieces ?? []).map(pp => pp.work_order_phase_id));
    return (dept.phases ?? []).filter(p => p.is_active && assignedIds.has(p.id));
  };

  const phaseNeedsPiezas = (phase: WorkOrderPhase | null | undefined): boolean =>
    phase?.phase?.pieces_from === true;

  const getActivePhaseFull = (order: WorkOrder): WorkOrderPhase | null => {
    if (!activeSession?.work_order_phase_id) return null;
    for (const dept of order.departments ?? []) {
      const phase = (dept.phases ?? []).find(p => p.id === activeSession.work_order_phase_id);
      if (phase) return phase;
    }
    return null;
  };

  const getPiezasCompletadas = (order: WorkOrder): number => {
    if (!user) return 0;
    // Solo cuenta los departamentos visibles para el usuario (respeta filtro por dept global)
    return getMyDepts(order).reduce((total, dept) => {
      const worker = (dept.workers ?? []).find(w => w.user_id === user.id);
      return total + (worker?.piezas_completadas ?? 0);
    }, 0);
  };

  const getUnidades = (order: WorkOrder): number => {
    // Suma las piezas asignadas SOLO en los departamentos del usuario (no del orden completo)
    if (!user) return order.unidades ?? 0;
    const mine = getMyDepts(order).reduce((total, dept) => {
      const worker = (dept.workers ?? []).find(w => w.user_id === user.id);
      return total + (worker?.piezas_asignadas ?? 0);
    }, 0);
    return mine || (order.unidades ?? 0);
  };

  // ─── Data Fetching ───

  const fetchOrders = useCallback(async (keepActive = false) => {
    try {
      const list = await workOrderService.getAll();
      setOrders(list);

      const currentUser = userRef.current;
      if (currentUser) {
        let found = false;
        for (const order of list) {
          const active = (order.work_sessions ?? []).find(
            (s: WorkSession) => s.user_id === currentUser.id && !s.end_time
          );
          if (active) {
            setActiveOrderId(order.id);
            setActiveSession(active);
            sessionStartRef.current = new Date(active.start_time);
            found = true;
            break;
          }
        }
        if (!found && !keepActive) {
          setActiveOrderId(null);
          setActiveSession(null);
          sessionStartRef.current = null;
        }
      }
    } catch (err: any) {
      showHttpError(err, 'Error al cargar las órdenes.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchOrders(); }, [fetchOrders]);

  // Live: refetch al recibir cambio por WebSocket (mantiene sesión activa)
  useWorkOrdersChannel(() => { fetchOrders(true); });

  // 60s polling — skip if active session to avoid interrupting timer state
  useEffect(() => {
    if (activeOrderId !== null) return;
    const interval = setInterval(() => {
      fetchOrders(true);
    }, 60_000);
    return () => clearInterval(interval);
  }, [activeOrderId, fetchOrders]);

  // Inactivity popup
  useEffect(() => {
    if (inactiveTimerRef.current) clearTimeout(inactiveTimerRef.current);
    if (!loading && activeOrderId === null) {
      inactiveTimerRef.current = setTimeout(() => showInactivePopupRef.current = true, 5 * 60 * 1000);
    } else {
      showInactivePopupRef.current = false;
    }
    return () => { if (inactiveTimerRef.current) clearTimeout(inactiveTimerRef.current); };
  }, [activeOrderId, loading]);

  // ESC closes open modals
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (showManualModal) setShowManualModal(false);
      else if (showQR) setShowQR(false);
      else if (phaseModalOrderId) setPhaseModalOrderId(null);
      else if (inputOrderId) closeInput();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [showManualModal, showQR, phaseModalOrderId, inputOrderId]);

  // Timer tick
  useEffect(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (activeOrderId && sessionStartRef.current) {
      setElapsed(Math.floor((Date.now() - sessionStartRef.current.getTime()) / 1000));
      intervalRef.current = setInterval(() => {
        setElapsed(Math.floor((Date.now() - sessionStartRef.current.getTime()) / 1000));
      }, 1000);
    } else {
      setElapsed(0);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [activeOrderId]);

  // ─── Session Actions ───

  const handleStartClick = (orderId: number) => {
    const order = orders.find(o => o.id === orderId);
    if (!order) return;

    const myDepts = getMyDepts(order);
    if (myDepts.length === 0) {
      sileo.error({ title: 'No tienes departamentos asignados en esta orden.' });
      return;
    }

    // If only one dept + one phase, auto-start
    if (myDepts.length === 1) {
      const phases = getActivePhasesForDept(myDepts[0]);
      if (phases.length === 1) {
        doStartSession(orderId, myDepts[0].id, phases[0].id);
        return;
      }
    }

    setPhaseModalOrderId(orderId);
    setPhaseModalDeptId(myDepts.length === 1 ? myDepts[0].id : null);
  };

  const doStartSession = async (orderId: number, deptId: number, phaseId: number) => {
    setActionLoading(orderId);
    try {
      const result = await workOrderService.startSession(orderId, {
        work_order_department_id: deptId,
        work_order_phase_id: phaseId,
      });
      setActiveOrderId(orderId);
      setActiveSession(result.session);
      sessionStartRef.current = new Date(result.session.start_time);
      setPhaseModalOrderId(null);
      setPhaseModalDeptId(null);
      sileo.success({ title: 'Sesión iniciada' });
      await fetchOrders(true);
    } catch (err: any) {
      showHttpError(err, 'Error al iniciar');
    } finally {
      setActionLoading(null);
    }
  };

  const openInput = (orderId: number, mode: ActionMode) => {
    const order = orders.find(o => o.id === orderId);
    const activePhase = order ? getActivePhaseFull(order) : null;
    const needsPiezas = phaseNeedsPiezas(activePhase) && !isGenericOrder(order!);
    // Pause without pieces: execute directly (no confirmation needed)
    if (mode === 'pause' && !needsPiezas) {
      handlePause(orderId, 0);
      return;
    }
    // Stop always shows confirmation panel
    setInputOrderId(orderId);
    setInputMode(mode);
    setPiezasInput("");
    setPiezasError("");
    setNotasInput("");
  };

  const closeInput = () => {
    setInputOrderId(null);
    setPiezasInput("");
    setPiezasError("");
    setNotasInput("");
  };

  const handlePause = async (orderId: number, piezas: number, notas?: string) => {
    setActionLoading(orderId);
    try {
      await workOrderService.pauseSession(orderId, { piezas, notas });
      setActiveOrderId(null);
      sessionStartRef.current = null;
      setActiveSession(null);
      window.dispatchEvent(new Event('session:ended'));
      closeInput();
      sileo.success({ title: 'Sesión pausada' });
      await fetchOrders();
    } catch (err: any) {
      showHttpError(err, 'Error al pausar');
    } finally {
      setActionLoading(null);
    }
  };

  const handleStop = async (orderId: number, piezas: number, notas?: string) => {
    setActionLoading(orderId);
    try {
      await workOrderService.stopSession(orderId, { piezas, notas });
      setActiveOrderId(null);
      sessionStartRef.current = null;
      setActiveSession(null);
      window.dispatchEvent(new Event('session:ended'));
      closeInput();
      sileo.success({ title: 'Sesión finalizada', description: `${piezas} piezas registradas` });
      await fetchOrders();
    } catch (err: any) {
      showHttpError(err, 'Error al finalizar');
    } finally {
      setActionLoading(null);
    }
  };

  const handleConfirmAction = async (order: WorkOrder) => {
    const piezas = piezasInput.trim() !== "" ? parseInt(piezasInput, 10) : 0;
    if (isNaN(piezas) || piezas < 0) {
      setPiezasError("Introduce un número de piezas válido.");
      return;
    }
    const notas = notasInput.trim() || undefined;
    if (inputMode === 'pause') await handlePause(order.id, piezas, notas);
    else await handleStop(order.id, piezas, notas);
  };

  const handleGenericTask = async (taskName: string, keyword: string) => {
    if (activeOrderId) {
      setActionLoading(activeOrderId);
      try {
        await workOrderService.pauseSession(activeOrderId, { piezas: 0 });
      } catch {
        setActionLoading(null);
        return;
      }
    }
    setActionLoading(-1);
    try {
      const result = await workOrderService.startGenericSession(keyword);
      setOrders(prev => {
        const idx = prev.findIndex(o => o.id === result.work_order.id);
        if (idx >= 0) { const c = [...prev]; c[idx] = result.work_order; return c; }
        return [result.work_order, ...prev];
      });
      setActiveOrderId(result.session.work_order_id);
      setActiveSession(result.session);
      sessionStartRef.current = new Date(result.session.start_time);
      closeInput();
      sileo.success({ title: `Iniciando tarea: ${taskName}` });
      await fetchOrders(true);
    } catch (err: any) {
      showHttpError(err, `Error al iniciar ${taskName}`);
    } finally {
      setActionLoading(null);
    }
  };

  // ─── Manual ───

  const openManualModal = () => {
    setManualOrderId(null);
    setManualDeptId(null);
    setManualPhaseId(null);
    setManualFecha(new Date().toISOString().slice(0, 10));
    setManualHoraInicio("");
    setManualHoraFin("");
    setManualPiezas("");
    setShowManualModal(true);
  };

  const handleManualSubmit = async () => {
    if (!manualOrderId) { sileo.error({ title: 'Selecciona una orden.' }); return; }
    if (!manualFecha || !manualHoraInicio || !manualHoraFin) {
      sileo.error({ title: 'Rellena fecha y horas.' }); return;
    }
    if (manualHoraFin <= manualHoraInicio) {
      sileo.error({ title: 'La hora de fin debe ser posterior.' }); return;
    }
    const piezas = parseInt(manualPiezas, 10) || 0;
    setManualLoading(true);
    try {
      await workOrderService.manualSession(manualOrderId, {
        fecha: manualFecha,
        hora_inicio: manualHoraInicio,
        hora_fin: manualHoraFin,
        piezas,
        work_order_department_id: manualDeptId ?? undefined,
        work_order_phase_id: manualPhaseId ?? undefined,
      });
      sileo.success({ title: 'Entrada registrada.' });
      setShowManualModal(false);
      await fetchOrders();
    } catch (err: any) {
      showHttpError(err, 'Error al registrar.');
    } finally {
      setManualLoading(false);
    }
  };

  // ─── Derived State ───

  const activeOrder = orders.find(o => o.id === activeOrderId);
  const activePhase = activeOrder ? getActivePhaseFull(activeOrder) : null;

  const previousSessionsTime = useMemo(() => {
    if (!activeOrder || !user) return 0;
    return (activeOrder.work_sessions ?? [])
      .filter((s: WorkSession) => s.user_id === user.id && s.end_time &&
        s.work_order_department_id === activeSession?.work_order_department_id &&
        s.work_order_phase_id === activeSession?.work_order_phase_id)
      .reduce((sum: number, s: WorkSession) => {
        const dur = Math.floor((new Date(s.end_time!).getTime() - new Date(s.start_time).getTime()) / 1000);
        return sum + dur;
      }, 0);
  }, [activeOrder, user, activeSession]);

  const totalElapsed = previousSessionsTime + elapsed;

  const hasActiveSession = (order: WorkOrder) =>
    (order.work_sessions ?? []).some(s => s.user_id === user?.id && !s.end_time);

  const visibleOrders = useMemo(() =>
    orders.filter(o => {
      if (isGenericOrder(o)) return o.id === activeOrderId;
      const myDepts = getMyDepts(o);
      return myDepts.length > 0 || o.id === activeOrderId || hasActiveSession(o);
    }), [orders, activeOrderId, user]);

  if (loading) return <Spinner message="Cargando órdenes..." />;

  const phaseModalOrder = orders.find(o => o.id === phaseModalOrderId);
  const phaseModalDepts = phaseModalOrder ? getMyDepts(phaseModalOrder) : [];

  return (
    <div className="ordenes-timer animate-fade-in">

      {/* ── Header ── */}
      <div className="ordenes-timer__header">
        <div>
          <h2 className="ordenes-timer__title">Mis Órdenes</h2>
          <p className="ordenes-timer__header-sub">
            {visibleOrders.filter(o => !isGenericOrder(o)).length} orden{visibleOrders.filter(o => !isGenericOrder(o)).length !== 1 ? "es" : ""} asignada{visibleOrders.filter(o => !isGenericOrder(o)).length !== 1 ? "s" : ""}
          </p>
        </div>
        <div className="ordenes-timer__header-actions">
          <button
            className="btn-outline ordenes-timer__hdr-btn"
            onClick={() => fetchOrders(true)}
            disabled={loading}
            title="Actualizar lista"
            style={{ padding: '0.45rem 0.7rem' }}
          >
            ↻
          </button>
          <button className="btn-outline ordenes-timer__hdr-btn" onClick={openManualModal}>
            + Entrada Manual
          </button>
        </div>
      </div>

      {/* ── Timer Banner ── */}
      <div className={`glass-card ordenes-timer__banner ${activeOrderId ? "ordenes-timer__banner--active" : ""}`}>
        <div className="ordenes-timer__banner-left">
          <div className="ordenes-timer__banner-title">
            {activeOrderId ? "Trabajando en" : "Sin sesión activa"}
          </div>
          <div className="ordenes-timer__banner-label">
            {activeOrder ? activeOrder.nombre_orden : "Inicia una orden para comenzar a fichar"}
          </div>
          {activePhase && (
            <div className="ordenes-timer__banner-task">
              {activePhase.phase?.name ?? activePhase.custom_name}
            </div>
          )}
          {activeOrder && !isGenericOrder(activeOrder) && activePhase && phaseNeedsPiezas(activePhase) && (
            <div className="ordenes-timer__banner-progress">
              {getPiezasCompletadas(activeOrder)} / {getUnidades(activeOrder)} piezas
            </div>
          )}
        </div>
        <div className="ordenes-timer__clock">
          <ClockIcon size={20} />
          {formatDuration(totalElapsed)}
        </div>
      </div>

      {/* ── Orders List ── */}
      <div className="glass-card ordenes-timer__list-card">
        {visibleOrders.length === 0 ? (
          <p className="ordenes-timer__empty">No tienes órdenes activas asignadas.</p>
        ) : (
          <div className="ordenes-timer__list">
            {visibleOrders.map(order => {
              const isActive = order.id === activeOrderId;
              const isOtherRunning = activeOrderId !== null && activeOrderId !== order.id;
              const generic = isGenericOrder(order);
              const myDepts = getMyDepts(order);
              const inputOpen = inputOrderId === order.id;
              const isRunning = isActive;
              const unidades = getUnidades(order);
              const piezasHechas = getPiezasCompletadas(order);
              const loading_ = actionLoading === order.id;

              return (
                <div key={order.id} className={`ordenes-timer__row ${isActive ? "ordenes-timer__row--active" : ""}`}>

                  {/* Info */}
                  <div className="ordenes-timer__row-info">
                    <span className="ordenes-timer__row-code">{order.codigo_orden}</span>
                    <span className="ordenes-timer__row-name">{order.nombre_orden}</span>
                    {!generic && myDepts.length > 0 && (
                      <div style={{ display: 'flex', gap: '0.3rem', flexWrap: 'wrap', marginTop: '0.2rem' }}>
                        {myDepts.map(d => (
                          <span key={d.id} className="ordenes-timer__dept-badge">{d.department?.name}</span>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Pieces counter */}
                  {!generic && unidades > 0 && !inputOpen && (
                    <div className="ordenes-timer__row-pieces">
                      <span className="ordenes-timer__pieces-label">piezas</span>
                      <span className="ordenes-timer__pieces-value">{piezasHechas}/{unidades}</span>
                    </div>
                  )}

                  {/* Piezas/confirm input */}
                  {inputOpen && (() => {
                    const needsPiezas = phaseNeedsPiezas(activePhase) && !generic;
                    return (
                      <div className="ordenes-timer__input-wrap">
                        <div className="ordenes-timer__stop-input">
                          {needsPiezas ? (
                            <>
                              <input
                                type="number" min={0} placeholder="Piezas"
                                value={piezasInput}
                                onChange={e => { setPiezasInput(e.target.value); setPiezasError(""); }}
                                className="ordenes-timer__pieces-field"
                              />
                              {piezasError && <span style={{ fontSize: '0.75rem', color: '#ef4444' }}>{piezasError}</span>}
                            </>
                          ) : (
                            <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                              ¿Confirmar {inputMode === 'pause' ? 'pausar' : 'finalizar'}?
                            </span>
                          )}
                          <button className="ordenes-timer__btn-confirm" onClick={() => handleConfirmAction(order)} disabled={loading_}>
                            {inputMode === 'pause' ? 'Pausar' : 'Finalizar'}
                          </button>
                          <button className="ordenes-timer__btn-cancel" onClick={closeInput}>Cancelar</button>
                        </div>
                        <div style={{ display: "flex", gap: "0.4rem", alignItems: "flex-start" }}>
                          <textarea
                            placeholder="Notas (opcional)"
                            value={notasInput}
                            onChange={e => setNotasInput(e.target.value)}
                            className="ordenes-timer__notas-input"
                            rows={1}
                            style={{ fontSize: '0.8rem', flex: 1 }}
                          />
                          <VoiceInput onResult={text => setNotasInput(prev => prev ? `${prev} ${text}` : text)} />
                        </div>
                      </div>
                    );
                  })()}

                  {/* Action buttons */}
                  {!inputOpen && (
                    <div className="ordenes-timer__row-actions">
                      <button
                        className={`ordenes-timer__btn ordenes-timer__btn-a${isRunning || isOtherRunning ? " ordenes-timer__btn--disabled" : ""}`}
                        onClick={() => !isRunning && !isOtherRunning && handleStartClick(order.id)}
                        disabled={loading_ || isRunning || isOtherRunning}
                        title="Empezar"
                      ><PlayIcon size={15} /></button>
                      <button
                        className={`ordenes-timer__btn ordenes-timer__btn-b${!isRunning ? " ordenes-timer__btn--disabled" : ""}`}
                        onClick={() => isRunning && openInput(order.id, 'pause')}
                        disabled={loading_ || !isRunning}
                        title="Pausar"
                      ><PauseIcon size={15} /></button>
                      <button
                        className={`ordenes-timer__btn ordenes-timer__btn-c${!isRunning ? " ordenes-timer__btn--disabled" : ""}`}
                        onClick={() => isRunning && openInput(order.id, 'stop')}
                        disabled={loading_ || !isRunning}
                        title="Finalizar mi parte"
                      ><StopIcon size={15} /></button>
                    </div>
                  )}

                  {/* Ver */}
                  {!inputOpen && (
                    <div style={{ display: "flex", flexDirection: "column", gap: "0.3rem", flexShrink: 0 }}>
                      <button className="ordenes-timer__details-btn" onClick={() => navigate(`${detailBasePath}/${order.id}`)}>
                        Ver
                      </button>
                      {isSupervisor && (
                        <button className="ordenes-timer__details-btn" onClick={() => navigate(`/supervisor/ordenes/ver/${order.id}`)}>
                          Sup.
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Acceso Rápido ── */}
      <div className="glass-card ordenes-timer__quick">
        <h3 className="ordenes-timer__quick-title">Acceso Rápido</h3>
        <div className="ordenes-timer__quick-grid">
          <button className="ordenes-timer__generic-btn" onClick={() => handleGenericTask('Limpiar Fábrica', 'limpieza')} disabled={actionLoading !== null}>
            <div className="generic-btn-icon"><BroomIcon size={26} /></div>
            <div className="generic-btn-text">Limpieza</div>
          </button>
          <button className="ordenes-timer__generic-btn" onClick={() => handleGenericTask('Búsqueda de material', 'busqueda')} disabled={actionLoading !== null}>
            <div className="generic-btn-icon"><SearchIcon size={26} /></div>
            <div className="generic-btn-text">Búsqueda</div>
          </button>
          <button className="ordenes-timer__generic-btn" onClick={() => handleGenericTask('Mantenimiento', 'mantenimiento')} disabled={actionLoading !== null}>
            <div className="generic-btn-icon"><SettingsIcon size={26} /></div>
            <div className="generic-btn-text">Mantenimiento</div>
          </button>
          <button className="ordenes-timer__generic-btn" onClick={() => setShowQR(true)}>
            <div className="generic-btn-icon">
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="7" height="7" rx="1"/>
                <rect x="14" y="3" width="7" height="7" rx="1"/>
                <rect x="3" y="14" width="7" height="7" rx="1"/>
                <path d="M14 14h3v3h-3z M19 14h2 M14 19h3 M19 19v2"/>
              </svg>
            </div>
            <div className="generic-btn-text">Escanear QR</div>
          </button>
        </div>
      </div>

      {showQR && (
        <QRScanner
          onResult={(decoded) => {
            setShowQR(false);
            const m = decoded.match(/\/ordenes\/(?:ver\/)?(\d+)/) || decoded.match(/\/(\d+)$/);
            const id = m ? Number(m[m.length - 1]) : NaN;
            if (id && orders.find(o => o.id === id)) {
              const order = orders.find(o => o.id === id)!;
              handleStartClick(order.id);
              sileo.success({ title: `Orden ${order.codigo_orden} escaneada` });
            } else {
              sileo.error({ title: "QR no reconocido" });
            }
          }}
          onClose={() => setShowQR(false)}
        />
      )}

      {/* Phase Selection Modal */}
      {phaseModalOrderId && phaseModalOrder && (
        <div
          className="ordenes-timer__modal-overlay"
          role="button"
          tabIndex={0}
          onClick={() => setPhaseModalOrderId(null)}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setPhaseModalOrderId(null); }}
        >
          <div className="ordenes-timer__modal" onClick={e => e.stopPropagation()}>
            <h3>Selecciona fase</h3>
            <p className="ordenes-timer__modal-order">{phaseModalOrder.nombre_orden}</p>

            {phaseModalDepts.map(dept => {
              const phases = getActivePhasesForDept(dept);
              if (phases.length === 0) return null;
              return (
                <div key={dept.id} className="ordenes-timer__modal-dept">
                  <h4 className="ordenes-timer__modal-dept-name">{dept.department?.name}</h4>
                  {phases.map(phase => (
                    <button
                      key={phase.id}
                      className="ordenes-timer__modal-phase-btn"
                      onClick={() => doStartSession(phaseModalOrderId, dept.id, phase.id)}
                      disabled={actionLoading !== null}
                    >
                      {phase.phase?.name ?? phase.custom_name}
                      {phaseNeedsPiezas(phase) && (
                        <span className="ordenes-timer__modal-pieces-tag">cuenta piezas</span>
                      )}
                    </button>
                  ))}
                </div>
              );
            })}

            <button className="ordenes-timer__modal-cancel" onClick={() => setPhaseModalOrderId(null)}>
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Ausencia Modal */}
      {/* Manual Session Modal */}
      {showManualModal && (
        <div
          className="ordenes-timer__modal-overlay"
          role="button"
          tabIndex={0}
          onClick={() => setShowManualModal(false)}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setShowManualModal(false); }}
        >
          <div className="pgs-modal" onClick={e => e.stopPropagation()}>
            <div className="pgs-modal__header">
              <div className="pgs-modal__header-title">
                <span className="pgs-modal__header-icon">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 20h9 M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/>
                  </svg>
                </span>
                <h3>Entrada Manual</h3>
              </div>
              <button className="pgs-modal__close" onClick={() => setShowManualModal(false)}>✕</button>
            </div>
            <div className="pgs-modal__divider" />
            <div className="pgs-modal__body">
              <div className="pgs-modal__field">
                <label htmlFor="manual-orden">Orden</label>
                <select id="manual-orden" value={manualOrderId ?? ""} onChange={e => { setManualOrderId(Number(e.target.value)); setManualDeptId(null); setManualPhaseId(null); }}>
                  <option value="">Seleccionar…</option>
                  {orders.filter(o => !isGenericOrder(o) && getMyDepts(o).length > 0).map(o => (
                    <option key={o.id} value={o.id}>{o.codigo_orden}: {o.nombre_orden}</option>
                  ))}
                </select>
              </div>

              {manualOrderId && (() => {
                const mo = orders.find(o => o.id === manualOrderId);
                const myD = mo ? getMyDepts(mo) : [];
                return myD.length > 0 ? (
                  <>
                    <div className="pgs-modal__field">
                      <label htmlFor="manual-dept">Departamento</label>
                      <select id="manual-dept" value={manualDeptId ?? ""} onChange={e => { setManualDeptId(Number(e.target.value)); setManualPhaseId(null); }}>
                        <option value="">Seleccionar…</option>
                        {myD.map(d => <option key={d.id} value={d.id}>{d.department?.name}</option>)}
                      </select>
                    </div>
                    {manualDeptId && (() => {
                      const dept = myD.find(d => d.id === manualDeptId);
                      const myPhases = dept ? getMyPhasesForDept(dept) : [];
                      const phases = myPhases.length > 0 ? myPhases : (dept ? getActivePhasesForDept(dept) : []);
                      return phases.length > 0 ? (
                        <div className="pgs-modal__field">
                          <span className="pgs-modal__field-label">Fase</span>
                          <div className="pgs-modal__phase-list">
                            {phases.map(p => (
                              <button
                                key={p.id}
                                type="button"
                                className={`pgs-modal__phase-btn${manualPhaseId === p.id ? ' pgs-modal__phase-btn--active' : ''}`}
                                onClick={() => setManualPhaseId(p.id)}
                              >
                                <span>{p.phase?.name ?? p.custom_name}</span>
                                {p.phase?.pieces_from && <span className="pgs-modal__phase-tag">piezas</span>}
                              </button>
                            ))}
                          </div>
                        </div>
                      ) : null;
                    })()}
                  </>
                ) : null;
              })()}

              <div className="pgs-modal__field">
                <label htmlFor="manual-fecha">Fecha</label>
                <input id="manual-fecha" type="date" value={manualFecha} onChange={e => setManualFecha(e.target.value)} />
              </div>
              <div className="pgs-modal__field">
                <span className="pgs-modal__field-label">Horario</span>
                <div className="pgs-modal__time-row">
                  <div className="pgs-modal__time-col">
                    <label htmlFor="manual-hora-inicio" className="pgs-modal__time-label">Inicio</label>
                    <input id="manual-hora-inicio" type="time" value={manualHoraInicio} onChange={e => setManualHoraInicio(e.target.value)} />
                  </div>
                  <div className="pgs-modal__time-col">
                    <label htmlFor="manual-hora-fin" className="pgs-modal__time-label">Fin</label>
                    <input id="manual-hora-fin" type="time" value={manualHoraFin} onChange={e => setManualHoraFin(e.target.value)} />
                  </div>
                </div>
              </div>

              {(() => {
                if (!manualOrderId || !manualDeptId || !manualPhaseId) return null;
                const mo = orders.find(o => o.id === manualOrderId);
                const dept = mo ? getMyDepts(mo).find(d => d.id === manualDeptId) : undefined;
                const phase = dept ? (dept.phases ?? []).find(p => p.id === manualPhaseId) : undefined;
                if (!phase?.phase?.pieces_from) return null;
                return (
                  <div className="pgs-modal__field">
                    <label htmlFor="manual-piezas">Piezas</label>
                    <input id="manual-piezas" type="number" min={0} value={manualPiezas} onChange={e => setManualPiezas(e.target.value)} placeholder="0" />
                  </div>
                );
              })()}
            </div>
            <div className="pgs-modal__actions">
              <button className="pgs-modal__btn-ghost" onClick={() => setShowManualModal(false)}>
                Cancelar
              </button>
              <button className="pgs-modal__btn-primary" onClick={handleManualSubmit} disabled={manualLoading}>
                {manualLoading ? "Guardando..." : "Registrar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
