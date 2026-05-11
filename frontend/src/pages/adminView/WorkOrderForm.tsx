import React, { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { sileo } from "sileo";
import { showHttpError } from "../../utils/errorHelper";
import { workOrderService } from "../../services/workOrderService";
import { userService } from "../../services/userService";
import { http } from "../../services/http";
import { Spinner } from "../../components/Spinner";
import type { DepartmentSlug } from "../../types/WorkOrder";
import { SaveIcon, CancelIcon, WorkOrderIcon } from "../../components/Icons";
import "./WorkOrdersManager.css";
import "./WorkOrderFormBrand.css";

type Prioridad = "baja" | "media" | "alta";

interface FormData {
  codigo_orden: string;
  nombre_orden: string;
  fecha_inicio: string;
  fecha_fin: string;
  unidades: number;
  prioridad: Prioridad;
  pieza_id: number | "";
  nombre_cliente: string;
  observacion: string;
  departments: DepartmentSlug[];
  department_workers: Record<string, number[]>;
}

const initial: FormData = {
  codigo_orden: "",
  nombre_orden: "",
  fecha_inicio: new Date().toISOString().substring(0, 10),
  fecha_fin: "",
  unidades: 1,
  prioridad: "media",
  pieza_id: "",
  nombre_cliente: "",
  observacion: "",
  departments: [],
  department_workers: {},
};

export const PRIORIDAD_META: Record<Prioridad, { label: string; color: string }> = {
  baja:  { label: "Baja",  color: "#10b981" },
  media: { label: "Media", color: "#f59e0b" },
  alta:  { label: "Alta",  color: "#ef4444" },
};

const DEPT_OPTIONS: { slug: DepartmentSlug; label: string }[] = [
  { slug: "taller", label: "Taller" },
  { slug: "instalacion", label: "Instalación" },
];

export const WorkOrderForm: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id?: string }>();
  const isEditing = Boolean(id);

  const [formData, setFormData] = useState<FormData>(initial);
  const [loading, setLoading] = useState(false);
  const [fetchLoading, setFetchLoading] = useState(true);
  const [workers, setWorkers] = useState<{ id: number; name: string }[]>([]);
  const [piezas, setPiezas] = useState<{ id: number; codigo: string; nombre: string }[]>([]);

  useEffect(() => {
    userService.getUsers()
      .then((list: any) => setWorkers(list.flatMap((u: any) => u.role === 'trabajador' ? [{ id: u.id, name: u.name }] : [])))
      .catch(() => setWorkers([]));
    http.get<any[]>("/piezas")
      .then(r => setPiezas(r.data))
      .catch(() => setPiezas([]));

    if (!isEditing) {
      // Auto-generar siguiente código correlativo (V{YY}-{NNNN})
      workOrderService.getAll().then((all: any[]) => {
        const yy = String(new Date().getFullYear()).slice(-2);
        const prefix = `V${yy}-`;
        const max = all
          .map(o => o.codigo_orden as string)
          .filter(c => c?.startsWith(prefix))
          .map(c => parseInt(c.slice(prefix.length), 10))
          .filter(n => Number.isFinite(n))
          .reduce((a, b) => Math.max(a, b), 0);
        const next = String(max + 1).padStart(4, "0");
        setFormData(prev => prev.codigo_orden ? prev : { ...prev, codigo_orden: `${prefix}${next}` });
        setFetchLoading(false);
      }).catch(() => setFetchLoading(false));
    }

    if (isEditing && id) {
      workOrderService.get(Number(id))
        .then((o: any) => {
          setFormData({
            codigo_orden: o.codigo_orden ?? "",
            nombre_orden: o.nombre_orden ?? "",
            fecha_inicio: o.fecha_inicio?.substring(0, 10) ?? "",
            fecha_fin: o.fecha_fin?.substring(0, 10) ?? "",
            unidades: o.unidades ?? 1,
            prioridad: (o.prioridad ?? "media") as Prioridad,
            pieza_id: o.pieza_id ?? "",
            nombre_cliente: o.nombre_cliente ?? "",
            observacion: o.observacion ?? "",
            departments: (o.departments ?? []).flatMap((d: any) => { const s = d.department?.slug; return s ? [s] : []; }),
            department_workers: {},
          });
        })
        .finally(() => setFetchLoading(false));
    } else {
      setFetchLoading(false);
    }
  }, [id, isEditing]);

  const toggleDept = (slug: DepartmentSlug) => {
    setFormData(prev => ({
      ...prev,
      departments: prev.departments.includes(slug)
        ? prev.departments.filter(s => s !== slug)
        : [...prev.departments, slug],
    }));
  };

  const toggleWorker = (deptSlug: string, userId: number) => {
    setFormData(prev => {
      const current = prev.department_workers[deptSlug] ?? [];
      const next = current.includes(userId)
        ? current.filter(u => u !== userId)
        : [...current, userId];
      return { ...prev, department_workers: { ...prev.department_workers, [deptSlug]: next } };
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.codigo_orden.trim() || !formData.nombre_orden.trim()) {
      sileo.error("Código y nombre son obligatorios");
      return;
    }
    if (formData.departments.length === 0) {
      sileo.error("Selecciona al menos un departamento");
      return;
    }

    setLoading(true);
    try {
      const payload: any = {
        codigo_orden: formData.codigo_orden,
        nombre_orden: formData.nombre_orden,
        fecha_inicio: formData.fecha_inicio || null,
        fecha_fin: formData.fecha_fin || null,
        unidades: formData.unidades,
        prioridad: formData.prioridad,
        pieza_id: formData.pieza_id || null,
        nombre_cliente: formData.nombre_cliente || null,
        observacion: formData.observacion || null,
        departments: formData.departments,
        department_workers: formData.department_workers,
      };

      if (isEditing && id) {
        await workOrderService.update(Number(id), payload);
        sileo.success("Orden actualizada");
      } else {
        await workOrderService.create(payload);
        sileo.success("Orden creada");
      }
      const basePath = window.location.pathname.startsWith("/supervisor") ? "/supervisor" : "/admin";
      navigate(`${basePath}/ordenes/lista`);
    } catch (err: any) {
      const errors = err?.response?.data?.errors;
      if (errors && typeof errors === "object") {
        const first = Object.values(errors)[0] as string[];
        sileo.error({ title: "No se pudo guardar", description: first?.[0] || "Revisa los campos." });
      } else {
        const msg = err?.response?.data?.message || "No se pudo guardar la orden.";
        sileo.error({ title: "Error al guardar", description: msg });
      }
    } finally {
      setLoading(false);
    }
  };

  if (fetchLoading) return <Spinner message="Cargando..." />;

  return (
    <div className="wo-form">
      <div className="wo-form__header">
        <div>
          <span className="wo-form__title-eyebrow">{isEditing ? "Edición" : "Nueva orden"}</span>
          <h2 className="wo-form__title">{isEditing ? "Editar Orden de Trabajo" : "Crear Nueva Orden de Trabajo"}</h2>
        </div>
        <button type="button" className="wo-form__btn-outline" onClick={() => navigate(-1)}>
          <CancelIcon size={15} /> Volver
        </button>
      </div>

      <form onSubmit={handleSubmit} className="wo-form__card">
        <section className="wo-form__section">
          <h3 className="wo-form__section-title">Datos generales</h3>

          <div className="wo-form__grid">
            <div className="wo-form__field">
              <label htmlFor="wof-codigo" className="wo-form__field-label wo-form__field-label--required">Código de orden</label>
              <input id="wof-codigo" type="text" value={formData.codigo_orden}
                onChange={e => setFormData(prev => ({ ...prev, codigo_orden: e.target.value }))}
                required maxLength={255} placeholder="V26-0010" />
            </div>
            <div className="wo-form__field">
              <label htmlFor="wof-nombre" className="wo-form__field-label wo-form__field-label--required">Nombre de la orden</label>
              <input id="wof-nombre" type="text" value={formData.nombre_orden}
                onChange={e => setFormData(prev => ({ ...prev, nombre_orden: e.target.value }))}
                required placeholder="Descripción breve" />
            </div>
            <div className="wo-form__field">
              <label htmlFor="wof-fecha-inicio" className="wo-form__field-label">Fecha inicio</label>
              <input id="wof-fecha-inicio" type="date" value={formData.fecha_inicio}
                onChange={e => setFormData(prev => ({ ...prev, fecha_inicio: e.target.value }))} />
            </div>
            <div className="wo-form__field">
              <label htmlFor="wof-fecha-fin" className="wo-form__field-label">Fecha fin</label>
              <input id="wof-fecha-fin" type="date" value={formData.fecha_fin}
                onChange={e => setFormData(prev => ({ ...prev, fecha_fin: e.target.value }))} />
            </div>
            <div className="wo-form__field">
              <label htmlFor="wof-unidades" className="wo-form__field-label">Unidades</label>
              <input id="wof-unidades" type="number" min={1} value={formData.unidades}
                onChange={e => setFormData(prev => ({ ...prev, unidades: Number(e.target.value) }))} />
            </div>
            <div className="wo-form__field">
              <label htmlFor="wof-prioridad" className="wo-form__field-label">Prioridad</label>
              <select id="wof-prioridad" value={formData.prioridad}
                onChange={e => setFormData(prev => ({ ...prev, prioridad: e.target.value as Prioridad }))}>
                <option value="baja">Baja</option>
                <option value="media">Media</option>
                <option value="alta">Alta</option>
              </select>
            </div>
            <div className="wo-form__field">
              <label htmlFor="wof-cliente" className="wo-form__field-label">Cliente</label>
              <input id="wof-cliente" type="text" value={formData.nombre_cliente}
                onChange={e => setFormData(prev => ({ ...prev, nombre_cliente: e.target.value }))}
                placeholder="Nombre del cliente" />
            </div>
            <div className="wo-form__field">
              <label htmlFor="wof-pieza" className="wo-form__field-label">Pieza</label>
              <select id="wof-pieza" value={formData.pieza_id}
                onChange={e => setFormData(prev => ({ ...prev, pieza_id: e.target.value ? Number(e.target.value) : "" }))}>
                <option value="">Seleccionar pieza</option>
                {piezas.map(p => (
                  <option key={p.id} value={p.id}>{p.codigo} · {p.nombre}</option>
                ))}
              </select>
            </div>
            <div className="wo-form__field wo-form__field-full">
              <label htmlFor="wof-observacion" className="wo-form__field-label">Observaciones</label>
              <textarea id="wof-observacion" rows={3} value={formData.observacion}
                onChange={e => setFormData(prev => ({ ...prev, observacion: e.target.value }))}
                placeholder="Notas internas, requisitos especiales, etc." />
            </div>
          </div>
        </section>

        <section className="wo-form__section">
          <h3 className="wo-form__section-title">Departamentos y trabajadores</h3>
          {DEPT_OPTIONS.map(d => {
            const checked = formData.departments.includes(d.slug);
            const assigned = formData.department_workers[d.slug] ?? [];
            return (
              <div key={d.slug} className={`wo-form__dept ${checked ? "wo-form__dept--checked" : ""}`}>
                <label className="wo-form__dept-toggle">
                  <input type="checkbox" checked={checked} onChange={() => toggleDept(d.slug)} />
                  {d.label}
                </label>
                {checked && (
                  <div className="wo-form__dept-workers">
                    <span className="wo-form__dept-workers-label">Trabajadores asignados</span>
                    {workers.length === 0 ? (
                      <span className="wo-form__worker-empty">No hay trabajadores disponibles.</span>
                    ) : (
                      <div className="wo-form__dept-workers-grid">
                        {workers.map(w => {
                          const isOn = assigned.includes(w.id);
                          return (
                            <label key={w.id} className={`wo-form__worker-chip ${isOn ? "wo-form__worker-chip--checked" : ""}`}>
                              <input type="checkbox" checked={isOn} onChange={() => toggleWorker(d.slug, w.id)} />
                              {w.name}
                            </label>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </section>

        <div className="wo-form__actions">
          <button type="submit" className="wo-form__btn-primary" disabled={loading}>
            <SaveIcon size={15} /> {loading ? "Guardando..." : (isEditing ? "Guardar cambios" : "Crear Orden")}
          </button>
          <button type="button" className="wo-form__btn-outline" onClick={() => navigate(-1)}>
            <CancelIcon size={15} /> Cancelar
          </button>
        </div>
      </form>
    </div>
  );
};
