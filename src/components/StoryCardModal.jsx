import { useEffect } from "react";
import { createPortal } from "react-dom";
import "./StoryCardModal.css";

export default function StoryCardModal({
  isOpen,
  imageUrl,
  onDownload,
  onClose,
}) {
  useEffect(() => {
    if (!isOpen) return undefined;

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, onClose]);

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
