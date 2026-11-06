import * as SecureStore from 'expo-secure-store';
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';

// "Has this phone seen the onboarding?" One flag in secure storage (the only storage the app ships with).
// The onboarding shows on first launch, and again whenever `replay()` is called (Akun → Pengaturan).
const SEEN_KEY = 'swms.onboarding.seen';

interface OnboardingContextValue {
  ready: boolean; // the flag has been read
  visible: boolean;
  finish: () => void;
  replay: () => void;
}

const OnboardingContext = createContext<OnboardingContextValue | null>(null);

export function useOnboarding() {
  const value = useContext(OnboardingContext);
  if (!value) {
    throw new Error('useOnboarding must be used inside <OnboardingProvider>');
  }
  return value;
}

export function OnboardingProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    SecureStore.getItemAsync(SEEN_KEY)
      .then((seen) => setVisible(seen !== '1'))
      .catch(() => setVisible(false)) // storage unreadable: never block the app on it
      .finally(() => setReady(true));
  }, []);

  const finish = useCallback(() => {
    setVisible(false);
    SecureStore.setItemAsync(SEEN_KEY, '1').catch(() => {});
  }, []);

  const replay = useCallback(() => setVisible(true), []);

  return <OnboardingContext.Provider value={{ ready, visible, finish, replay }}>{children}</OnboardingContext.Provider>;
}
