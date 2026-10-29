/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

interface ImportMetaEnv {
  readonly VITE_RAZORPAY_KEY_ID?: string;
  readonly VITE_GOOGLE_MAPS_API_KEY?: string;
  readonly VITE_FIREBASE_API_KEY?: string;
  readonly VITE_FIREBASE_AUTH_DOMAIN?: string;
  readonly VITE_FIREBASE_PROJECT_ID?: string;
  readonly VITE_FIREBASE_STORAGE_BUCKET?: string;
  readonly VITE_FIREBASE_MESSAGING_SENDER_ID?: string;
  readonly VITE_FIREBASE_APP_ID?: string;
  readonly [key: string]: string | boolean | undefined;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

interface Window {
  Razorpay?: new (options: Record<string, any>) => {
    open: () => void;
    on: (event: string, callback: (response: any) => void) => void;
    close?: () => void;
  };
  SpeechRecognition?: any;
  webkitSpeechRecognition?: any;
  __showToast?: (message: string) => void;
  __showCopyToast?: (text: string) => void;
  __triggerTestNotification?: (custom?: any) => void;
  __ZOMINDIA_ONBOARDING_MODAL_VISIBLE?: boolean;
  isKeyboardInputActive?: boolean;
  deferredPrompt?: any;
  google?: any;
}

