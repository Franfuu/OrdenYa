import React, { useState, useEffect, useRef } from 'react';
import { workOrderService } from '../services/workOrderService';
import { formatDuration } from '../utils/statusHelpers';
import type { WorkSession } from '../types/WorkOrder';
import { sileo } from 'sileo';
import { CheckIcon, PlayIcon, PauseIcon, StopIcon } from './Icons';

interface TimerPanelProps {
  workOrderId: number;
  activeSession: WorkSession | null;
  onStart: (session: WorkSession) => void;
  onPause: (session: WorkSession | null) => void;
  onStop: (session: WorkSession) => void;
}

export function TimerPanel({ workOrderId, activeSession, onStart, onPause, onStop }: TimerPanelProps) {
  const [elapsed, setElapsed] = useState(0);
  const [isRunning, setIsRunning] = useState(!!activeSession?.start_time && !activeSession?.end_time);
  const [piezas, setPiezas] = useState('0');
  const [loading, setLoading] = useState(false);
  const [showPiezasInput, setShowPiezasInput] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Update elapsed time when session changes
  useEffect(() => {
    if (activeSession?.start_time && !activeSession?.end_time) {
      const start = new Date(activeSession.start_time).getTime();
      const now = Date.now();
      setElapsed(Math.floor((now - start) / 1000));
      setIsRunning(true);
    } else if (activeSession?.end_time && activeSession?.start_time) {
      const start = new Date(activeSession.start_time).getTime();
      const end = new Date(activeSession.end_time).getTime();
      setElapsed(Math.floor((end - start) / 1000));
      setIsRunning(false);
    } else {
      setElapsed(0);
      setIsRunning(false);
    }
  }, [activeSession]);

  // Timer interval
  useEffect(() => {
    if (!isRunning) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      return;
    }

    intervalRef.current = setInterval(() => {
      setElapsed(prev => prev + 1);
    }, 1000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isRunning]);

  const handleStart = async () => {
    setLoading(true);
    try {
      const result = await workOrderService.startSession(workOrderId);
      onStart(result.session);
      sileo.success({ title: 'Sesión iniciada' });
    } catch (error: any) {
      sileo.error({ title: 'Error al iniciar sesión', description: error.response?.data?.message });
    } finally {
      setLoading(false);
    }
  };

  const handlePause = async () => {
    setLoading(true);
    try {
      const result = await workOrderService.pauseSession(workOrderId, 0);
      onPause(result.session);
      sileo.success({ title: 'Sesión pausada' });
    } catch (error: any) {
      sileo.error({ title: 'Error al pausar sesión', description: error.response?.data?.message });
    } finally {
      setLoading(false);
    }
  };

  const handleStop = async () => {
    setLoading(true);
    try {
      const piezasNum = parseInt(piezas, 10) || 0;
      const result = await workOrderService.stopSession(workOrderId, piezasNum);
      onStop(result.session);
      setPiezas('0');
      setShowPiezasInput(false);
      sileo.success({ title: 'Sesión completada', description: `${piezasNum} piezas registradas` });
    } catch (error: any) {
      sileo.error({ title: 'Error al detener sesión', description: error.response?.data?.message });
    } finally {
      setLoading(false);
    }
  };

  const handleStopClick = () => {
    if (!showPiezasInput) {
      setShowPiezasInput(true);
    } else {
      handleStop();
    }
  };

  return (
    <div className="bg-white p-6 rounded-lg shadow-md border border-gray-200">
      <h3 className="text-lg font-semibold text-gray-800 mb-4">Temporizador</h3>

      {/* Timer Display */}
      <div className="mb-6 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border border-blue-200">
        <div className="text-center">
          <p className="text-sm text-gray-600 mb-2">Tiempo transcurrido</p>
          <p className="text-5xl font-mono font-bold text-blue-600">{formatDuration(elapsed)}</p>
          {activeSession?.piezas !== undefined && (
            <p className="text-sm text-gray-600 mt-2">
              {activeSession.piezas} piezas completadas
            </p>
          )}
        </div>
      </div>

      {/* Session Status */}
      {activeSession && (
        <div className="mb-4 p-3 bg-blue-50 rounded text-sm text-blue-700 border border-blue-200">
          {activeSession.end_time ? (
            <p><CheckIcon size={13} /> Sesión completada</p>
          ) : (
            <p>Sesión en progreso</p>
          )}
        </div>
      )}

      {/* Buttons */}
      <div className="flex flex-col gap-2 mb-4">
        {!isRunning && !activeSession ? (
          <button
            onClick={handleStart}
            disabled={loading}
            className="w-full bg-green-500 hover:bg-green-600 disabled:bg-gray-400 text-white font-semibold py-3 px-4 rounded-lg transition flex items-center justify-center gap-2"
          >
            {loading ? 'Iniciando...' : <><PlayIcon size={18} color="white" /> Iniciar</>}
          </button>
        ) : isRunning ? (
          <>
            <button
              onClick={handlePause}
              disabled={loading}
              className="w-full bg-yellow-500 hover:bg-yellow-600 disabled:bg-gray-400 text-white font-semibold py-3 px-4 rounded-lg transition flex items-center justify-center gap-2"
            >
              {loading ? 'Pausando...' : <><PauseIcon size={18} color="white" /> Pausar</>}
            </button>
            <button
              onClick={handleStopClick}
              disabled={loading}
              className="w-full bg-red-500 hover:bg-red-600 disabled:bg-gray-400 text-white font-semibold py-3 px-4 rounded-lg transition flex items-center justify-center gap-2"
            >
              {loading ? 'Deteniendo...' : <><StopIcon size={18} color="white" /> Detener</>}
            </button>
          </>
        ) : null}
      </div>

      {/* Pieces Input (shown when stopping) */}
      {showPiezasInput && isRunning === false && activeSession?.end_time === null && (
        <div className="mb-4 p-4 bg-yellow-50 rounded-lg border border-yellow-200">
          <label htmlFor="timer-piezas" className="block text-sm font-semibold text-gray-700 mb-2">
            Piezas completadas
          </label>
          <div className="flex gap-2">
            <input
              id="timer-piezas"
              type="number"
              min="0"
              value={piezas}
              onChange={e => setPiezas(e.target.value)}
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-500"
              placeholder="0"
            />
            <button
              onClick={handleStop}
              disabled={loading}
              className="bg-yellow-600 hover:bg-yellow-700 disabled:bg-gray-400 text-white font-semibold py-2 px-4 rounded-lg transition"
            >
              {loading ? '...' : 'OK'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
