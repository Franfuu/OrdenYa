import React from 'react';
import type { ReportPeriod } from '../services/reportService';

interface InformeModalProps {
  onSelect: (period: ReportPeriod) => void;
  onClose: () => void;
}

export const InformeModal: React.FC<InformeModalProps> = ({ onSelect, onClose }) => {
  return (
    <div
      role="button"
      tabIndex={0}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50,
      }}
      onClick={onClose}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onClose(); }}
    >
      <div
        style={{
          background: '#fff', borderRadius: '12px', padding: '2rem',
          minWidth: '320px', boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
          display: 'flex', flexDirection: 'column', gap: '1rem',
        }}
        onClick={e => e.stopPropagation()}
      >
        <h2 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 600, color: '#1e293b' }}>
          Selecciona el periodo
        </h2>
        <p style={{ margin: 0, fontSize: '0.9rem', color: '#64748b' }}>
          ¿Qué rango de tiempo quieres analizar?
        </p>
        <button
          onClick={() => onSelect('week')}
          style={{
            padding: '0.9rem 1.5rem', background: '#3b82f6', color: '#fff',
            border: 'none', borderRadius: '8px', fontSize: '1rem',
            fontWeight: 600, cursor: 'pointer', transition: 'background 0.2s',
          }}
          onMouseOver={e => (e.currentTarget.style.background = '#2563eb')}
          onMouseOut={e => (e.currentTarget.style.background = '#3b82f6')}
        >
          📅 Esta semana
        </button>
        <button
          onClick={() => onSelect('month')}
          style={{
            padding: '0.9rem 1.5rem', background: '#8b5cf6', color: '#fff',
            border: 'none', borderRadius: '8px', fontSize: '1rem',
            fontWeight: 600, cursor: 'pointer', transition: 'background 0.2s',
          }}
          onMouseOver={e => (e.currentTarget.style.background = '#7c3aed')}
          onMouseOut={e => (e.currentTarget.style.background = '#8b5cf6')}
        >
          🗓️ Este mes
        </button>
        <button
          onClick={onClose}
          style={{
            padding: '0.5rem', background: 'transparent', color: '#94a3b8',
            border: 'none', fontSize: '0.85rem', cursor: 'pointer',
          }}
        >
          Cancelar
        </button>
      </div>
    </div>
  );
};
