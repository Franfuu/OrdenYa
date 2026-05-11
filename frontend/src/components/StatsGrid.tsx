import React from 'react';

export interface StatItem {
  label: string;
  value: string | number;
  colorClass?: string;
}

interface StatsGridProps {
  stats: StatItem[];
}

export const StatsGrid: React.FC<StatsGridProps> = ({ stats }) => {
  return (
    <div className="stats-grid">
      {stats.map((stat) => (
        <div key={stat.label} className="glass-card stat-card">
          <h4>{stat.label}</h4>
          <p className={`stat-value ${stat.colorClass || ''}`}>{stat.value}</p>
        </div>
      ))}
    </div>
  );
};
