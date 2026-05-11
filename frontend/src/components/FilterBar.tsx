import React from 'react';

export interface FilterOption {
  value: string;
  label: string;
}

interface FilterBarProps {
  searchTerm: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder?: string;

  filterValue?: string;
  onFilterChange?: (value: string) => void;
  filterOptions?: FilterOption[];
}

export const FilterBar: React.FC<FilterBarProps> = ({
  searchTerm,
  onSearchChange,
  searchPlaceholder = "Buscar...",
  filterValue,
  onFilterChange,
  filterOptions,
}) => {
  return (
    <div className="glass-card filter-bar">
      <input
        type="text"
        placeholder={searchPlaceholder}
        value={searchTerm}
        onChange={(e) => onSearchChange(e.target.value)}
        className="input-base search-input"
      />
      {filterOptions && filterOptions.length > 0 && onFilterChange && (
        <select
          value={filterValue ?? ""}
          onChange={(e) => onFilterChange(e.target.value)}
          className="input-base status-filter"
        >
          {filterOptions.map(opt => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      )}
    </div>
  );
};
