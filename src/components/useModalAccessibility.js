import { useEffect } from "react";

const FOCUSABLE_SELECTOR =
  'a[href],button:not([disabled]),textarea:not([disabled]),input:not([disabled]),select:not([disabled]),[tabindex]:not([tabindex="-1"])';

function getFocusableElements(container) {
  if (!container) return [];
  return [...container.querySelectorAll(FOCUSABLE_SELECTOR)].filter(
    (element) => !element.hasAttribute("disabled"),
  );
}

export function useModalAccessibility({ isOpen, onClose, panelRef }) {
  useEffect(() => {
    if (!isOpen) return undefined;

    const previousActiveElement =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    const panelElement = panelRef.current;
    const focusableElements = getFocusableElements(panelElement);
    const initialFocusTarget = focusableElements[0] || panelElement;

    if (initialFocusTarget) {
      initialFocusTarget.focus({ preventScroll: true });
    }

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }

      if (event.key !== "Tab") return;

      const currentPanel = panelRef.current;
      if (!currentPanel) return;

      const currentFocusable = getFocusableElements(currentPanel);
      if (!currentFocusable.length) {
        event.preventDefault();
        currentPanel.focus({ preventScroll: true });
        return;
      }

      const firstElement = currentFocusable[0];
      const lastElement = currentFocusable[currentFocusable.length - 1];
      const activeElement = document.activeElement;

      if (event.shiftKey) {
        if (
          activeElement === firstElement ||
          !currentPanel.contains(activeElement)
        ) {
          event.preventDefault();
          lastElement.focus({ preventScroll: true });
        }
        return;
      }

      if (activeElement === lastElement) {
        event.preventDefault();
        firstElement.focus({ preventScroll: true });
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      if (previousActiveElement) {
        previousActiveElement.focus({ preventScroll: true });
      }
    };
  }, [isOpen, onClose, panelRef]);
}
