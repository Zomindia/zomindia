import { RecaptchaVerifier, Auth } from 'firebase/auth';

declare global {
  interface Window {
    recaptchaVerifier?: RecaptchaVerifier | null;
  }
}

/**
 * Safely clears and destroys any existing RecaptchaVerifier instance and wipes DOM containers.
 */
export function clearRecaptchaInstance(containerId: string = 'recaptcha-container'): void {
  if (typeof window !== 'undefined' && window.recaptchaVerifier) {
    try {
      window.recaptchaVerifier.clear();
    } catch (err) {
      console.warn('[Recaptcha] Non-blocking instance clear notice:', err);
    }
    window.recaptchaVerifier = null;
  }

  if (typeof document !== 'undefined') {
    const container = document.getElementById(containerId);
    if (container) {
      container.innerHTML = '';
    }
    // Also clean up any dynamic or duplicate containers across modules
    const dynamicContainers = document.querySelectorAll(
      `[id="${containerId}"], #profile-recaptcha-dynamic, #recaptcha-container-signup`
    );
    dynamicContainers.forEach((el, index) => {
      if (index > 0) {
        el.remove();
      } else {
        el.innerHTML = '';
      }
    });
  }
}

/**
 * Initializes or retrieves an invisible RecaptchaVerifier with proper teardown safeguards.
 */
export async function getOrCreateRecaptchaVerifier(
  auth: Auth,
  containerId: string = 'recaptcha-container',
  onExpired?: () => void
): Promise<RecaptchaVerifier> {
  // Clear any existing instance and container elements first
  clearRecaptchaInstance(containerId);

  let container = document.getElementById(containerId);
  if (!container) {
    container = document.createElement('div');
    container.id = containerId;
    document.body.appendChild(container);
  } else {
    container.innerHTML = '';
  }

  const verifier = new RecaptchaVerifier(auth, containerId, {
    size: 'invisible',
    callback: () => {},
    'expired-callback': () => {
      clearRecaptchaInstance(containerId);
      if (onExpired) onExpired();
    },
  });

  try {
    await verifier.render();
  } catch (renderErr: any) {
    if (!renderErr?.message?.includes('already been rendered')) {
      console.warn('[Recaptcha] Render notice:', renderErr);
    }
  }

  window.recaptchaVerifier = verifier;
  return verifier;
}
