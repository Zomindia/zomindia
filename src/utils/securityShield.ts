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

  // 2. Clear Context Menu on desktop right-click only (never block mobile touch gestures)
  document.addEventListener('contextmenu', (e) => {
    const target = e.target as HTMLElement;
    if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) {
      return;
    }
    // Only prevent default on mouse right-click, not touch long-press during scroll
    if ((e as PointerEvent).pointerType === 'mouse') {
      e.preventDefault();
    }
  });
}
