import { useEffect } from 'react';

/**
 * Custom hook to manage keyboard and touch friendly inputs globally.
 * Ensures smooth scrolling of focused input fields, prevents accidental
 * screen/modal dismissals, disables global touch-dismiss when active,
 * and handles the Escape key to safely blur input fields.
 */
export function useKeyboardFriendlyInputs() {
  useEffect(() => {
    let focusTimeout: any;

    // Centralized onFocus event handler
    const handleFocusIn = (e: FocusEvent) => {
      const target = e.target as HTMLElement;
      if (
        target &&
        (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') &&
        target.getAttribute('type') !== 'checkbox' &&
        target.getAttribute('type') !== 'radio'
      ) {
        // Mark keyboard active on document body to temporarily disable any global touch-dismiss mechanism
        document.body.classList.add('keyboard-input-active');
        (window as any).isKeyboardInputActive = true;

        clearTimeout(focusTimeout);
        focusTimeout = setTimeout(() => {
          // Scroll active input into view with 'block: center' for a smooth interaction
          target.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 250); // Safe delay for keyboard layout shifts
      }
    };

    const handleFocusOut = (e: FocusEvent) => {
      const target = e.target as HTMLElement;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) {
        // Wait briefly to see if another input is focusing
        setTimeout(() => {
          const newActive = document.activeElement;
          if (!newActive || (newActive.tagName !== 'INPUT' && newActive.tagName !== 'TEXTAREA')) {
            document.body.classList.remove('keyboard-input-active');
            (window as any).isKeyboardInputActive = false;
          }
        }, 150);
      }
    };

    // Global Keydown handler for Escape key
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        const activeEl = document.activeElement as HTMLElement;
        if (activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA')) {
          activeEl.blur();
          e.stopPropagation();
          e.preventDefault();
        }
      }
    };

    document.addEventListener('focusin', handleFocusIn);
    document.addEventListener('focusout', handleFocusOut);
    window.addEventListener('keydown', handleKeyDown, { capture: true });

    return () => {
      document.removeEventListener('focusin', handleFocusIn);
      document.removeEventListener('focusout', handleFocusOut);
      window.removeEventListener('keydown', handleKeyDown, { capture: true });
      clearTimeout(focusTimeout);
    };
  }, []);
}
