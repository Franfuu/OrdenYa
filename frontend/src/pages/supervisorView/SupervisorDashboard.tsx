import React from "react";
import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import { Sidebar } from "../../components/layout/Sidebar";
import { Topbar } from "../../components/layout/Topbar";
import { Profile } from "../shared/Profile";
import { KPIPanel } from "../shared/KPIPanel";
import { PiezasList } from "../shared/PiezasList";
import { WorkOrdersList } from "../adminView/WorkOrdersList";
import { WorkOrderDetail } from "../adminView/WorkOrderDetail";
import { WorkOrderIcon, DashboardIcon } from "../../components/Icons";
import "../adminView/AdminDashboard.css";

export const SupervisorDashboard: React.FC = () => {
  const location = useLocation();
  const p = location.pathname;

  let title = "Panel de Control";
  if      (p.includes("inicio"))         title = "Panel de Control";
  else if (p.includes("ordenes/ver"))    title = "Detalle de Orden";
  else if (p.includes("ordenes"))        title = "Todas las Órdenes";
  else if (p.includes("piezas"))         title = "Catálogo de Piezas";
  else if (p.includes("perfil"))         title = "Mi Perfil";

  const supervisorLinks = [
    { path: "/supervisor/inicio",        label: "Panel de Control",   icon: <DashboardIcon size={18} /> },
    { path: "/supervisor/ordenes/lista", label: "Todas las Órdenes",  icon: <WorkOrderIcon size={18} /> },
    { path: "/supervisor/piezas/lista",  label: "Piezas",             icon: <WorkOrderIcon size={18} /> },
  ];

  return (
    <div className="dashboard-layout">
      <Sidebar links={supervisorLinks} />
      <div className="dashboard-main">
        <Topbar title={title} />
        <div className="dashboard-content">
          <Routes>
            <Route path="inicio"             element={<KPIPanel showUsers={false} />} />
            <Route path="ordenes/lista"      element={<WorkOrdersList />} />
            <Route path="ordenes/ver/:id"    element={<WorkOrderDetail />} />
            <Route path="piezas/lista"       element={<PiezasList />} />
            <Route path="perfil"             element={<Profile />} />
            <Route index                     element={<Navigate to="/supervisor/inicio" replace />} />
          </Routes>
        </div>
      </div>
    </div>
  );
};
