import { useEffect } from "react";
import { createPortal } from "react-dom";
import {
  getGraduationYearLabel,
  getHometownWithFlag,
  sanitizeImageUrl,
} from "../storyUtils";
import "./ImageViewerModal.css";

export default function ImageViewerModal({ isOpen, story, onClose }) {
  useEffect(() => {
    if (!isOpen) return undefined;

    const handleEscape = (event) => {
      if (event.key === "Escape") onClose();
    };

    window.addEventListener("keydown", handleEscape);
    return () => {
      window.removeEventListener("keydown", handleEscape);
    };
  }, [isOpen, onClose]);

  if (!isOpen || !story) return null;

  const imageUrl = sanitizeImageUrl(story.image_url);
  if (!imageUrl) return null;

  const title = story.name?.trim() ? `${story.name}'s Picture` : "Picture";
  const hometown = getHometownWithFlag(story.hometown, story.country_code);
  const classYearLabel = getGraduationYearLabel(story.graduation_year);

  return createPortal(
    <div className="image-modal-root" role="presentation" onClick={onClose}>
      <div className="image-modal-backdrop" />
      <section
        className="image-modal-panel"
        role="dialog"
        aria-modal="true"
        aria-label="Image viewer"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="image-modal-header">
          <h3>{title}</h3>
          <button
            type="button"
            className="image-modal-close"
            onClick={onClose}
            aria-label="Close image"
          >
            Close
          </button>
        </header>

        <p className="image-modal-meta">{hometown}</p>
        {classYearLabel && (
          <p className="image-modal-meta image-modal-meta--muted">
            {classYearLabel}
          </p>
        )}

        <div className="image-modal-frame">
          <img src={imageUrl} alt={title} />
        </div>
      </section>
    </div>,
    document.body,
  );
}
