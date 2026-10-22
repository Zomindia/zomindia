import { useState, useEffect } from 'react';
import { doc, onSnapshot, setDoc, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';

export interface HeroBgConfig {
  bgType: 'gradient' | 'image' | 'gif';
  bgUrl: string;
  overlayOpacity: number; // 0 - 95, default 85
}

export const DEFAULT_HERO_BG: HeroBgConfig = {
  bgType: 'gradient',
  bgUrl: '',
  overlayOpacity: 85,
};

const STORAGE_KEY = 'zomindia_hero_canvas_settings';

export const getStoredHeroCanvasConfig = (): HeroBgConfig => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        bgType: parsed.bgType || 'gradient',
        bgUrl: typeof parsed.bgUrl === 'string' ? parsed.bgUrl : '',
        overlayOpacity: typeof parsed.overlayOpacity === 'number' ? parsed.overlayOpacity : 85,
      };
    }
  } catch (err) {
    console.warn('Failed to parse cached hero canvas settings:', err);
  }
  return DEFAULT_HERO_BG;
};

export const saveHeroCanvasConfig = async (config: HeroBgConfig): Promise<void> => {
  // 1. Immediately cache in localStorage for instant local responsiveness
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
  } catch (e) {
    console.error('LocalStorage write failed:', e);
  }

  // 2. Dispatch window event for instant in-tab and cross-component updates
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('hero-canvas-updated', { detail: config }));
  }

  // 3. Persist to Firestore system_settings
  try {
    const docRef = doc(db, 'system_settings', 'hero_canvas');
    await setDoc(docRef, {
      ...config,
      updatedAt: new Date().toISOString(),
    }, { merge: true });
  } catch (err) {
    console.error('Error saving hero canvas to Firestore:', err);
    // Fallback: also try 'settings' collection if permitted
    try {
      await setDoc(doc(db, 'settings', 'hero_canvas'), {
        ...config,
        updatedAt: new Date().toISOString(),
      }, { merge: true });
    } catch {
      // Ignored
    }
  }
};

export const useHeroCanvasConfig = () => {
  const [heroBg, setHeroBg] = useState<HeroBgConfig>(getStoredHeroCanvasConfig);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    // Listen for local custom events (instant updates)
    const handleLocalUpdate = (e: Event) => {
      const customEvent = e as CustomEvent<HeroBgConfig>;
      if (customEvent.detail) {
        setHeroBg(customEvent.detail);
      }
    };
    window.addEventListener('hero-canvas-updated', handleLocalUpdate);

    // Also listen to storage events across tabs
    const handleStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY && e.newValue) {
        try {
          setHeroBg(JSON.parse(e.newValue));
        } catch {
          // Ignored
        }
      }
    };
    window.addEventListener('storage', handleStorage);

    // Real-time Firestore sync
    let unsubscribe = () => {};
    try {
      const docRef = doc(db, 'system_settings', 'hero_canvas');
      unsubscribe = onSnapshot(docRef, (snapshot) => {
        setLoading(false);
        if (snapshot.exists()) {
          const data = snapshot.data();
          const synced: HeroBgConfig = {
            bgType: data.bgType || 'gradient',
            bgUrl: typeof data.bgUrl === 'string' ? data.bgUrl : '',
            overlayOpacity: typeof data.overlayOpacity === 'number' ? data.overlayOpacity : 85,
          };
          setHeroBg(synced);
          localStorage.setItem(STORAGE_KEY, JSON.stringify(synced));
        }
      }, (err) => {
        console.warn('Firestore hero canvas snapshot error:', err);
        setLoading(false);
      });
    } catch (e) {
      console.warn('Could not subscribe to hero canvas config:', e);
      setLoading(false);
    }

    return () => {
      window.removeEventListener('hero-canvas-updated', handleLocalUpdate);
      window.removeEventListener('storage', handleStorage);
      unsubscribe();
    };
  }, []);

  return { heroBg, setHeroBg, saveHeroBg: saveHeroCanvasConfig, loading };
};
