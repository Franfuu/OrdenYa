import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'sileo';
import 'sileo/styles.css';
import { AuthProvider } from './auth/authContext';
import { PrivateRoute } from './routing/PrivateRoute';
import { FloatingTimer } from './components/FloatingTimer';
import { MobileNavProvider } from './context/MobileNavContext';
import { ConfirmProvider } from './components/ConfirmDialog';

// Public Pages
import LandingPage from './pages/LandingPage';
import { Login } from './pages/Login';
import { NotFound } from './pages/NotFound';

// Role Dashboards
import { AdminDashboard } from './pages/adminView/AdminDashboard';
import { SupervisorDashboard } from './pages/supervisorView/SupervisorDashboard';
import { TrabajadorDashboard } from './pages/trabajadorView/TrabajadorDashboard';

const App: React.FC = () => {
  return (
    <AuthProvider>
      <ConfirmProvider>
        <Toaster
          position="top-center"
          theme="dark"
          offset={12}
          options={{
            roundness: 999,
            duration: 4000,
            autopilot: false,
          }}
        />
        <BrowserRouter>
        <MobileNavProvider>
          <FloatingTimer />
          <Routes>
            {/* Rutas Públicas */}
            <Route path="/" element={<LandingPage />} />
            <Route path="/login" element={<Login />} />

            {/* Rutas Privadas por Rol */}
            <Route
              path="/admin/*"
              element={
                <PrivateRoute allowedRoles={['admin']}>
                  <AdminDashboard />
                </PrivateRoute>
              }
            />
            <Route
              path="/supervisor/*"
              element={
                <PrivateRoute allowedRoles={['supervisor']}>
                  <SupervisorDashboard />
                </PrivateRoute>
              }
            />
            <Route
              path="/trabajador/*"
              element={
                <PrivateRoute allowedRoles={['trabajador']}>
                  <TrabajadorDashboard />
                </PrivateRoute>
              }
            />

            {/* Ruta 404 */}
            <Route path="/404" element={<NotFound />} />
            <Route path="*" element={<Navigate to="/404" replace />} />
          </Routes>
        </MobileNavProvider>
        </BrowserRouter>
      </ConfirmProvider>
    </AuthProvider>
  );
};

export default App;
