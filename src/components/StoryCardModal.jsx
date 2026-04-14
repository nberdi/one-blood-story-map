import { useRef } from "react";
import { createPortal } from "react-dom";
import { useModalAccessibility } from "./useModalAccessibility";
import "./StoryCardModal.css";

export default function StoryCardModal({
  isOpen,
  imageUrl,
  onDownload,
  onClose,
}) {
  const panelRef = useRef(null);
  useModalAccessibility({ isOpen, onClose, panelRef });

  if (!isOpen || !imageUrl) return null;

  return createPortal(
    <div
      className="story-card-modal-root"
      role="presentation"
      onClick={onClose}
    >
      <div className="story-card-modal-backdrop" />
      <div
        className="story-card-modal-panel"
        role="dialog"
        aria-modal="true"
        aria-label="Story card preview"
        ref={panelRef}
        tabIndex={-1}
        onClick={(event) => event.stopPropagation()}
      >
        <h3>Story Card Preview</h3>
        <img src={imageUrl} alt="Generated One Blood story card" />

        <div className="story-card-modal-actions">
          <button type="button" className="btn-secondary" onClick={onClose}>
            Close
          </button>
          <button type="button" className="btn-primary" onClick={onDownload}>
            Download
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
