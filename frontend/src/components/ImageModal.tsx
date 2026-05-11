import React, { useEffect } from "react";
import ReactDOM from "react-dom";
import { CancelIcon } from "./Icons";
import "./ImageModal.css";

interface ImageModalProps {
  src: string;
  alt?: string;
  onClose: () => void;
}

export const ImageModal: React.FC<ImageModalProps> = ({ src, alt, onClose }) => {
  // Cerrar con Escape
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleEsc);
    // Prevenir scroll del body cuando está abierto
    document.body.style.overflow = "hidden";
    
    return () => {
      window.removeEventListener("keydown", handleEsc);
      document.body.style.overflow = "unset";
    };
  }, [onClose]);

  return ReactDOM.createPortal(
    <div className="image-modal-overlay" role="button" tabIndex={0} onClick={onClose} onKeyDown={(e) => { if (e.key === 'Escape' || e.key === 'Enter') onClose(); }}>
      <div className="image-modal-content" onClick={(e) => e.stopPropagation()}>
        <button className="image-modal-close" onClick={onClose} title="Cerrar">
          <CancelIcon size={24} color="white" />
        </button>
        <img src={src} alt={alt || "Imagen ampliada"} className="image-modal-img" />
      </div>
    </div>,
    document.body
  );
};
