import React from "react";
import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import { Sidebar } from "../../components/layout/Sidebar";
import { Topbar } from "../../components/layout/Topbar";
import { Profile } from "../shared/Profile";
import { DiarioTrabajador } from "../shared/DiarioTrabajador";
import { TrabajadorWorkOrdersList } from "./TrabajadorWorkOrdersList";
import { TrabajadorWorkOrderDetail } from "./TrabajadorWorkOrderDetail";
import { TrabajadorOrdenes } from "./TrabajadorOrdenes";
import { MyJobsIcon, CompletedIcon } from "../../components/Icons";
import "../adminView/AdminDashboard.css";
import "./TrabajadorDashboard.css";

export const TrabajadorDashboard: React.FC = () => {
  const location = useLocation();
  const currentPath = location.pathname;

  let title = "Órdenes";
  if (currentPath.includes("mis-trabajos")) title = "Mis Trabajos";
  if (currentPath.includes("diario")) title = "Mi Diario";
  if (currentPath.includes("perfil")) title = "Mi Perfil";

  const trabajadorLinks = [
    { path: "/trabajador/ordenes",       label: "Órdenes",       icon: <MyJobsIcon size={18} /> },
    { path: "/trabajador/mis-trabajos",  label: "Mis Trabajos",  icon: <MyJobsIcon size={18} /> },
    { path: "/trabajador/diario",        label: "Mi Diario",     icon: <CompletedIcon size={18} /> },
  ];

  return (
    <div className="dashboard-layout">
      <Sidebar links={trabajadorLinks} />

      <div className="dashboard-main">
        <Topbar title={title} />

        <div className="dashboard-content">
          <Routes>
            <Route path="ordenes"       element={<TrabajadorOrdenes />} />
            <Route path="mis-trabajos"  element={<TrabajadorWorkOrdersList />} />
            <Route path="diario"        element={<DiarioTrabajador />} />
            <Route path="ordenes/:id"   element={<TrabajadorWorkOrderDetail />} />
            <Route path="perfil"        element={<Profile />} />
            <Route path="/"             element={<Navigate to="ordenes" replace />} />
          </Routes>
        </div>
      </div>
    </div>
  );
};
