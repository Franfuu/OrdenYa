import React, { useState, useEffect, useMemo } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../../auth/authContext";
import { storageUrl } from "../../utils/storageUrl";
import { sileo } from "sileo";
import { workOrderService } from "../../services/workOrderService";
import { Spinner } from "../../components/Spinner";
import { StatsGrid } from "../../components/StatsGrid";
import { FilterBar } from "../../components/FilterBar";
import type { WorkOrder } from "../../types/WorkOrder";
import { isOrderFinalizada } from "../../types/WorkOrder";
import { EditIcon, DeleteIcon, AddIcon, ImageIcon } from "../../components/Icons";
import { http } from "../../services/http";
import { QRCodeSVG } from "qrcode.react";
import { useConfirm } from "../../components/ConfirmDialog";
import "./WorkOrderFormBrand.css";
import { getErrorMessage } from "../../utils/errorHelper";
import { ImageModal } from "../../components/ImageModal";
import { useWorkOrdersChannel } from "../../hooks/useWorkOrdersChannel";
import "./WorkOrdersManager.css";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

const DEPT_COLORS: Record<string, string> = {
  taller: "#534AB7", instalacion: "#1D9E75",
};
const DEPT_LABELS: Record<string, string> = {
  taller: "Taller", instalacion: "Instalación",
};

const PAGE_SIZE = 15;
type SortKey = "codigo_orden" | "nombre_orden" | "fecha_fin" | null;

function getDeadlineBadge(fechaFin: string | null | undefined) {
  if (!fechaFin) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const deadline = new Date(fechaFin);
  deadline.setHours(0, 0, 0, 0);
  const diffDays = Math.ceil((deadline.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  const dateStr = deadline.toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit", year: "2-digit" });
  if (diffDays < 0)  return { label: dateStr, cls: "deadline--overdue" };
  if (diffDays <= 7) return { label: dateStr, cls: "deadline--soon" };
  return { label: dateStr, cls: "deadline--ok" };
}

function SortIndicator({ col, sortKey, sortDir }: { col: SortKey; sortKey: SortKey; sortDir: "asc" | "desc" }) {
  if (sortKey !== col) return <span className="sort-icon sort-icon--neutral">↕</span>;
  return <span className="sort-icon">{sortDir === "asc" ? "↑" : "↓"}</span>;
}

export const WorkOrdersList: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { key: locationKey } = location;
  const { user } = useAuth();
  const role = (user as any)?.role;
  const basePath = role === "supervisor" ? "/supervisor" : "/admin";
  // Supervisor: puede crear órdenes pero NO editar/eliminar/duplicar existentes
  const isReadOnly = role !== "admin" && role !== "supervisor";
  const canModifyExisting = role === "admin" || role === "supervisor";
  const confirm = useConfirm();

  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState("Todos");
  const [selectedImage, setSelectedImage] = useState<{ src: string; alt: string } | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [qrPreview, setQrPreview] = useState<{ value: string; codigo: string; nombre: string } | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [sortKey, setSortKey] = useState<SortKey>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  const fetchOrders = async () => {
    try {
      setLoading(true);
      const res = await workOrderService.getAll();
      setWorkOrders(Array.isArray(res) ? res : ((res as any).data || []));
      setError(null);
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || "Error al obtener órdenes");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchOrders(); }, [locationKey]);

  // ESC closes QR preview modal
  useEffect(() => {
    if (!qrPreview) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setQrPreview(null); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [qrPreview]);

  // Live: refetch al recibir cambios por WebSocket
  useWorkOrdersChannel(() => { fetchOrders(); });
  useEffect(() => { setCurrentPage(1); }, [searchTerm, filterStatus, sortKey]);

  const handleDelete = async (e: React.MouseEvent, id: number) => {
    e.stopPropagation();
    if (!await confirm({ message: "¿Eliminar esta orden? Esta acción no se puede deshacer.", danger: true, confirmText: "Eliminar" })) return;
    try {
      await workOrderService.delete(id);
      sileo.success({ title: "Orden eliminada" });
      fetchOrders();
    } catch (err: any) {
      sileo.error({ title: "Error al eliminar", description: getErrorMessage(err) });
    }
  };

  const toggleSelect = (id: number) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const handleDuplicate = async (e: React.MouseEvent, id: number) => {
    e.stopPropagation();
    try {
      await http.post(`/work-orders/${id}/duplicate`);
      sileo.success({ title: "Orden duplicada" });
      fetchOrders();
    } catch (err: any) {
      sileo.error({ title: "Error", description: getErrorMessage(err) });
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    if (!await confirm({ title: "Eliminar en lote", message: `Vas a eliminar ${selectedIds.size} órdenes. Esta acción no se puede deshacer.`, danger: true, confirmText: `Eliminar ${selectedIds.size}` })) return;
    try {
      await http.post("/work-orders/bulk", { action: "delete", ids: Array.from(selectedIds) });
      sileo.success({ title: `${selectedIds.size} órdenes eliminadas` });
      setSelectedIds(new Set());
      fetchOrders();
    } catch (err: any) {
      sileo.error({ title: "Error", description: getErrorMessage(err) });
    }
  };

  const handleBulkPrioridad = async (prioridad: string) => {
    if (selectedIds.size === 0) return;
    try {
      await http.post("/work-orders/bulk", { action: "set_prioridad", ids: Array.from(selectedIds), prioridad });
      sileo.success({ title: `Prioridad actualizada en ${selectedIds.size} órdenes` });
      setSelectedIds(new Set());
      fetchOrders();
    } catch (err: any) {
      sileo.error({ title: "Error", description: getErrorMessage(err) });
    }
  };

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDir("asc"); }
  };

  const filteredOrders = useMemo(() => {
    let result = workOrders.filter(o => {
      const finalizada = isOrderFinalizada(o);
      const matchStatus =
        filterStatus === "Todos" ||
        (filterStatus === "En curso" && !finalizada) ||
        (filterStatus === "Finalizada" && finalizada) ||
        (filterStatus !== "Todos" && filterStatus !== "En curso" && filterStatus !== "Finalizada" &&
          (o.departments ?? []).some(d => d.department?.slug === filterStatus));

      const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
      const q = norm(searchTerm);
      const workers = (o.departments ?? []).flatMap(d => (d.workers ?? []).map(w => w.user?.name ?? ""));
      const matchSearch = !q || [
        o.codigo_orden, o.nombre_orden, o.codigo_cliente?.toString(),
        o.nombre_cliente, (o as any).pieza?.codigo, (o as any).pieza?.nombre, ...workers,
      ].some(v => v && norm(v).includes(q));

      return matchStatus && matchSearch;
    });

    if (sortKey) {
      result = result.toSorted((a, b) => {
        const vals: Record<string, [string, string]> = {
          codigo_orden: [a.codigo_orden ?? "", b.codigo_orden ?? ""],
          nombre_orden: [a.nombre_orden ?? "", b.nombre_orden ?? ""],
          fecha_fin:    [a.fecha_fin ?? "9999", b.fecha_fin ?? "9999"],
        };
        const [va, vb] = vals[sortKey];
        const cmp = va.localeCompare(vb, "es", { numeric: true });
        return sortDir === "asc" ? cmp : -cmp;
      });
    }

    return result;
  }, [workOrders, searchTerm, filterStatus, sortKey, sortDir]);

  const stats = useMemo(() => ({
    total: workOrders.length,
    enCurso: workOrders.filter(o => !isOrderFinalizada(o)).length,
    finalizadas: workOrders.filter(o => isOrderFinalizada(o)).length,
  }), [workOrders]);

  const totalPages = Math.max(1, Math.ceil(filteredOrders.length / PAGE_SIZE));
  const paginated = filteredOrders.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const pageNumbers = Array.from({ length: totalPages }, (_, i) => i + 1)
    .filter(p => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 1)
    .reduce<(number | "...")[]>((acc, p, i, arr) => {
      if (i > 0 && (p as number) - (arr[i - 1] as number) > 1) acc.push("...");
      acc.push(p);
      return acc;
    }, []);

  return (
    <div className="animate-fade-in work-orders-manager">
      <div className="work-orders-manager__page-header">
        <div>
          <span className="wo-form__title-eyebrow">Catálogo</span>
          <h2 className="wo-form__title" style={{ margin: 0 }}>Órdenes de Trabajo</h2>
        </div>
        <div style={{ display: "flex", gap: "0.5rem" }}>
          <button className="btn-outline" onClick={() => {
            // ─── CSV PROFESIONAL — OrdenYa ─────────────────────────────────
            const SEP = ";"; // Excel ES por defecto usa ';'
            const esc = (v: any) => {
              const s = v === null || v === undefined ? "" : String(v);
              return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
            };
            const row = (cells: any[]) => cells.map(esc).join(SEP);
            const sectionRule = "──────────────────────────────────────────────────";

            const now = new Date();
            const fmtDate = (s?: string | null) =>
              s ? new Date(s).toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit", year: "numeric" }) : "";
            const fmtNum = (n: number, digits = 0) =>
              n.toLocaleString("es-ES", { minimumFractionDigits: digits, maximumFractionDigits: digits });
            const fmtPct = (n: number) => `${n.toLocaleString("es-ES", { maximumFractionDigits: 1 })}%`;
            const fmtHours = (sec: number) => {
              const h = Math.floor(sec / 3600);
              const m = Math.floor((sec % 3600) / 60);
              return `${h}h ${m.toString().padStart(2, "0")}m`;
            };
            const daysUntil = (s?: string | null) => {
              if (!s) return null;
              const today = new Date(); today.setHours(0,0,0,0);
              const d = new Date(s); d.setHours(0,0,0,0);
              return Math.ceil((d.getTime() - today.getTime()) / 86400000);
            };

            const PRIO_LABEL: Record<string, string> = { alta: "Alta", media: "Media", baja: "Baja" };

            // ── Agregados por orden ──
            const enriched = workOrders.map(o => {
              const depts = o.departments ?? [];
              const workersSet = new Set<string>();
              let piezasAsignadas = 0, piezasCompletadas = 0;
              depts.forEach((d: any) => {
                (d.workers ?? []).forEach((w: any) => {
                  if (w.user?.name) workersSet.add(w.user.name);
                  piezasAsignadas   += (w.piezas_asignadas ?? 0);
                  piezasCompletadas += (w.piezas_completadas ?? 0);
                });
              });
              const sessions = (o as any).work_sessions ?? [];
              const totalSec = sessions.reduce((s: number, ws: any) => {
                if (!ws.end_time) return s;
                return s + Math.max(0, Math.floor((new Date(ws.end_time).getTime() - new Date(ws.start_time).getTime()) / 1000));
              }, 0);
              const progress = piezasAsignadas > 0
                ? Math.min(100, (piezasCompletadas / piezasAsignadas) * 100)
                : (isOrderFinalizada(o) ? 100 : 0);
              return {
                o, depts,
                deptNames: depts.flatMap((d: any) => d.department?.name ? [d.department.name] : []).join(" + "),
                workers: Array.from(workersSet).sort((a, b) => a.localeCompare(b, "es")).join(", "),
                piezasAsignadas, piezasCompletadas, progress,
                sessions: sessions.length,
                totalSec,
                diasRestantes: daysUntil(o.fecha_fin),
              };
            });

            // ── Estadísticas globales ──
            const finalizadas = enriched.filter(e => isOrderFinalizada(e.o)).length;
            const enCurso = enriched.length - finalizadas;
            const totPiezasAsig = enriched.reduce((s, e) => s + e.piezasAsignadas, 0);
            const totPiezasHechas = enriched.reduce((s, e) => s + e.piezasCompletadas, 0);
            const totSec = enriched.reduce((s, e) => s + e.totalSec, 0);
            const progresoGlobal = totPiezasAsig > 0 ? (totPiezasHechas / totPiezasAsig) * 100 : 0;

            // Por departamento
            const byDept: Record<string, { ordenes: number; asignadas: number; completadas: number; segundos: number }> = {};
            enriched.forEach(e => {
              e.depts.forEach((d: any) => {
                const k = d.department?.name ?? "—";
                byDept[k] ??= { ordenes: 0, asignadas: 0, completadas: 0, segundos: 0 };
                byDept[k].ordenes++;
                (d.workers ?? []).forEach((w: any) => {
                  byDept[k].asignadas   += (w.piezas_asignadas ?? 0);
                  byDept[k].completadas += (w.piezas_completadas ?? 0);
                });
              });
            });

            // Por prioridad
            const byPrio: Record<string, number> = { alta: 0, media: 0, baja: 0, "—": 0 };
            enriched.forEach(e => {
              const p = (e.o as any).prioridad ?? "—";
              byPrio[p] = (byPrio[p] ?? 0) + 1;
            });

            // ── Construir CSV ──
            const lines: string[] = [];

            // Cabecera reporte
            lines.push(row(["OrdenYa — Informe de Órdenes de Trabajo"]));
            lines.push(row([sectionRule]));
            lines.push(row(["Generado", now.toLocaleString("es-ES", { dateStyle: "full", timeStyle: "short" })]));
            lines.push(row(["Origen", typeof window !== "undefined" ? window.location.host : ""]));
            lines.push(row(["Total registros", enriched.length]));
            lines.push("");

            // Resumen ejecutivo
            lines.push(row(["RESUMEN EJECUTIVO"]));
            lines.push(row([sectionRule]));
            lines.push(row(["Métrica", "Valor"]));
            lines.push(row(["Total de órdenes", fmtNum(enriched.length)]));
            lines.push(row(["En curso", fmtNum(enCurso)]));
            lines.push(row(["Finalizadas", fmtNum(finalizadas)]));
            lines.push(row(["% Finalizadas", enriched.length > 0 ? fmtPct((finalizadas / enriched.length) * 100) : "—"]));
            lines.push(row(["Piezas asignadas (total)", fmtNum(totPiezasAsig)]));
            lines.push(row(["Piezas completadas (total)", fmtNum(totPiezasHechas)]));
            lines.push(row(["Progreso global", fmtPct(progresoGlobal)]));
            lines.push(row(["Horas trabajadas (total)", fmtHours(totSec)]));
            lines.push("");

            // Por departamento
            lines.push(row(["DESGLOSE POR DEPARTAMENTO"]));
            lines.push(row([sectionRule]));
            lines.push(row(["Departamento", "Órdenes", "Piezas asignadas", "Piezas completadas", "Progreso %"]));
            Object.entries(byDept)
              .sort(([a], [b]) => a.localeCompare(b, "es"))
              .forEach(([name, d]) => {
                const pct = d.asignadas > 0 ? (d.completadas / d.asignadas) * 100 : 0;
                lines.push(row([name, d.ordenes, fmtNum(d.asignadas), fmtNum(d.completadas), fmtPct(pct)]));
              });
            lines.push("");

            // Por prioridad
            lines.push(row(["DESGLOSE POR PRIORIDAD"]));
            lines.push(row([sectionRule]));
            lines.push(row(["Prioridad", "Órdenes", "% del total"]));
            (["alta", "media", "baja", "—"] as const).forEach(p => {
              const c = byPrio[p] ?? 0;
              if (c === 0 && p === "—") return;
              const label = p === "—" ? "Sin prioridad" : PRIO_LABEL[p];
              const pct = enriched.length > 0 ? (c / enriched.length) * 100 : 0;
              lines.push(row([label, c, fmtPct(pct)]));
            });
            lines.push("");

            // Detalle órdenes
            lines.push(row(["DETALLE DE ÓRDENES"]));
            lines.push(row([sectionRule]));
            lines.push(row([
              "Código", "Tipo", "Nombre", "Cliente", "Cod. Cliente",
              "Pieza (cód.)", "Pieza (nombre)", "Prioridad", "Unidades",
              "Fecha inicio", "Fecha límite", "Días restantes",
              "Departamentos", "Trabajadores",
              "Piezas asignadas", "Piezas completadas", "Progreso %",
              "Sesiones", "Tiempo total",
              "Estado", "Creada",
            ]));

            const sorted = [...enriched].sort((a, b) =>
              a.o.codigo_orden.localeCompare(b.o.codigo_orden, "es", { numeric: true }));
            sorted.forEach(e => {
              const o = e.o as any;
              const p = o.pieza;
              const dr = e.diasRestantes;
              const drLabel = dr === null ? "" : dr < 0 ? `Vencida (${Math.abs(dr)}d)` : `${dr}d`;
              lines.push(row([
                o.codigo_orden,
                o.tipo ?? "",
                o.nombre_orden,
                o.nombre_cliente ?? "",
                o.codigo_cliente ?? "",
                p?.codigo ?? "",
                p?.nombre ?? "",
                PRIO_LABEL[o.prioridad as string] ?? "",
                o.unidades ?? "",
                fmtDate(o.fecha_inicio),
                fmtDate(o.fecha_fin),
                drLabel,
                e.deptNames,
                e.workers,
                e.piezasAsignadas,
                e.piezasCompletadas,
                fmtPct(e.progress),
                e.sessions,
                e.totalSec > 0 ? fmtHours(e.totalSec) : "",
                isOrderFinalizada(o) ? "Finalizada" : "En curso",
                fmtDate(o.created_at),
              ]));
            });

            lines.push("");
            lines.push(row([sectionRule]));
            lines.push(row(["Fin del informe — OrdenYa"]));

            // ── Descarga ──
            const csv = lines.join("\r\n");
            const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            const pad = (n: number) => n.toString().padStart(2, "0");
            const stamp = `${now.getFullYear()}${pad(now.getMonth()+1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}`;
            a.href = url;
            a.download = `OrdenYa_ordenes_${stamp}.csv`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
          }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: 6, verticalAlign: "middle" }}>
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4 M7 10l5 5 5-5 M12 15V3"/>
            </svg>
            Exportar CSV
          </button>
          <button className="btn-outline" onClick={async () => {
            // ─── PDF PROFESIONAL — OrdenYa ─────────────────────────────────
            const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
            const W = doc.internal.pageSize.getWidth();
            const H = doc.internal.pageSize.getHeight();
            const BRAND = "#3C3489";
            const BRAND_DARK = "#26215C";
            const AMBER = "#EF9F27";
            const GREEN = "#1D9E75";
            const RED = "#EF4444";
            const TEXT_MUTED = "#6B7280";

            // Rasterizar logo SVG a PNG dataURL (logo completo con wordmark)
            const loadLogoPng = async (): Promise<{ data: string; w: number; h: number } | null> => {
              try {
                const res = await fetch("/logo_ordenya_pro.svg");
                const svgText = await res.text();
                const blob = new Blob([svgText], { type: "image/svg+xml" });
                const url = URL.createObjectURL(blob);
                const img = new Image();
                await new Promise<void>((ok, ko) => { img.onload = () => ok(); img.onerror = ko; img.src = url; });
                // viewBox 680x380 → escalar 2x para nitidez
                const cw = 680 * 2, ch = 380 * 2;
                const canvas = document.createElement("canvas");
                canvas.width = cw; canvas.height = ch;
                const ctx = canvas.getContext("2d");
                if (!ctx) return null;
                ctx.drawImage(img, 0, 0, cw, ch);
                URL.revokeObjectURL(url);
                return { data: canvas.toDataURL("image/png"), w: cw, h: ch };
              } catch { return null; }
            };
            const logoPng = await loadLogoPng();

            const now = new Date();
            const PRIO_LABEL: Record<string, string> = { alta: "Alta", media: "Media", baja: "Baja" };
            const fmtDate = (s?: string | null) =>
              s ? new Date(s).toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit", year: "numeric" }) : "—";
            const fmtNum = (n: number) => n.toLocaleString("es-ES");
            const fmtPct = (n: number) => `${n.toLocaleString("es-ES", { maximumFractionDigits: 1 })}%`;
            const fmtHours = (sec: number) => {
              const h = Math.floor(sec / 3600);
              const m = Math.floor((sec % 3600) / 60);
              return `${h}h ${m.toString().padStart(2, "0")}m`;
            };

            // ── Cabecera de marca (se dibuja en cada página) ──
            const HEADER_H = 28;
            const drawHeader = () => {
              // Fondo morado oscuro a todo el ancho
              doc.setFillColor(BRAND_DARK);
              doc.rect(0, 0, W, HEADER_H, "F");
              // Banda principal morada (cubre 75%)
              doc.setFillColor(BRAND);
              doc.rect(0, 0, W * 0.75, HEADER_H, "F");

              // Logo completo (mantiene aspect 680:380 → 50mm × 28mm aprox)
              if (logoPng) {
                const logoH = HEADER_H - 4;   // 24mm alto
                const logoW = logoH * (680 / 380); // ≈ 43mm
                doc.addImage(logoPng.data, "PNG", 6, 2, logoW, logoH);
              } else {
                // Fallback: badge + texto
                doc.setFillColor(AMBER);
                doc.roundedRect(6, 6, 16, 16, 3, 3, "F");
                doc.setFont("helvetica", "bold");
                doc.setFontSize(16);
                doc.setTextColor("#FFFFFF");
                doc.text("Orden", 26, 15);
                const wTxt = doc.getTextWidth("Orden");
                doc.setTextColor(AMBER);
                doc.text("Ya", 26 + wTxt, 15);
              }

              // Tagline a la derecha del logo (centrado vertical)
              doc.setFont("helvetica", "normal");
              doc.setFontSize(8.5);
              doc.setTextColor("#D8D2FF");
              doc.text("Gestión Industrial de Órdenes de Trabajo", 56, 16);

              // Fecha derecha
              doc.setFontSize(9.5);
              doc.setTextColor("#FFFFFF");
              const dateStr = now.toLocaleString("es-ES", { dateStyle: "long", timeStyle: "short" });
              doc.text(dateStr, W - 8, 13, { align: "right" });
              doc.setFontSize(8);
              doc.setTextColor("#D8D2FF");
              doc.text("Informe generado automáticamente", W - 8, 19, { align: "right" });

              // Línea amber acento
              doc.setFillColor(AMBER);
              doc.rect(0, HEADER_H, W, 1, "F");
            };

            // ── Footer ──
            const drawFooter = (pageNum: number, totalPages: number) => {
              doc.setDrawColor("#E5E7EB");
              doc.setLineWidth(0.2);
              doc.line(8, H - 10, W - 8, H - 10);
              doc.setFont("helvetica", "normal");
              doc.setFontSize(8);
              doc.setTextColor(TEXT_MUTED);
              doc.text("OrdenYa — Informe confidencial", 8, H - 5);
              doc.text(`Página ${pageNum} de ${totalPages}`, W - 8, H - 5, { align: "right" });
              doc.text(typeof window !== "undefined" ? window.location.host : "", W / 2, H - 5, { align: "center" });
            };

            // ── Agregados ──
            const enriched = workOrders.map(o => {
              const depts = o.departments ?? [];
              const workersSet = new Set<string>();
              let piezasAsignadas = 0, piezasCompletadas = 0;
              depts.forEach((d: any) => {
                (d.workers ?? []).forEach((w: any) => {
                  if (w.user?.name) workersSet.add(w.user.name);
                  piezasAsignadas   += (w.piezas_asignadas ?? 0);
                  piezasCompletadas += (w.piezas_completadas ?? 0);
                });
              });
              const sessions = (o as any).work_sessions ?? [];
              const totalSec = sessions.reduce((s: number, ws: any) => {
                if (!ws.end_time) return s;
                return s + Math.max(0, Math.floor((new Date(ws.end_time).getTime() - new Date(ws.start_time).getTime()) / 1000));
              }, 0);
              const progress = piezasAsignadas > 0
                ? Math.min(100, (piezasCompletadas / piezasAsignadas) * 100)
                : (isOrderFinalizada(o) ? 100 : 0);
              return {
                o, depts,
                deptNames: depts.flatMap((d: any) => d.department?.name ? [d.department.name] : []).join(" + "),
                workers: Array.from(workersSet).sort().join(", "),
                piezasAsignadas, piezasCompletadas, progress,
                sessions: sessions.length,
                totalSec,
              };
            });
            const finalizadas = enriched.filter(e => isOrderFinalizada(e.o)).length;
            const enCurso = enriched.length - finalizadas;
            const totPiezasAsig = enriched.reduce((s, e) => s + e.piezasAsignadas, 0);
            const totPiezasHechas = enriched.reduce((s, e) => s + e.piezasCompletadas, 0);
            const totSec = enriched.reduce((s, e) => s + e.totalSec, 0);
            const progresoGlobal = totPiezasAsig > 0 ? (totPiezasHechas / totPiezasAsig) * 100 : 0;

            const byDept: Record<string, { ordenes: number; asignadas: number; completadas: number }> = {};
            enriched.forEach(e => {
              e.depts.forEach((d: any) => {
                const k = d.department?.name ?? "—";
                byDept[k] ??= { ordenes: 0, asignadas: 0, completadas: 0 };
                byDept[k].ordenes++;
                (d.workers ?? []).forEach((w: any) => {
                  byDept[k].asignadas   += (w.piezas_asignadas ?? 0);
                  byDept[k].completadas += (w.piezas_completadas ?? 0);
                });
              });
            });

            // Por prioridad
            const byPrio: Record<string, number> = { alta: 0, media: 0, baja: 0 };
            enriched.forEach(e => {
              const p = (e.o as any).prioridad ?? null;
              if (p && byPrio[p] !== undefined) byPrio[p]++;
            });

            // ─── PRIMERA PÁGINA — Resumen ──────────────────────────────────
            drawHeader();

            // ── Banda de título de página ──
            let y = HEADER_H + 6;
            doc.setFillColor("#F8FAFC");
            doc.rect(0, y - 2, W, 18, "F");
            doc.setFont("helvetica", "bold");
            doc.setFontSize(20);
            doc.setTextColor(BRAND_DARK);
            doc.text("Informe de Órdenes de Trabajo", 10, y + 6);
            doc.setFont("helvetica", "normal");
            doc.setFontSize(9.5);
            doc.setTextColor(TEXT_MUTED);
            doc.text(
              `${fmtNum(enriched.length)} registros · ${fmtNum(enCurso)} en curso · ${fmtNum(finalizadas)} finalizadas · Situación actual`,
              10, y + 12
            );
            y += 22;

            // ── KPI cards (4 columnas) — más profesional con acento superior ──
            const cardGap = 4;
            const cardW = (W - 20 - cardGap * 3) / 4;
            const cardH = 24;
            const cards: Array<{ label: string; value: string; color: string; sub?: string }> = [
              { label: "TOTAL ÓRDENES", value: fmtNum(enriched.length), color: BRAND, sub: "registradas" },
              { label: "EN CURSO", value: fmtNum(enCurso), color: AMBER, sub: enriched.length > 0 ? `${fmtPct((enCurso / enriched.length) * 100)} del total` : "—" },
              { label: "FINALIZADAS", value: fmtNum(finalizadas), color: GREEN, sub: enriched.length > 0 ? `${fmtPct((finalizadas / enriched.length) * 100)} del total` : "—" },
              { label: "PROGRESO GLOBAL", value: fmtPct(progresoGlobal), color: BRAND_DARK, sub: `${fmtNum(totPiezasHechas)}/${fmtNum(totPiezasAsig)} piezas` },
            ];
            cards.forEach((c, i) => {
              const x = 10 + i * (cardW + cardGap);
              // Fondo card
              doc.setFillColor("#FFFFFF");
              doc.setDrawColor("#E2E8F0");
              doc.setLineWidth(0.2);
              doc.roundedRect(x, y, cardW, cardH, 2.5, 2.5, "FD");
              // Barra superior color
              doc.setFillColor(c.color);
              doc.roundedRect(x, y, cardW, 2.5, 2.5, 2.5, "F");
              doc.rect(x, y + 1, cardW, 1.5, "F");
              // Label
              doc.setFont("helvetica", "bold");
              doc.setFontSize(7.5);
              doc.setTextColor(TEXT_MUTED);
              doc.text(c.label, x + 5, y + 8);
              // Valor grande
              doc.setFont("helvetica", "bold");
              doc.setFontSize(18);
              doc.setTextColor("#0F172A");
              doc.text(c.value, x + 5, y + 17);
              // Sublabel
              if (c.sub) {
                doc.setFont("helvetica", "normal");
                doc.setFontSize(7.5);
                doc.setTextColor(TEXT_MUTED);
                doc.text(c.sub, x + 5, y + 22);
              }
            });
            y += cardH + 10;

            // ── Headers Resumen ejecutivo + Desglose por dept (en paralelo) ──
            doc.setFont("helvetica", "bold");
            doc.setFontSize(10.5);
            doc.setTextColor(BRAND_DARK);
            doc.text("Resumen ejecutivo", 10, y);
            doc.text("Desglose por departamento", W / 2 + 5, y);
            // Subrayado decorativo
            doc.setDrawColor(AMBER);
            doc.setLineWidth(0.6);
            doc.line(10, y + 1.5, 60, y + 1.5);
            doc.line(W / 2 + 5, y + 1.5, W / 2 + 55, y + 1.5);
            y += 4;

            autoTable(doc, {
              startY: y,
              head: [["Métrica", "Valor"]],
              body: [
                ["Total de órdenes", fmtNum(enriched.length)],
                ["En curso", fmtNum(enCurso)],
                ["Finalizadas", fmtNum(finalizadas)],
                ["% Finalizadas", enriched.length > 0 ? fmtPct((finalizadas / enriched.length) * 100) : "—"],
                ["Piezas asignadas (total)", fmtNum(totPiezasAsig)],
                ["Piezas completadas (total)", fmtNum(totPiezasHechas)],
                ["Progreso global", fmtPct(progresoGlobal)],
                ["Horas trabajadas (total)", totSec > 0 ? fmtHours(totSec) : "—"],
              ],
              theme: "grid",
              styles: { font: "helvetica", fontSize: 9, cellPadding: 2.4, lineColor: "#E2E8F0", lineWidth: 0.2 },
              headStyles: { fillColor: BRAND, textColor: "#FFFFFF", fontStyle: "bold", halign: "left" },
              alternateRowStyles: { fillColor: "#F8FAFC" },
              columnStyles: { 0: { fontStyle: "bold", textColor: "#334155" }, 1: { halign: "right", textColor: "#0F172A" } },
              margin: { left: 10, right: W / 2 + 5 },
              tableWidth: W / 2 - 15,
            });
            const resumenY = (doc as any).lastAutoTable.finalY;

            autoTable(doc, {
              startY: y,
              head: [["Departamento", "Órd.", "Asign.", "Hechas", "Progreso"]],
              body: Object.entries(byDept)
                .sort(([a], [b]) => a.localeCompare(b, "es"))
                .map(([name, d]) => {
                  const pct = d.asignadas > 0 ? (d.completadas / d.asignadas) * 100 : 0;
                  return [name, fmtNum(d.ordenes), fmtNum(d.asignadas), fmtNum(d.completadas), fmtPct(pct)];
                }),
              theme: "grid",
              styles: { font: "helvetica", fontSize: 9, cellPadding: 2.4, lineColor: "#E2E8F0", lineWidth: 0.2 },
              headStyles: { fillColor: BRAND, textColor: "#FFFFFF", fontStyle: "bold" },
              alternateRowStyles: { fillColor: "#F8FAFC" },
              columnStyles: {
                0: { fontStyle: "bold", textColor: "#334155" },
                1: { halign: "right" }, 2: { halign: "right" }, 3: { halign: "right" }, 4: { halign: "right", fontStyle: "bold" },
              },
              margin: { left: W / 2 + 5, right: 10 },
            });
            const deptY = (doc as any).lastAutoTable.finalY;

            // ── Distribución por prioridad — bajo "Desglose por dept" (col derecha) ──
            const colLeft = W / 2 + 5;
            const colRight = W - 10;
            const colW = colRight - colLeft;
            let yPrio = deptY + 8;

            doc.setFont("helvetica", "bold");
            doc.setFontSize(10.5);
            doc.setTextColor(BRAND_DARK);
            doc.text("Distribución por prioridad", colLeft, yPrio);
            doc.setDrawColor(AMBER);
            doc.setLineWidth(0.6);
            doc.line(colLeft, yPrio + 1.5, colLeft + 50, yPrio + 1.5);
            yPrio += 7;

            const prioCfg: Array<{ key: keyof typeof byPrio; label: string; color: string }> = [
              { key: "alta",  label: "Alta",  color: RED },
              { key: "media", label: "Media", color: AMBER },
              { key: "baja",  label: "Baja",  color: GREEN },
            ];
            // Layout: [label 14mm] [barra flex] [count 24mm] [pct 16mm der]
            const labelW = 14;
            const pctW = 16;
            const countW = 24;
            const barX = colLeft + labelW;
            const barWMax = colW - labelW - countW - pctW - 4;
            prioCfg.forEach((cfg, i) => {
              const c = byPrio[cfg.key];
              const pct = enriched.length > 0 ? (c / enriched.length) * 100 : 0;
              const rowY = yPrio + i * 7;
              // Label
              doc.setFont("helvetica", "bold");
              doc.setFontSize(9);
              doc.setTextColor("#334155");
              doc.text(cfg.label, colLeft, rowY + 3.5);
              // Track
              doc.setFillColor("#F1F5F9");
              doc.roundedRect(barX, rowY, barWMax, 5, 1, 1, "F");
              // Fill
              if (pct > 0) {
                doc.setFillColor(cfg.color);
                doc.roundedRect(barX, rowY, (barWMax * pct) / 100, 5, 1, 1, "F");
              }
              // Count
              doc.setFont("helvetica", "bold");
              doc.setFontSize(9);
              doc.setTextColor("#0F172A");
              doc.text(`${c} órdenes`, barX + barWMax + 2, rowY + 3.5);
              // Porcentaje alineado a la derecha
              doc.setFont("helvetica", "normal");
              doc.setFontSize(8);
              doc.setTextColor(TEXT_MUTED);
              doc.text(`(${fmtPct(pct)})`, colRight, rowY + 3.5, { align: "right" });
            });

            // ─── NUEVA PÁGINA — Detalle de órdenes ─────────────────────────
            doc.addPage();
            drawHeader();

            // Banda título
            let yD = HEADER_H + 6;
            doc.setFillColor("#F8FAFC");
            doc.rect(0, yD - 2, W, 18, "F");
            doc.setFont("helvetica", "bold");
            doc.setFontSize(20);
            doc.setTextColor(BRAND_DARK);
            doc.text("Detalle de órdenes", 10, yD + 6);
            doc.setFont("helvetica", "normal");
            doc.setFontSize(9.5);
            doc.setTextColor(TEXT_MUTED);
            doc.text(`Listado completo · Ordenado por código · ${fmtNum(enriched.length)} registros`, 10, yD + 12);
            yD += 22;

            const sorted = [...enriched].sort((a, b) =>
              a.o.codigo_orden.localeCompare(b.o.codigo_orden, "es", { numeric: true }));

            autoTable(doc, {
              startY: yD,
              head: [[
                "Código", "Nombre", "Cliente", "Pieza", "Prio.",
                "Uds.", "Fecha Límite", "Depts.", "Trabajadores",
                "Piezas", "Progreso", "Tiempo", "Estado",
              ]],
              body: sorted.map(e => {
                const o = e.o as any;
                const piezas = e.piezasAsignadas > 0
                  ? `${e.piezasCompletadas}/${e.piezasAsignadas}`
                  : `${e.piezasCompletadas}`;
                return [
                  o.codigo_orden,
                  o.nombre_orden,
                  o.nombre_cliente ?? "—",
                  o.pieza?.codigo ?? "—",
                  PRIO_LABEL[o.prioridad as string] ?? "—",
                  o.unidades ?? "—",
                  fmtDate(o.fecha_fin),
                  e.deptNames || "—",
                  e.workers || "—",
                  piezas,
                  { content: fmtPct(e.progress), _progress: e.progress } as any,
                  e.totalSec > 0 ? fmtHours(e.totalSec) : "—",
                  isOrderFinalizada(o) ? "Finalizada" : "En curso",
                ];
              }),
              theme: "striped",
              styles: { font: "helvetica", fontSize: 8, cellPadding: 2, overflow: "linebreak", lineColor: "#E2E8F0", lineWidth: 0.15 },
              headStyles: { fillColor: BRAND, textColor: "#FFFFFF", fontStyle: "bold", fontSize: 8, halign: "left" },
              alternateRowStyles: { fillColor: "#F8FAFC" },
              columnStyles: {
                0: { fontStyle: "bold", textColor: BRAND_DARK, cellWidth: 19 },
                1: { cellWidth: 32 },
                2: { cellWidth: 26 },
                3: { cellWidth: 14 },
                4: { cellWidth: 13, halign: "center", fontStyle: "bold" },
                5: { cellWidth: 11, halign: "right" },
                6: { cellWidth: 19, halign: "center" },
                7: { cellWidth: 24 },
                8: { cellWidth: 38 },
                9: { cellWidth: 15, halign: "center", fontStyle: "bold" },
                10: { cellWidth: 22 },
                11: { cellWidth: 16, halign: "right" },
                12: { cellWidth: 19, halign: "center", fontStyle: "bold" },
              },
              didParseCell: (data: any) => {
                if (data.section !== "body") return;
                // Estado coloreado
                if (data.column.index === 12) {
                  const v = String(data.cell.raw);
                  data.cell.styles.textColor = v === "Finalizada" ? GREEN : AMBER;
                }
                // Prioridad coloreada
                if (data.column.index === 4) {
                  const v = String(data.cell.raw);
                  if (v === "Alta") data.cell.styles.textColor = RED;
                  else if (v === "Media") data.cell.styles.textColor = AMBER;
                  else if (v === "Baja") data.cell.styles.textColor = GREEN;
                }
              },
              didDrawCell: (data: any) => {
                // Barra de progreso visual en columna 10
                if (data.section === "body" && data.column.index === 10) {
                  const raw = data.cell.raw as any;
                  const pct = typeof raw === "object" && raw?._progress !== undefined ? raw._progress : 0;
                  const cell = data.cell;
                  const barX = cell.x + 1.5;
                  const barY = cell.y + cell.height - 2.2;
                  const barW = cell.width - 3;
                  const barH = 1.2;
                  doc.setFillColor("#E2E8F0");
                  doc.roundedRect(barX, barY, barW, barH, 0.4, 0.4, "F");
                  if (pct > 0) {
                    const color = pct >= 100 ? GREEN : pct >= 50 ? AMBER : BRAND;
                    doc.setFillColor(color);
                    doc.roundedRect(barX, barY, (barW * Math.min(100, pct)) / 100, barH, 0.4, 0.4, "F");
                  }
                }
              },
              margin: { top: HEADER_H + 4, left: 6, right: 6, bottom: 14 },
              didDrawPage: () => { drawHeader(); },
            });

            // ── Footer en todas las páginas ──
            const totalPages = doc.getNumberOfPages();
            for (let i = 1; i <= totalPages; i++) {
              doc.setPage(i);
              drawFooter(i, totalPages);
            }

            // ── Descarga ──
            const pad = (n: number) => n.toString().padStart(2, "0");
            const stamp = `${now.getFullYear()}${pad(now.getMonth()+1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}`;
            doc.save(`OrdenYa_ordenes_${stamp}.pdf`);
          }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: 6, verticalAlign: "middle" }}>
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z M14 2v6h6 M16 13H8 M16 17H8 M10 9H8"/>
            </svg>
            Exportar PDF
          </button>
          {!isReadOnly && (
            <button className="btn-primary" onClick={() => navigate(`${basePath}/ordenes/nuevo`)}>
              <AddIcon size={15} color="white" /> Crear Orden
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <Spinner message="Cargando órdenes..." />
      ) : error ? (
        <p className="work-orders-manager__error">{error}</p>
      ) : (
        <>
          <StatsGrid stats={[
            { label: "Total Órdenes", value: stats.total },
            { label: "En curso", value: stats.enCurso, colorClass: "text-taller" },
            { label: "Finalizadas", value: stats.finalizadas, colorClass: "text-finalizada" },
          ]} />

          <FilterBar
            searchTerm={searchTerm}
            onSearchChange={setSearchTerm}
            searchPlaceholder="Buscar por código, nombre, cliente, pieza, trabajadores..."
            filterValue={filterStatus}
            onFilterChange={setFilterStatus}
            filterOptions={[
              { value: "Todos", label: "Todos" },
              { value: "En curso", label: "En curso" },
              { value: "Finalizada", label: "Finalizadas" },
              { value: "taller", label: "Taller" },
              { value: "instalacion", label: "Instalación" },
            ]}
          />

          <div className="table-container">
            {selectedImage && (
              <ImageModal src={selectedImage.src} alt={selectedImage.alt} onClose={() => setSelectedImage(null)} />
            )}

            {selectedIds.size > 0 && (
              <div className="bulk-bar">
                <div className="bulk-bar__count">
                  <span className="bulk-bar__count-num">{selectedIds.size}</span>
                  <span className="bulk-bar__count-label">seleccionada{selectedIds.size === 1 ? "" : "s"}</span>
                </div>

                <span className="bulk-bar__count-label" style={{ marginLeft: 8 }}>Prioridad</span>
                <div className="bulk-bar__group">
                  <button className="bulk-bar__chip bulk-bar__chip--alta"  onClick={() => handleBulkPrioridad("alta")}>
                    <span className="bulk-bar__chip-dot" /> Alta
                  </button>
                  <button className="bulk-bar__chip bulk-bar__chip--media" onClick={() => handleBulkPrioridad("media")}>
                    <span className="bulk-bar__chip-dot" /> Media
                  </button>
                  <button className="bulk-bar__chip bulk-bar__chip--baja"  onClick={() => handleBulkPrioridad("baja")}>
                    <span className="bulk-bar__chip-dot" /> Baja
                  </button>
                </div>

                <span className="bulk-bar__spacer" />

                <button className="bulk-bar__btn bulk-bar__btn--danger" onClick={handleBulkDelete}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 6h18 M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6 M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                  </svg>
                  Eliminar
                </button>
                <button className="bulk-bar__btn bulk-bar__btn--ghost" onClick={() => setSelectedIds(new Set())}>
                  Cancelar
                </button>
              </div>
            )}

            <table className="modern-table work-orders-manager__table--hoverable">
              <thead>
                <tr>
                  {canModifyExisting && (
                    <th style={{ width: 36 }}>
                      <input type="checkbox" className="brand-check"
                        ref={el => {
                          if (!el) return;
                          const some = paginated.some(o => selectedIds.has(o.id));
                          const all = paginated.length > 0 && paginated.every(o => selectedIds.has(o.id));
                          el.indeterminate = some && !all;
                        }}
                        checked={paginated.length > 0 && paginated.every(o => selectedIds.has(o.id))}
                        onChange={e => {
                          const next = new Set(selectedIds);
                          if (e.target.checked) paginated.forEach(o => next.add(o.id));
                          else paginated.forEach(o => next.delete(o.id));
                          setSelectedIds(next);
                        }} />
                    </th>
                  )}
                  <th className="sortable-th" onClick={() => handleSort("codigo_orden")}>
                    Código <SortIndicator col="codigo_orden" sortKey={sortKey} sortDir={sortDir} />
                  </th>
                  <th>QR</th>
                  <th className="sortable-th" onClick={() => handleSort("nombre_orden")}>
                    Nombre <SortIndicator col="nombre_orden" sortKey={sortKey} sortDir={sortDir} />
                  </th>
                  <th>Estado</th>
                  <th className="sortable-th" onClick={() => handleSort("fecha_fin")}>
                    Fecha límite <SortIndicator col="fecha_fin" sortKey={sortKey} sortDir={sortDir} />
                  </th>
                  <th>Departamentos</th>
                  <th className="work-orders-manager__actions-cell">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {paginated.map(o => {
                  const finalizada = isOrderFinalizada(o);
                  const deadline = getDeadlineBadge(o.fecha_fin);
                  return (
                    <tr
                      key={o.id}
                      className="work-orders-manager__row--clickable"
                      onClick={() => navigate(`${basePath}/ordenes/ver/${o.id}`)}
                    >
                      {canModifyExisting && (
                        <td onClick={e => e.stopPropagation()}>
                          <input type="checkbox" className="brand-check"
                            checked={selectedIds.has(o.id)}
                            onChange={() => toggleSelect(o.id)} />
                        </td>
                      )}
                      <td className="work-orders-manager__code">{o.codigo_orden}</td>
                      <td onClick={e => e.stopPropagation()}>
                        <button
                          type="button"
                          onClick={() => setQrPreview({
                            value: (o as any).qr_codigo ?? `${window.location.origin}/trabajador/ordenes/${o.id}`,
                            codigo: o.codigo_orden,
                            nombre: o.nombre_orden,
                          })}
                          title="Previsualizar QR"
                          style={{
                            width: 48, height: 48, padding: 4,
                            background: "#fff", borderRadius: 8,
                            display: "flex", alignItems: "center", justifyContent: "center",
                            border: "1px solid var(--border-color)",
                            cursor: "pointer",
                            transition: "transform 0.15s, box-shadow 0.15s",
                          }}
                          onMouseEnter={e => Object.assign(e.currentTarget.style, { transform: "scale(1.08)", boxShadow: "0 6px 18px rgba(60,52,137,0.25)" })}
                          onMouseLeave={e => Object.assign(e.currentTarget.style, { transform: "scale(1)", boxShadow: "none" })}
                        >
                          <QRCodeSVG
                            value={(o as any).qr_codigo ?? `${window.location.origin}/trabajador/ordenes/${o.id}`}
                            size={40} level="M" />
                        </button>
                      </td>
                      <td>{o.nombre_orden}</td>
                      <td>
                        <span className={`work-orders-manager__status-badge ${finalizada ? "work-orders-manager__status-badge--finalizada" : "work-orders-manager__status-badge--taller"}`}>
                          {finalizada ? "Finalizada" : "En curso"}
                        </span>
                      </td>
                      <td>
                        {deadline
                          ? <span className={`deadline-badge ${deadline.cls}`}>{deadline.label}</span>
                          : <span className="deadline-badge deadline--none">Sin fecha</span>
                        }
                      </td>
                      <td>
                        <div style={{ display: "flex", gap: "0.3rem", flexWrap: "wrap" }}>
                          {(o.departments ?? []).map(d => {
                            const slug = d.department?.slug ?? "";
                            const color = DEPT_COLORS[slug] ?? "#6b7280";
                            return (
                              <span
                                key={d.id}
                                style={{ fontSize: "0.72rem", padding: "0.1rem 0.5rem", borderRadius: 999, background: `${color}20`, color, border: `1px solid ${color}40`, fontWeight: 600 }}
                              >
                                {DEPT_LABELS[slug] ?? slug}{d.finalizado_at ? " ✓" : ""}
                              </span>
                            );
                          })}
                        </div>
                      </td>
                      <td className="work-orders-manager__actions-cell" onClick={e => e.stopPropagation()}>
                        <div className="work-orders-manager__actions-flex">
                          {canModifyExisting && (
                            <button
                              onClick={() => navigate(`${basePath}/ordenes/editar/${o.id}`)}
                              className="btn-primary work-orders-manager__btn-sm"
                            >
                              <EditIcon size={14} color="white" /> Editar
                            </button>
                          )}
                          {canModifyExisting && (
                            <button
                              onClick={(e) => handleDuplicate(e, o.id)}
                              className="btn-outline work-orders-manager__btn-sm"
                              title="Duplicar"
                            >
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <rect x="9" y="9" width="13" height="13" rx="2"/>
                                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                              </svg>
                            </button>
                          )}
                          {canModifyExisting && (
                            <button
                              onClick={(e) => handleDelete(e, o.id)}
                              className="btn-danger work-orders-manager__btn-sm"
                            >
                              <DeleteIcon size={14} color="white" /> Eliminar
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {filteredOrders.length === 0 && (
                  <tr>
                    <td colSpan={canModifyExisting ? 7 : 6} className="work-orders-manager__empty">No se encontraron órdenes.</td>
                  </tr>
                )}
              </tbody>
            </table>

            {totalPages > 1 && (
              <div className="pagination">
                <span className="pagination__info">
                  {(currentPage - 1) * PAGE_SIZE + 1}–{Math.min(currentPage * PAGE_SIZE, filteredOrders.length)} de {filteredOrders.length}
                </span>
                <div className="pagination__controls">
                  <button className="pagination__btn" disabled={currentPage === 1} onClick={() => setCurrentPage(p => p - 1)}>
                    ‹ Anterior
                  </button>
                  {pageNumbers.map((p, i) =>
                    p === "..." ? (
                      <span key={`dots-after-${pageNumbers[i - 1]}`} className="pagination__dots">…</span>
                    ) : (
                      <button
                        key={p}
                        className={`pagination__btn ${currentPage === p ? "pagination__btn--active" : ""}`}
                        onClick={() => setCurrentPage(p as number)}
                      >
                        {p}
                      </button>
                    )
                  )}
                  <button className="pagination__btn" disabled={currentPage === totalPages} onClick={() => setCurrentPage(p => p + 1)}>
                    Siguiente ›
                  </button>
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {qrPreview && (
        <div
          role="button"
          tabIndex={0}
          onClick={() => setQrPreview(null)}
          onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") setQrPreview(null); }}
          style={{
            position: "fixed", inset: 0, zIndex: 50,
            background: "rgba(13, 10, 31, 0.78)",
            backdropFilter: "blur(10px)",
            WebkitBackdropFilter: "blur(10px)",
            display: "grid",
            placeItems: "center",
            padding: "1.5rem",
            overflowY: "auto",
            animation: "qrModalFade 0.18s ease",
          }}
        >
          <style>{`
            @keyframes qrModalFade { from{opacity:0} to{opacity:1} }
            @keyframes qrModalPop { from{opacity:0;transform:scale(0.94) translateY(8px)} to{opacity:1;transform:scale(1) translateY(0)} }
          `}</style>
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: "var(--card-bg)",
              border: "1px solid var(--border-color)",
              borderRadius: 20,
              maxWidth: 440, width: "100%",
              boxShadow: "0 40px 100px rgba(0,0,0,0.55), 0 0 0 1px rgba(60,52,137,0.10)",
              animation: "qrModalPop 0.3s cubic-bezier(0.16, 1, 0.3, 1)",
              position: "relative",
              overflow: "hidden",
            }}
          >
            <div style={{
              position: "absolute", top: 0, left: 0, right: 0,
              height: 4,
              background: "linear-gradient(90deg, var(--brand) 0%, var(--brand-light) 40%, var(--amber) 100%)",
            }} />

            {/* Header */}
            <div style={{
              padding: "22px 24px 18px",
              borderBottom: "1px solid var(--border-color)",
              display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16,
            }}>
              <div style={{ minWidth: 0, flex: 1 }}>
                <span className="wo-form__title-eyebrow" style={{ marginBottom: 6, display: "inline-block" }}>Código QR</span>
                <h3 style={{
                  margin: 0, fontFamily: "var(--font-display)",
                  fontSize: "1.35rem", fontWeight: 600, letterSpacing: "-0.025em",
                  color: "var(--text-primary)",
                }}>
                  {qrPreview.codigo}
                </h3>
                <p style={{
                  margin: "4px 0 0", color: "var(--text-secondary)",
                  fontSize: "0.85rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                }}>
                  {qrPreview.nombre}
                </p>
              </div>
              <button
                onClick={() => setQrPreview(null)}
                style={{
                  width: 36, height: 36, borderRadius: 10,
                  background: "var(--bg-subtle, var(--bg))",
                  border: "1px solid var(--border-color)",
                  color: "var(--text-secondary)", cursor: "pointer",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  flexShrink: 0,
                  transition: "background-color 0.15s, color 0.15s, border-color 0.15s",
                }}
                onMouseEnter={e => Object.assign(e.currentTarget.style, { borderColor: "#ef4444", color: "#ef4444" })}
                onMouseLeave={e => Object.assign(e.currentTarget.style, { borderColor: "var(--border-color)", color: "var(--text-secondary)" })}
                aria-label="Cerrar"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <path d="M18 6 6 18 M6 6l12 12"/>
                </svg>
              </button>
            </div>

            {/* QR */}
            <div style={{ padding: "24px", background: "var(--bg-subtle, var(--bg))" }}>
              <div style={{
                background: "#fff",
                padding: 20,
                borderRadius: 14,
                display: "flex", justifyContent: "center", alignItems: "center",
                boxShadow: "0 4px 16px rgba(0,0,0,0.08), 0 0 0 1px rgba(60,52,137,0.08)",
                position: "relative",
              }}>
                {/* Corner decorations */}
                {[{ k: "tl", t: 6, l: 6, br: false, bl: false }, { k: "tr", t: 6, r: 6 }, { k: "bl", b: 6, l: 6 }, { k: "br", b: 6, r: 6 }].map((c) => (
                  <span key={c.k} style={{
                    position: "absolute",
                    top: (c as any).t, left: (c as any).l, right: (c as any).r, bottom: (c as any).b,
                    width: 14, height: 14,
                    borderTop: c.t !== undefined ? "2px solid #EF9F27" : undefined,
                    borderLeft: (c as any).l !== undefined ? "2px solid #EF9F27" : undefined,
                    borderRight: (c as any).r !== undefined ? "2px solid #EF9F27" : undefined,
                    borderBottom: c.b !== undefined ? "2px solid #EF9F27" : undefined,
                    borderRadius: 3,
                  }} />
                ))}
                <QRCodeSVG value={qrPreview.value} size={240} level="M" />
              </div>
            </div>

            {/* URL preview + helper */}
            <div style={{ padding: "0 24px 16px", textAlign: "center" }}>
              <p style={{
                margin: "0 0 10px", fontSize: "0.78rem",
                color: "var(--text-secondary)", lineHeight: 1.5,
              }}>
                Escanea con cualquier móvil para abrir el detalle de la orden.
              </p>
              <code style={{
                display: "inline-block",
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: "0.7rem",
                padding: "5px 10px",
                borderRadius: 6,
                background: "var(--bg-subtle, var(--bg))",
                border: "1px solid var(--border-color)",
                color: "var(--brand-light)",
                maxWidth: "100%",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                verticalAlign: "middle",
              }}>
                {qrPreview.value}
              </code>
            </div>

            {/* Actions */}
            <div style={{
              padding: "16px 24px 22px",
              borderTop: "1px solid var(--border-color)",
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 10,
            }}>
              <button
                onClick={() => {
                  const dialog = (document.querySelector('[data-qr-modal]') as HTMLElement | null);
                  const target = dialog?.querySelector("svg") as SVGElement | null;
                  if (!target) return;
                  const xml = new XMLSerializer().serializeToString(target);
                  const blob = new Blob([xml], { type: "image/svg+xml" });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url; a.download = `qr-${qrPreview.codigo}.svg`;
                  a.click();
                  URL.revokeObjectURL(url);
                }}
                className="wo-form__btn-outline"
                style={{ width: "100%", justifyContent: "center", whiteSpace: "nowrap", padding: "11px 14px" }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4 M7 10l5 5 5-5 M12 15V3"/>
                </svg>
                Descargar
              </button>
              <button
                onClick={() => { navigator.clipboard?.writeText(qrPreview.value); }}
                className="wo-form__btn-primary"
                style={{ width: "100%", justifyContent: "center", whiteSpace: "nowrap", padding: "11px 14px" }}
                data-qr-modal
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="9" y="9" width="13" height="13" rx="2"/>
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                </svg>
                Copiar URL
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
