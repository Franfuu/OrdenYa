import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { sileo } from "sileo";
import { useAuth } from "../../auth/authContext";
import { http } from "../../services/http";
import { getErrorMessage } from "../../utils/errorHelper";
import { SaveIcon, CancelIcon } from "../../components/Icons";
import "../adminView/WorkOrderFormBrand.css";

interface Pieza {
  id?: number;
  codigo: string;
  nombre: string;
  descripcion: string;
  foto?: string | null;
}

const initial: Pieza = { codigo: "", nombre: "", descripcion: "", foto: null };

export const PiezaForm: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id?: string }>();
  const { user } = useAuth();
  const role = (user as any)?.role;
  const basePath = role === "supervisor" ? "/supervisor" : "/admin";
  const isEditing = Boolean(id);

  const [data, setData] = useState<Pieza>(initial);
  const [fotoFile, setFotoFile] = useState<File | null>(null);
  const [fotoPreview, setFotoPreview] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(false);

  useEffect(() => {
    if (!id) return;
    setFetching(true);
    http.get<Pieza>(`/piezas/${id}`)
      .then(r => {
        setData({
          codigo: r.data.codigo,
          nombre: r.data.nombre,
          descripcion: r.data.descripcion ?? "",
          foto: r.data.foto ?? null,
        });
        if (r.data.foto) setFotoPreview(r.data.foto);
      })
      .catch(() => sileo.error({ title: "No se pudo cargar la pieza" }))
      .finally(() => setFetching(false));
  }, [id]);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFotoFile(file);
    const reader = new FileReader();
    reader.onload = () => setFotoPreview(String(reader.result));
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!data.codigo.trim() || !data.nombre.trim()) {
      sileo.error({ title: "Código y nombre son obligatorios" });
      return;
    }
    setLoading(true);
    try {
      const fd = new FormData();
      fd.append("codigo", data.codigo);
      fd.append("nombre", data.nombre);
      if (data.descripcion) fd.append("descripcion", data.descripcion);
      if (fotoFile) fd.append("foto", fotoFile);

      if (isEditing) {
        // Laravel needs _method override for multipart PUT
        fd.append("_method", "PUT");
        await http.post(`/piezas/${id}`, fd, { headers: { "Content-Type": "multipart/form-data" } });
        sileo.success({ title: "Pieza actualizada" });
      } else {
        await http.post(`/piezas`, fd, { headers: { "Content-Type": "multipart/form-data" } });
        sileo.success({ title: "Pieza creada" });
      }
      navigate(`${basePath}/piezas/lista`);
    } catch (err: any) {
      sileo.error({ title: "Error", description: getErrorMessage(err) });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="wo-form">
      <div className="wo-form__header">
        <div>
          <span className="wo-form__title-eyebrow">{isEditing ? "Edición" : "Nueva pieza"}</span>
          <h2 className="wo-form__title">{isEditing ? "Editar Pieza" : "Crear Nueva Pieza"}</h2>
        </div>
        <button type="button" className="wo-form__btn-outline" onClick={() => navigate(-1)}>
          <CancelIcon size={15} /> Volver
        </button>
      </div>

      <form onSubmit={handleSubmit} className="wo-form__card">
        <section className="wo-form__section">
          <h3 className="wo-form__section-title">Datos de la pieza</h3>
          <div className="wo-form__grid">
            <div className="wo-form__field">
              <label htmlFor="pf-codigo" className="wo-form__field-label wo-form__field-label--required">Código</label>
              <input id="pf-codigo" type="text" value={data.codigo} disabled={fetching}
                onChange={e => setData(prev => ({ ...prev, codigo: e.target.value }))}
                placeholder="P-XXX" required maxLength={255} />
            </div>
            <div className="wo-form__field">
              <label htmlFor="pf-nombre" className="wo-form__field-label wo-form__field-label--required">Nombre</label>
              <input id="pf-nombre" type="text" value={data.nombre} disabled={fetching}
                onChange={e => setData(prev => ({ ...prev, nombre: e.target.value }))}
                placeholder="Estructura ST-10" required maxLength={255} />
            </div>
            <div className="wo-form__field wo-form__field-full">
              <label htmlFor="pf-desc" className="wo-form__field-label">Descripción</label>
              <textarea id="pf-desc" rows={3} value={data.descripcion} disabled={fetching}
                onChange={e => setData(prev => ({ ...prev, descripcion: e.target.value }))}
                placeholder="Detalles, dimensiones, material..." />
            </div>
          </div>
        </section>

        <section className="wo-form__section">
          <h3 className="wo-form__section-title">Foto de la pieza</h3>
          <div style={{ display: "flex", gap: "1.2rem", alignItems: "flex-start", flexWrap: "wrap" }}>
            <div style={{
              width: 160, height: 160,
              borderRadius: 14,
              border: "1.5px dashed var(--border-color)",
              background: "var(--bg-subtle, var(--bg))",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              overflow: "hidden",
              flexShrink: 0,
            }}>
              {fotoPreview ? (
                <img src={fotoPreview} alt="Pieza" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              ) : (
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.35 }}>
                  <rect x="3" y="3" width="18" height="18" rx="2"/>
                  <circle cx="9" cy="9" r="2"/>
                  <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/>
                </svg>
              )}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10, flex: 1, minWidth: 240 }}>
              <label className="wo-form__btn-outline" style={{ cursor: "pointer", display: "inline-flex", alignSelf: "flex-start" }}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4 M17 8l-5-5-5 5 M12 3v12"/>
                </svg>
                {fotoPreview ? "Cambiar foto" : "Subir foto"}
                <input type="file" accept="image/*" hidden onChange={handleFile} />
              </label>
              {fotoPreview && (
                <button type="button" onClick={() => { setFotoFile(null); setFotoPreview(""); setData(prev => ({ ...prev, foto: null })); }}
                  className="wo-form__btn-outline" style={{ alignSelf: "flex-start", borderColor: "rgba(239,68,68,0.4)", color: "#ef4444" }}>
                  Quitar foto
                </button>
              )}
              <p style={{ fontSize: "0.78rem", color: "var(--text-secondary)", margin: 0, lineHeight: 1.5 }}>
                Formatos admitidos: JPG, PNG, WebP. Máximo 5 MB. La foto se mostrará en el listado de piezas y en el catálogo.
              </p>
            </div>
          </div>
        </section>

        <div className="wo-form__actions">
          <button type="submit" className="wo-form__btn-primary" disabled={loading || fetching}>
            <SaveIcon size={15} /> {loading ? "Guardando..." : (isEditing ? "Guardar cambios" : "Crear Pieza")}
          </button>
          <button type="button" className="wo-form__btn-outline" onClick={() => navigate(-1)}>
            <CancelIcon size={15} /> Cancelar
          </button>
        </div>
      </form>
    </div>
  );
};
