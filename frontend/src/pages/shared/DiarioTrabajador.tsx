import React, { useState, useEffect, useMemo, useCallback } from "react";
import { workOrderService } from "../../services/workOrderService";
import { useAuth } from "../../auth/authContext";
import { formatDuration } from "../../utils/statusHelpers";
import { getErrorMessage, showHttpError } from "../../utils/errorHelper";
import { Spinner } from "../../components/Spinner";
import { WorkSession } from "../../types/WorkOrder";
import { sileo } from "sileo";
import { EditIcon, ChevronDownIcon } from "../../components/Icons";
import "../trabajadorView/OrdenesTemporizador.css";
import "./DiarioTrabajador.css";


interface Props {
  userId?: number;
  userName?: string;
}

export const DiarioTrabajador: React.FC<Props> = ({ userId, userName }) => {
  const { user: authUser } = useAuth();
  const targetUserId = userId || authUser?.id;
  const targetUserName = userName || authUser?.name;

  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [sessions, setSessions] = useState<WorkSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Edit session state
  const [editSessionId, setEditSessionId] = useState<number | null>(null);
  const [editHoraInicio, setEditHoraInicio] = useState("");
  const [editHoraFin, setEditHoraFin] = useState("");
  const [editPiezas, setEditPiezas] = useState("");
  const [editLoading, setEditLoading] = useState(false);
  const [editIsGeneric, setEditIsGeneric] = useState(false);

  const isOwnDiary = !userId; // no prop = trabajador viendo el suyo
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const toggleGroup = (key: string) => setExpandedGroups(prev => {
    const next = new Set(prev);
    next.has(key) ? next.delete(key) : next.add(key);
    return next;
  });

  const fetchSessions = useCallback(async () => {
    if (!targetUserId) return;
    setError(null);
    try {
      setLoading(true);
      const res = await workOrderService.getSessionsForUser(targetUserId, date);
      setSessions(res);
    } catch (err: any) {
      setError(getErrorMessage(err));
      setSessions([]);
    } finally {
      setLoading(false);
    }
  }, [targetUserId, date]);

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  const totalSeconds = useMemo(() => {
    return sessions.reduce((acc, s) => {
      if (!s.end_time) return acc;
      const start = new Date(s.start_time).getTime();
      const end = new Date(s.end_time).getTime();
      return acc + (end - start) / 1000;
    }, 0);
  }, [sessions]);

  const openEdit = (session: WorkSession) => {
    const start = new Date(session.start_time);
    const end = session.end_time ? new Date(session.end_time) : null;
    setEditSessionId(session.id);
    setEditHoraInicio(start.toTimeString().slice(0, 8));
    setEditHoraFin(end ? end.toTimeString().slice(0, 8) : "");
    setEditPiezas(String(session.piezas ?? 0));
    setEditIsGeneric(session.work_order?.codigo_orden?.startsWith('GEN-') ?? false);
  };

  const closeEdit = () => setEditSessionId(null);

  const handleEditSubmit = async () => {
    if (!editHoraInicio || !editHoraFin) { sileo.error({ title: 'Introduce hora de inicio y fin.' }); return; }
    if (editHoraFin <= editHoraInicio) { sileo.error({ title: 'La hora de fin debe ser posterior a la de inicio.' }); return; }
    const piezas = editIsGeneric ? 0 : parseInt(editPiezas, 10);
    if (!editIsGeneric && (isNaN(piezas) || piezas < 0)) { sileo.error({ title: 'Número de piezas inválido.' }); return; }

    setEditLoading(true);
    try {
      await workOrderService.updateSession(editSessionId!, {
        hora_inicio: editHoraInicio,
        hora_fin: editHoraFin,
        piezas,
      });
      sileo.success({ title: 'Sesión actualizada.' });
      closeEdit();
      fetchSessions();
    } catch (err: any) {
      showHttpError(err, 'Error al actualizar sesión');
    } finally {
      setEditLoading(false);
    }
  };

  if (!targetUserId) return <p>Inicia sesión primero.</p>;

  return (
    <div className="animate-fade-in" style={{ padding: '0.5rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h2 style={{ fontSize: '1.4rem', fontWeight: 700, margin: 0 }}>Diario de {targetUserName}</h2>
            <p className="diario__subtitle-text">Actividad y fichajes por día</p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>Fecha:</span>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="diario__edit-input"
              style={{ padding: '0.5rem 0.75rem' }}
            />
          </div>
      </div>

      <div className="diario__summary-section" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
           <span className="diario__section-label">Resumen del día</span>
           <div style={{ fontSize: '1.2rem', fontWeight: 700, marginTop: '0.1rem' }}>Total horas: <span style={{ color: 'var(--primary)' }}>{formatDuration(totalSeconds)}</span></div>
        </div>
        <div style={{ textAlign: 'right' }}>
           <span className="diario__section-label">Fichajes</span>
           <div style={{ fontSize: '1.2rem', fontWeight: 700, marginTop: '0.1rem' }}>{sessions.length}</div>
        </div>
      </div>

      {loading ? (
        <Spinner message="Obteniendo actividad..." />
      ) : error ? (
        <div className="diario__error-box">
          <span>{error}</span>
          <button onClick={fetchSessions} className="diario__error-retry">
            Reintentar
          </button>
        </div>
      ) : (
        <div className="ordenes-timer__diary">
            <div className="ordenes-timer__diary-list">
                {sessions.length === 0 ? (
                    <p className="ordenes-timer__empty" style={{ padding: '2rem' }}>No hay actividad registrada para este día.</p>
                ) : (() => {
                    // Agrupar sesiones por orden
                    const groups: { key: string; sessions: WorkSession[] }[] = [];
                    sessions.forEach(s => {
                        const key = s.work_order_id ? String(s.work_order_id) : 'deleted';
                        const existing = groups.find(g => g.key === key);
                        if (existing) existing.sessions.push(s);
                        else groups.push({ key, sessions: [s] });
                    });

                    return groups.map(group => {
                        const groupSessions = group.sessions;
                        const firstSession = groupSessions[0];
                        const isGeneric = firstSession.work_order?.codigo_orden?.startsWith('GEN-') ?? false;

                        const totalGroupSeconds = groupSessions.reduce((sum, s) => {
                            if (!s.end_time) return sum;
                            return sum + Math.floor((new Date(s.end_time).getTime() - new Date(s.start_time).getTime()) / 1000);
                        }, 0);
                        const totalPiezas = groupSessions.reduce((sum, s) => sum + (s.piezas || 0), 0);
                        const firstStart = new Date(groupSessions[0].start_time);
                        const lastEnd = groupSessions.map(s => s.end_time ? new Date(s.end_time) : null).filter(Boolean).sort((a, b) => b!.getTime() - a!.getTime())[0];

                        // Desglose tiempo por fase (solo sesiones con fase real)
                        const phaseMap: Record<string, { name: string; seconds: number }> = {};
                        groupSessions.forEach(s => {
                            if (!s.end_time) return;
                            const phaseName = s.work_order_phase?.phase?.name ?? null;
                            if (!phaseName) return; // ignorar sin fase
                            const dur = Math.floor((new Date(s.end_time).getTime() - new Date(s.start_time).getTime()) / 1000);
                            if (!phaseMap[phaseName]) phaseMap[phaseName] = { name: phaseName, seconds: 0 };
                            phaseMap[phaseName].seconds += dur;
                        });
                        const phaseBreakdown = Object.values(phaseMap).filter(p => p.seconds > 0);

                        const isGroupExpanded = expandedGroups.has(group.key);
                        return (
                            <div
                                key={group.key}
                                className={`diario__group-item${isGroupExpanded ? ' diario__group-item--expanded' : ''}`}
                            >
                                {/* Cabecera del grupo */}
                                <div
                                    onClick={() => toggleGroup(group.key)}
                                    className={`diario__group-header${isGroupExpanded ? ' diario__group-header--expanded' : ''}`}
                                    style={{ gap: '0.75rem', padding: '0.85rem 1rem', userSelect: 'none' }}
                                >
                                    {/* Chevron */}
                                    <span style={{
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        width: '20px', height: '20px', flexShrink: 0,
                                        fontSize: '0.7rem',
                                        transform: isGroupExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                                        transition: 'transform 0.2s',
                                        color: 'var(--text-muted)',
                                    }}><ChevronDownIcon size={14} /></span>

                                    {/* Info orden */}
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div className="diario__group-title">
                                            {firstSession.work_order ? (
                                                <>{firstSession.work_order.codigo_orden}: {firstSession.work_order.nombre_orden}</>
                                            ) : (
                                                <span className="diario__group-deleted">Orden eliminada</span>
                                            )}
                                        </div>
                                        <div className="diario__group-meta">
                                            <span>
                                                {firstStart.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                {lastEnd ? ` → ${lastEnd.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : ' → ...'}
                                            </span>
                                            {groupSessions.length > 1 && (
                                                <span className="diario__dept-chip">
                                                    {groupSessions.length}
                                                </span>
                                            )}
                                        </div>
                                        {phaseBreakdown.length > 0 && (
                                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem', marginTop: '0.3rem' }}>
                                                {phaseBreakdown.map(p => (
                                                    <span key={p.name} className="diario__phase-chip">
                                                        {p.name}: {formatDuration(p.seconds)}
                                                    </span>
                                                ))}
                                            </div>
                                        )}
                                    </div>

                                    {/* Totales */}
                                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.15rem', flexShrink: 0 }}>
                                        <span className="diario__group-duration">{formatDuration(totalGroupSeconds)}</span>
                                        {!isGeneric && totalPiezas > 0 && (
                                            <span className="diario__active-chip">
                                                {totalPiezas} pzs
                                            </span>
                                        )}
                                    </div>
                                </div>

                                {/* Sesiones individuales */}
                                {isGroupExpanded && groupSessions.map((session, idx) => {
                                    const start = new Date(session.start_time);
                                    const end = session.end_time ? new Date(session.end_time) : null;
                                    const durationInSeconds = end ? Math.floor((end.getTime() - start.getTime()) / 1000) : 0;
                                    const isEditing = editSessionId === session.id;
                                    const canEdit = isOwnDiary && !!session.end_time;

                                    return (
                                        <div key={session.id ?? idx} className="ordenes-timer__diary-item diario__session-item" style={{ flexDirection: 'column', alignItems: 'stretch', gap: '0.5rem', borderRadius: 0 }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                <div className="diary-item-main" style={{ flex: 1 }}>
                                                    <span className="diary-item-time">
                                                        {start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })} - {end ? end.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '...'}
                                                    </span>
                                                    <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap', marginTop: '0.15rem' }}>
                                                        {session.work_order_department?.department?.name && (
                                                            <span className="diario__session-time-chip">
                                                                {session.work_order_department.department.name}
                                                            </span>
                                                        )}
                                                        {session.work_order_phase?.phase?.name && (
                                                            <span className="diario__session-piezas-chip">
                                                                {session.work_order_phase.phase.name}
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                                <div className="diary-item-stats">
                                                    {!isGeneric && session.piezas > 0 && <span className="diary-item-piezas">{session.piezas} pzs</span>}
                                                    {end
                                                        ? <span className="diary-item-duration">{formatDuration(durationInSeconds)}</span>
                                                        : <span className="diario__session-active-badge">En curso</span>
                                                    }
                                                </div>
                                                {canEdit && !isEditing && (
                                                    <button
                                                        onClick={() => openEdit(session)}
                                                        className="diario__edit-btn"
                                                    >
                                                        <EditIcon size={13} /> Editar
                                                    </button>
                                                )}
                                            </div>

                                            {isEditing && (
                                                <div className="diario__edit-form">
                                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.6rem' }}>
                                                        <label className="diario__edit-label">
                                                            Hora inicio
                                                            <input type="time" step="1" value={editHoraInicio} onChange={e => setEditHoraInicio(e.target.value)} className="diario__edit-input" />
                                                        </label>
                                                        <label className="diario__edit-label">
                                                            Hora fin
                                                            <input type="time" step="1" value={editHoraFin} onChange={e => setEditHoraFin(e.target.value)} className="diario__edit-input" />
                                                        </label>
                                                    </div>
                                                    {!isGeneric && (
                                                        <label className="diario__edit-label">
                                                            Piezas
                                                            <input type="number" min="0" value={editPiezas} onChange={e => setEditPiezas(e.target.value)} className="diario__edit-input" />
                                                        </label>
                                                    )}
                                                    <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                                                        <button onClick={handleEditSubmit} disabled={editLoading} style={{ padding: '0.4rem 1rem', background: 'var(--primary)', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 600, cursor: 'pointer', fontSize: '0.85rem' }}>
                                                            {editLoading ? "Guardando..." : "Guardar"}
                                                        </button>
                                                        <button onClick={closeEdit} disabled={editLoading} className="diario__edit-btn" style={{ padding: '0.4rem 0.8rem' }}>
                                                            Cancelar
                                                        </button>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        );
                    });
                })()}
            </div>
        </div>
      )}
    </div>
  );
};
