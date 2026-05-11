import React from 'react';

interface SpinnerProps {
  message?: string;
  size?: 'sm' | 'md' | 'lg';
}

export const Spinner: React.FC<SpinnerProps> = ({
  message = 'Cargando...',
  size = 'md',
}) => {
  return (
    <div className={`spinner-wrapper spinner-${size}`}>
      <div className="spinner-ring">
        <div /><div /><div /><div />
      </div>
      {message && <p className="spinner-message">{message}</p>}
    </div>
  );
};
