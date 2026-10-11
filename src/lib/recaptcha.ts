import { Auth, RecaptchaVerifier } from 'firebase/auth';

let currentVerifier: RecaptchaVerifier | null = null;
let currentContainerId: string | null = null;

export const clearRecaptchaInstance = (_containerId?: string) => {
  // 1. Clear verifier instance
  if (currentVerifier) {
    try {
      currentVerifier.clear();
    } catch (e) {
      console.warn('[reCAPTCHA] Clear error:', e);
    }
    currentVerifier = null;
  }

  // 2. Remove previously created dynamic DOM containers
  if (typeof document !== 'undefined') {
    const elements = document.querySelectorAll('[id^="recaptcha-dynamic-container"]');
    elements.forEach((el) => el.remove());
    
    const staticEl = document.getElementById('recaptcha-container');
    if (staticEl) staticEl.innerHTML = '';

    if (_containerId) {
      const specificEl = document.getElementById(_containerId);
      if (specificEl) {
        if (specificEl.id.startsWith('recaptcha-dynamic-container')) {
          specificEl.remove();
        } else {
          specificEl.innerHTML = '';
        }
      }
    }
  }

  if (typeof window !== 'undefined' && (window as any).recaptchaVerifier) {
    try {
      (window as any).recaptchaVerifier.clear();
    } catch (e) {}
    (window as any).recaptchaVerifier = null;
  }
  currentContainerId = null;
};

export const getOrCreateRecaptchaVerifier = (
  auth: Auth,
  _containerId?: string,
  onExpired?: () => void
): RecaptchaVerifier => {
  // Always clear previous state completely
  clearRecaptchaInstance(_containerId);

  // Create a brand new unique DOM element attached to document.body
  const uniqueId = `recaptcha-dynamic-container-${Date.now()}`;
  const newDiv = document.createElement('div');
  newDiv.id = uniqueId;
  newDiv.style.display = 'none';
  document.body.appendChild(newDiv);
  currentContainerId = uniqueId;

  // Instantiate fresh verifier
  currentVerifier = new RecaptchaVerifier(auth, uniqueId, {
    size: 'invisible',
    callback: () => {
      console.log('[reCAPTCHA] Solved');
    },
    'expired-callback': () => {
      console.warn('[reCAPTCHA] Expired');
      clearRecaptchaInstance();
      if (onExpired) {
        try {
          onExpired();
        } catch (e) {}
      }
    }
  });

  (window as any).recaptchaVerifier = currentVerifier;
  return currentVerifier;
};

