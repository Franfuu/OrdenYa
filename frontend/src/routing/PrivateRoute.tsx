import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../auth/authContext';

interface PrivateRouteProps {
  children: React.ReactNode;
  allowedRoles?: string[];
}

export const PrivateRoute: React.FC<PrivateRouteProps> = ({ children, allowedRoles }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return null;
  }

  if (!user) {
    // Si no está autenticado, redirige al login
    return <Navigate to="/login" replace />;
  }

  // Si tiene un rol que no está en la lista de permitidos, redirigirlo (a 404 o su portal)
  const userRole = String((user as any).role || "").toLowerCase().trim();
  const lowerAllowedRoles = allowedRoles?.map(r => r.toLowerCase().trim());

  if (lowerAllowedRoles && !lowerAllowedRoles.includes(userRole)) {
     if (userRole === 'admin') return <Navigate to="/admin" replace />;
     if (userRole === 'supervisor') return <Navigate to="/supervisor" replace />;
     return <Navigate to="/trabajador" replace />;
  }

  return <>{children}</>;
};
