import { useRef } from "react";
import { createPortal } from "react-dom";
import { getGraduationYearLabel, getHometownWithFlag } from "../storyUtils";
import { useModalAccessibility } from "./useModalAccessibility";
import "./StoryReaderModal.css";

function getReadableStoryText(story) {
  if (typeof story !== "string") return "No text story available.";
  const trimmed = story.trim();
  return trimmed || "No text story available.";
}

function getWordCount(text) {
  if (typeof text !== "string") return 0;
  const trimmed = text.trim();
  if (!trimmed) return 0;
  return trimmed.split(/\s+/).length;
}

export default function StoryReaderModal({ isOpen, story, onClose }) {
  const panelRef = useRef(null);
  useModalAccessibility({ isOpen, onClose, panelRef });

  if (!isOpen || !story) return null;

  const title = story.name?.trim() ? `${story.name}'s Story` : "Story";
  const hometown = getHometownWithFlag(story.hometown, story.country_code);
  const classYearLabel = getGraduationYearLabel(story.graduation_year);
  const storyText = getReadableStoryText(story.story);
  const storyWordCount = getWordCount(storyText);

  return createPortal(
    <div
      className="story-reader-modal-root"
      role="presentation"
      onClick={onClose}
    >
      <div className="story-reader-modal-backdrop" />
      <section
        className="story-reader-modal-panel"
        role="dialog"
        aria-modal="true"
        aria-label="Read story"
        ref={panelRef}
        tabIndex={-1}
        onClick={(event) => event.stopPropagation()}
      >
        <header className="story-reader-modal-header">
          <h3>{title}</h3>
          <button
            type="button"
            className="story-reader-modal-close"
            onClick={onClose}
            aria-label="Close story"
          >
            Close
          </button>
        </header>

        <p className="story-reader-modal-meta">{hometown}</p>
        {classYearLabel && (
          <p className="story-reader-modal-meta story-reader-modal-meta--muted">
            {classYearLabel}
          </p>
        )}
        {storyWordCount > 0 && (
          <p className="story-reader-modal-meta story-reader-modal-meta--muted">
            {storyWordCount} words
          </p>
        )}

        <div className="story-reader-modal-body">
          <p>{storyText}</p>
        </div>
      </section>
    </div>,
    document.body,
  );
}
