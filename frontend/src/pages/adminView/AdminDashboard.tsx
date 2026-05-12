import React from "react";
import { Routes, Route, Navigate, useLocation, useParams } from "react-router-dom";

const RedirectToVer: React.FC<{ base: string }> = ({ base }) => {
  const { id } = useParams<{ id: string }>();
  return <Navigate to={`${base}/ver/${id}`} replace />;
};
import { UsersList } from "./UsersList";
import { UserForm } from "./UserForm";
import { UserDetail } from "./UserDetail";
import { WorkOrdersList } from "./WorkOrdersList";
import { WorkOrderForm } from "./WorkOrderForm";
import { WorkOrderDetail } from "./WorkOrderDetail";
import { Sidebar } from "../../components/layout/Sidebar";
import { Topbar } from "../../components/layout/Topbar";
import { Profile } from "../shared/Profile";
import { KPIPanel } from "../shared/KPIPanel";
import { PiezasList } from "../shared/PiezasList";
import { PiezaForm } from "../shared/PiezaForm";
import { WorkOrderIcon, UsersIcon, AddIcon, DashboardIcon } from "../../components/Icons";
import "./AdminDashboard.css";

export const AdminDashboard: React.FC = () => {
  const location = useLocation();
  const p = location.pathname;

  let title = "Panel de Control";
  if      (p.includes("inicio"))             title = "Panel de Control";
  else if (p.includes("usuarios/nuevo"))     title = "Crear Usuario";
  else if (p.includes("usuarios/editar"))    title = "Editar Usuario";
  else if (p.includes("usuarios/ver"))       title = "Detalle de Usuario";
  else if (p.includes("usuarios"))           title = "Gestión de Usuarios";
  else if (p.includes("ordenes/nuevo"))      title = "Crear Orden de Trabajo";
  else if (p.includes("ordenes/editar"))     title = "Editar Orden de Trabajo";
  else if (p.includes("ordenes/ver"))        title = "Detalle de Orden";
  else if (p.includes("ordenes"))            title = "Órdenes de Trabajo";
  else if (p.includes("piezas/nueva"))       title = "Crear Pieza";
  else if (p.includes("piezas/editar"))      title = "Editar Pieza";
  else if (p.includes("piezas"))             title = "Catálogo de Piezas";
  else if (p.includes("perfil"))             title = "Mi Perfil";

  const adminLinks = [
    { path: "/admin/inicio",          label: "Panel de Control",     icon: <DashboardIcon size={18} /> },
    { path: "/admin/ordenes/lista",   label: "Todas las Órdenes",    icon: <WorkOrderIcon size={18} /> },
    { path: "/admin/ordenes/nuevo",   label: "Crear Orden",          icon: <AddIcon size={18} /> },
    { path: "/admin/piezas/lista",    label: "Piezas",               icon: <WorkOrderIcon size={18} /> },
    { path: "/admin/piezas/nueva",    label: "Crear Pieza",          icon: <AddIcon size={18} /> },
    { path: "/admin/usuarios/lista",  label: "Gestión de Usuarios",  icon: <UsersIcon size={18} /> },
    { path: "/admin/usuarios/nuevo",  label: "Crear Usuario",        icon: <AddIcon size={18} /> },
  ];

  return (
    <div className="dashboard-layout">
      <Sidebar links={adminLinks} />

      <div className="dashboard-main">
        <Topbar title={title} />

        <div className="dashboard-content">
          <Routes>
            <Route path="inicio"                element={<KPIPanel showUsers />} />

            <Route path="usuarios/lista"        element={<UsersList />} />
            <Route path="usuarios/nuevo"        element={<UserForm />} />
            <Route path="usuarios/editar/:id"   element={<UserForm />} />
            <Route path="usuarios/ver/:id"      element={<UserDetail />} />

            <Route path="ordenes/lista"         element={<WorkOrdersList />} />
            <Route path="ordenes/nuevo"         element={<WorkOrderForm />} />
            <Route path="ordenes/editar/:id"    element={<WorkOrderForm />} />
            <Route path="ordenes/ver/:id"       element={<WorkOrderDetail />} />
            <Route path="ordenes/:id"           element={<RedirectToVer base="/admin/ordenes" />} />

            <Route path="piezas/lista"          element={<PiezasList />} />
            <Route path="piezas/nueva"          element={<PiezaForm />} />
            <Route path="piezas/nuevo"          element={<Navigate to="/admin/piezas/nueva" replace />} />
            <Route path="piezas/editar/:id"     element={<PiezaForm />} />

            <Route path="perfil"                element={<Profile />} />

            <Route index                        element={<Navigate to="/admin/inicio" replace />} />
          </Routes>
        </div>
      </div>
    </div>
  );
};
