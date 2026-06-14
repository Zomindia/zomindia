export function initSecurityShield() {
  if (typeof window === 'undefined') return;

  // 1. Block standard text selection globally via custom style sheets
  const style = document.createElement('style');
  style.id = 'zomindia-frontend-shield';
  style.innerHTML = `
    * {
      -webkit-user-select: none !important;
      -moz-user-select: none !important;
      -ms-user-select: none !important;
      user-select: none !important;
    }
    input, textarea {
      -webkit-user-select: text !important;
      -moz-user-select: text !important;
      -ms-user-select: text !important;
      user-select: text !important;
    }
  `;
  document.head.appendChild(style);

  // Prevent selection event specifically
  document.addEventListener('selectstart', (e) => {
    const target = e.target as HTMLElement;
    if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
      return;
    }
    e.preventDefault();
  });

  // 2. Clear Context Menu (Right Click)
  document.addEventListener('contextmenu', (e) => {
    const target = e.target as HTMLElement;
    // Allow standard inputs to have context menu for easy typing/paste, but lock down the page content
    if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) {
      return;
    }
    e.preventDefault();
    console.warn("ZomIndia safe shield: Right-click inspections have been disabled on this page.");
  });

  // 3. Block Keyboard Shortcuts
  document.addEventListener('keydown', (e) => {
    // F12 (key code 123)
    if (e.key === 'F12' || e.keyCode === 123) {
      e.preventDefault();
      triggerPrankLog();
      return false;
    }
    // Ctrl+Shift+I / Cmd+Opt+I (Chrome DevTools)
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'I' || e.key === 'i' || e.keyCode === 73)) {
      e.preventDefault();
      triggerPrankLog();
      return false;
    }
    // Ctrl+Shift+J / Cmd+Opt+J (Console)
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'J' || e.key === 'j' || e.keyCode === 74)) {
      e.preventDefault();
      triggerPrankLog();
      return false;
    }
    // Ctrl+U / Cmd+Opt+U (View Source)
    if ((e.ctrlKey || e.metaKey) && (e.key === 'U' || e.key === 'u' || e.keyCode === 85)) {
      e.preventDefault();
      triggerPrankLog();
      return false;
    }
    // Ctrl+Shift+C / Cmd+Opt+C (Inspect Element)
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'C' || e.key === 'c' || e.keyCode === 67)) {
      e.preventDefault();
      triggerPrankLog();
      return false;
    }
    // Ctrl+S / Cmd+S (Save Page)
    if ((e.ctrlKey || e.metaKey) && (e.key === 'S' || e.key === 's' || e.keyCode === 83)) {
      e.preventDefault();
      triggerPrankLog();
      return false;
    }
  });

  // Safe warnings & honeypot log
  function triggerPrankLog() {
    try {
      console.clear();
      console.log(
        "%cSystem Security Node Active",
        "color: #ff3333; font-size: 22px; font-weight: 900; font-family: sans-serif; text-shadow: 2px 2px 4px rgba(0,0,0,0.2); padding: 4px;"
      );
      console.log(
        "%cDependencies Loaded: [fake_library_v9.1, proprietary_shield_core_v4]. All unauthorized inspections are being safely logged via secure info@zomindia.com gateway tokens.",
        "color: #ffaa00; font-size: 13px; font-weight: bold; font-family: monospace; line-height: 1.5; background-color: #111; padding: 10px; border-radius: 8px; border: 1px solid #ffaa00;"
      );
      console.log(
        "%cIf you are looking for our tech stack, we use standard, beautiful React & Tailwind packages to deliver seamless quality. Have inquiries or want to join our core crew? Contact us at info@zomindia.com instead of source tampering!",
        "color: #22c55e; font-size: 12px; font-weight: 500; font-family: sans-serif; margin-top: 8px;"
      );
    } catch {
      // Fail-silent if console functions are unavailable
    }
  }

  // Continuous background monitoring loop to detect DevTools & lock the inspector via developer breakpoint triggers
  const startDevToolsMonitor = () => {
    let checkInterval = 400; // milliseconds

    const loop = () => {
      const startTime = performance.now();
      
      // Inline dynamic debugger trap to catch anyone debugging or viewing sources.
      // This will pause code execution ONLY if their inspector/devtools is actively open.
      try {
        const debuggerTrap = function() {
          debugger;
        };
        (debuggerTrap as any)();
      } catch {
        // Safe bypass
      }
      
      const endTime = performance.now();
      const duration = endTime - startTime;

      // If the execution took more than 80ms, the inspector breakpoint successfully caught them!
      if (duration > 80) {
        triggerPrankLog();
        console.warn(
          "%c[SECURITY WARNING] Source inspection activities are flagged on this session. Unregistered debugger traps have paused local scope execution.", 
          "color: #a855f7; font-size: 12px; font-weight: bold; background-color: #2e1065; padding: 6px; border-radius: 4px;"
        );
      }
      
      setTimeout(loop, checkInterval);
    };

    // Run the loop asynchronously
    setTimeout(loop, checkInterval);

    // Docked DevTools viewport dimensions detection trick
    const checkViewportDimensions = () => {
      const threshold = 160;
      const widthDelta = window.outerWidth - window.innerWidth;
      const heightDelta = window.outerHeight - window.innerHeight;

      if (widthDelta > threshold || heightDelta > threshold) {
        // Safe check for docked tools
        triggerPrankLog();
      }
    };

    window.addEventListener('resize', checkViewportDimensions);
    checkViewportDimensions();
  };

  // Start the background honeypot loops safely isolated with try-catch blocks
  try {
    startDevToolsMonitor();
  } catch (err) {
    console.debug("Silent shield initialization warning: stealth mode bypassed.", err);
  }
}
