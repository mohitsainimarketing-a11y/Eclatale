import { useEffect, useRef } from 'react';

/**
 * Makes the Android/browser back button close an open modal or slide-over
 * instead of navigating away from the page. Pushes a throwaway history entry
 * while open; a back-button press (popstate) closes it, and closing any other
 * way (X button, outside click) consumes that same entry via history.back()
 * so the back stack doesn't accumulate dead entries.
 */
export function useModalBackButton(isOpen: boolean, onClose: () => void) {
  const closedByPopRef = useRef(false);

  useEffect(() => {
    if (!isOpen) return;
    closedByPopRef.current = false;
    window.history.pushState({ __modal: true }, '');

    const handlePopState = () => {
      closedByPopRef.current = true;
      onClose();
    };
    window.addEventListener('popstate', handlePopState);

    return () => {
      window.removeEventListener('popstate', handlePopState);
      if (!closedByPopRef.current) {
        window.history.back();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);
}
