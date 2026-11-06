import { t, translateBackendMessage } from '@/constants/strings';
import * as SecureStore from 'expo-secure-store';
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';

import { ApiError, setAuthToken, setUnauthorizedHandler } from '@/lib/api';
import * as authService from '@/services/auth';
import type { User } from '@/types/api';

const TOKEN_KEY = 'swms.token';
const ADMIN_MESSAGE = t.session.adminOnly;
const EXPIRED_MESSAGE = t.session.expired;

// loading:    reading the saved token / checking it with the server
// signed-out: no valid session (show login)
// signed-in:  `user` is set
// offline:    a token is saved but the server could not be reached (show "retry", keep the token)
type SessionStatus = 'loading' | 'signed-out' | 'signed-in' | 'offline';

interface SessionContextValue {
  status: SessionStatus;
  user: User | null;
  notice: string | null; // message for the login screen, e.g. "session expired"
  signIn: (email: string, password: string) => Promise<void>;
  // 'verify' = email verification is on: the account exists, the code screen comes next (no session yet)
  signUp: (fullName: string, email: string, password: string) => Promise<'signed-in' | 'verify'>;
  verifyEmail: (email: string, code: string) => Promise<void>;
  signOut: (notice?: string) => Promise<void>;
  setUser: (user: User) => void; // after a profile change
  retry: () => void;
}

const SessionContext = createContext<SessionContextValue | null>(null);

export function useSession() {
  const value = useContext(SessionContext);
  if (!value) {
    throw new Error('useSession must be used inside <SessionProvider>');
  }
  return value;
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<SessionStatus>('loading');
  const [user, setUser] = useState<User | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const signOut = useCallback(async (message?: string) => {
    setAuthToken(null);
    await SecureStore.deleteItemAsync(TOKEN_KEY);
    setUser(null);
    setNotice(message ?? null);
    setStatus('signed-out');
  }, []);

  // Only role "user" may use the app. Admins are never stored.
  const startSession = useCallback(async (token: string, signedInUser: User) => {
    if (signedInUser.role !== 'user') {
      throw new ApiError(403, ADMIN_MESSAGE);
    }
    await SecureStore.setItemAsync(TOKEN_KEY, token);
    setAuthToken(token);
    setUser(signedInUser);
    setNotice(null);
    setStatus('signed-in');
  }, []);

  const signIn = useCallback(
    async (email: string, password: string) => {
      const { token, user: signedInUser } = await authService.login(email, password);
      await startSession(token, signedInUser);
    },
    [startSession]
  );

  const signUp = useCallback(
    async (fullName: string, email: string, password: string) => {
      const result = await authService.register(fullName, email, password);
      if (!('token' in result)) {
        return 'verify';
      }
      await startSession(result.token, result.user);
      return 'signed-in';
    },
    [startSession]
  );

  const verifyEmail = useCallback(
    async (email: string, code: string) => {
      const { token, user: verifiedUser } = await authService.verifyEmail(email, code);
      await startSession(token, verifiedUser);
    },
    [startSession]
  );

  // Checks the saved token (if any) with GET /api/auth/me.
  const checkSavedToken = useCallback(async (token: string | null) => {
    if (!token) {
      setStatus('signed-out');
      return;
    }

    setAuthToken(token);
    try {
      const { user: savedUser } = await authService.getMe();
      if (savedUser.role !== 'user') {
        await signOut(ADMIN_MESSAGE);
        return;
      }
      setUser(savedUser);
      setStatus('signed-in');
    } catch (error) {
      if (error instanceof ApiError && error.status === 0) {
        setStatus('offline'); // server unreachable: keep the token so the user can retry
        return;
      }
      // 403 = account deactivated (show the server's message); anything else = invalid/expired token
      await signOut(error instanceof ApiError && error.status === 403 ? translateBackendMessage(error.message) : EXPIRED_MESSAGE);
    }
  }, [signOut]);

  // On app start: read the saved token, then check it (state only changes in the callback).
  useEffect(() => {
    SecureStore.getItemAsync(TOKEN_KEY).then(checkSavedToken);
  }, [checkSavedToken]);

  // Any 401 from the API later (e.g. the token expired) signs the user out.
  useEffect(() => {
    setUnauthorizedHandler(() => {
      signOut(EXPIRED_MESSAGE);
    });
    return () => setUnauthorizedHandler(null);
  }, [signOut]);

  const retry = useCallback(() => {
    setStatus('loading');
    SecureStore.getItemAsync(TOKEN_KEY).then(checkSavedToken);
  }, [checkSavedToken]);

  return (
    <SessionContext.Provider value={{ status, user, notice, signIn, signUp, verifyEmail, signOut, setUser, retry }}>
      {children}
    </SessionContext.Provider>
  );
}
