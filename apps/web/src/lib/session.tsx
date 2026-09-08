'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';

export interface Session {
  tenantId: string;
  accessToken: string;
  email: string;
}

interface SessionContextValue {
  session: Session | null;
  setSession: (session: Session | null) => void;
}

const SessionContext = createContext<SessionContextValue | undefined>(undefined);
const STORAGE_KEY = 'rwe-platform-session';

export function SessionProvider({ children }: { children: ReactNode }) {
  const [session, setSessionState] = useState<Session | null>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) setSessionState(JSON.parse(raw));
    } catch {
      // localStorage unavailable (private browsing, etc.) — fall back to an unauthenticated session
    }
    setHydrated(true);
  }, []);

  const setSession = (next: Session | null) => {
    setSessionState(next);
    try {
      if (next) window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      else window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore storage failures; session still works for this tab via React state
    }
  };

  if (!hydrated) return null;

  return <SessionContext.Provider value={{ session, setSession }}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionContextValue {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error('useSession must be used within a SessionProvider');
  return ctx;
}
