import React, { createContext, useContext, useState, useEffect } from 'react';
import { auth, db } from '../lib/firebase';
import { doc, onSnapshot } from 'firebase/firestore';

interface PremiumContextType {
  isPremium: boolean;
}

const PremiumContext = createContext<PremiumContextType>({ isPremium: false });

export const PremiumProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isPremium, setIsPremium] = useState<boolean>(false);

  useEffect(() => {
    const unsubAuth = auth.onAuthStateChanged((user) => {
      if (!user) {
        setIsPremium(false);
        return;
      }
      
      const userRef = doc(db, 'users', user.uid);
      const unsubSnap = onSnapshot(userRef, (snap) => {
        if (snap.exists()) {
          const data = snap.data();
          setIsPremium(!!data.isPremium);
        } else {
          setIsPremium(false);
        }
      }, (err) => {
        console.warn("Non-blocking error reading isPremium in PremiumProvider:", err);
      });
      
      return () => unsubSnap();
    });

    return () => unsubAuth();
  }, []);

  return (
    <PremiumContext.Provider value={{ isPremium }}>
      {children}
    </PremiumContext.Provider>
  );
};

export const usePremium = () => useContext(PremiumContext);
