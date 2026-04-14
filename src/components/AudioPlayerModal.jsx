import { useRef } from "react";
import { createPortal } from "react-dom";
import {
  getGraduationYearLabel,
  getHometownWithFlag,
  sanitizeAudioUrl,
} from "../storyUtils";
import { useModalAccessibility } from "./useModalAccessibility";
import "./AudioPlayerModal.css";

export default function AudioPlayerModal({ isOpen, story, onClose }) {
  const panelRef = useRef(null);
  useModalAccessibility({ isOpen, onClose, panelRef });

  if (!isOpen || !story) return null;

  const audioUrl = sanitizeAudioUrl(story.audio_url);
  if (!audioUrl) return null;

  const title = story.name?.trim()
    ? `${story.name}'s Audio Story`
    : "Audio Story";
  const hometown = getHometownWithFlag(story.hometown, story.country_code);
  const classYearLabel = getGraduationYearLabel(story.graduation_year);

  return createPortal(
    <div className="audio-modal-root" role="presentation" onClick={onClose}>
      <div className="audio-modal-backdrop" />
      <section
        className="audio-modal-panel"
        role="dialog"
        aria-modal="true"
        aria-label="Audio player"
        ref={panelRef}
        tabIndex={-1}
        onClick={(event) => event.stopPropagation()}
      >
        <header className="audio-modal-header">
          <h3>{title}</h3>
          <button
            type="button"
            className="audio-modal-close"
            onClick={onClose}
            aria-label="Close audio player"
          >
            Close
          </button>
        </header>

        <p className="audio-modal-meta">{hometown}</p>
        {classYearLabel && (
          <p className="audio-modal-meta audio-modal-meta--muted">
            {classYearLabel}
          </p>
        )}

        <audio
          className="audio-modal-player"
          controls
          autoPlay
          preload="metadata"
          src={audioUrl}
        >
          Your browser does not support the audio element.
        </audio>
      </section>
    </div>,
    document.body,
  );
}
