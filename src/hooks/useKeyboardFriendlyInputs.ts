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

    // Centralized parent touch/mousedown capture handler
    const handleParentTouchCapture = (e: TouchEvent | MouseEvent) => {
      const activeEl = document.activeElement;
      if (
        activeEl &&
        (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA') &&
        activeEl.getAttribute('type') !== 'checkbox' &&
        activeEl.getAttribute('type') !== 'radio'
      ) {
        const target = e.target as HTMLElement;
        // If the tap/click is outside the active input itself and also not clicking an active option, button, or link
        if (target !== activeEl && !target.closest('button, a, input, select, textarea, [role="button"]')) {
          // Temporarily disable the global touch-dismiss mechanism / navigation
          // on the parent container when any input is active, preventing accidental screen dismissals.
          e.stopPropagation();
          console.log('[KeyboardFriendly] Accidental parent touch-dismiss click captured and suppressed.');
        }
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
          console.log('[KeyboardFriendly] Input cleanly unfocused via Escape key.');
        }
      }
    };

    document.addEventListener('focusin', handleFocusIn);
    document.addEventListener('focusout', handleFocusOut);

    // Register capture touch event listeners on window (parent container representing global stage)
    window.addEventListener('touchstart', handleParentTouchCapture, { capture: true, passive: false });
    window.addEventListener('mousedown', handleParentTouchCapture, { capture: true });
    window.addEventListener('keydown', handleKeyDown, { capture: true });

    // Handle visualViewport orientation / sizing changes
    const handleViewportChange = () => {
      const activeEl = document.activeElement as HTMLElement;
      if (
        activeEl &&
        (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA') &&
        activeEl.getAttribute('type') !== 'checkbox' &&
        activeEl.getAttribute('type') !== 'radio'
      ) {
        activeEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    };

    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', handleViewportChange);
      window.visualViewport.addEventListener('scroll', handleViewportChange);
    }

    return () => {
      document.removeEventListener('focusin', handleFocusIn);
      document.removeEventListener('focusout', handleFocusOut);
      window.removeEventListener('touchstart', handleParentTouchCapture, { capture: true });
      window.removeEventListener('mousedown', handleParentTouchCapture, { capture: true });
      window.removeEventListener('keydown', handleKeyDown, { capture: true });
      clearTimeout(focusTimeout);
      if (window.visualViewport) {
        window.visualViewport.removeEventListener('resize', handleViewportChange);
        window.visualViewport.removeEventListener('scroll', handleViewportChange);
      }
    };
  }, []);
}
