import { Auth, RecaptchaVerifier } from 'firebase/auth';

let recaptchaVerifierInstance: RecaptchaVerifier | null = null;

export const clearRecaptchaInstance = (containerId: string = 'recaptcha-container') => {
  if (recaptchaVerifierInstance) {
    try {
      recaptchaVerifierInstance.clear();
    } catch (e) {
      console.warn('[reCAPTCHA] Error clearing instance:', e);
    }
    recaptchaVerifierInstance = null;
  }
  if (typeof document !== 'undefined') {
    const el = document.getElementById(containerId) || document.getElementById('recaptcha-container');
    if (el) {
      el.innerHTML = '';
    }
    const dynamicContainers = document.querySelectorAll(
      `[id="${containerId}"], #recaptcha-container, #profile-recaptcha-dynamic, #recaptcha-container-signup`
    );
    dynamicContainers.forEach((elem, index) => {
      if (index > 0) {
        elem.remove();
      } else {
        elem.innerHTML = '';
      }
    });
  }
  if (typeof window !== 'undefined' && (window as any).recaptchaVerifier) {
    try {
      (window as any).recaptchaVerifier.clear();
    } catch (e) {}
    (window as any).recaptchaVerifier = null;
  }
};

export const getOrCreateRecaptchaVerifier = (
  auth: Auth,
  containerId: string = 'recaptcha-container',
  onExpired?: () => void
): RecaptchaVerifier => {
  let container = document.getElementById(containerId) || document.getElementById('recaptcha-container');
  if (!container) {
    container = document.createElement('div');
    container.id = containerId;
    document.body.appendChild(container);
  }

  // If already exists and element is intact, return existing instance
  if (recaptchaVerifierInstance) {
    return recaptchaVerifierInstance;
  }

  // Clean slate before instantiating
  container.innerHTML = '';

  recaptchaVerifierInstance = new RecaptchaVerifier(auth, container.id, {
    size: 'invisible',
    callback: () => {
      console.log('[reCAPTCHA] Solved');
    },
    'expired-callback': () => {
      console.warn('[reCAPTCHA] Expired, resetting...');
      clearRecaptchaInstance(containerId);
      if (onExpired) onExpired();
    }
  });

  (window as any).recaptchaVerifier = recaptchaVerifierInstance;
  return recaptchaVerifierInstance;
};
