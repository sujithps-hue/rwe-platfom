'use client';

import { useCallback } from 'react';
import { apiFetch } from './api-client';
import { useSession } from './session';

/** Returns a fetch function pre-bound to the current session's tenant/token, and whether a session exists yet. */
export function useAuthedApi() {
  const { session } = useSession();

  const call = useCallback(
    <T,>(path: string, options: { method?: string; body?: unknown } = {}) => {
      if (!session) return Promise.reject(new Error('Not signed in'));
      return apiFetch<T>(path, { ...options, tenantId: session.tenantId, accessToken: session.accessToken });
    },
    [session],
  );

  return { call, session };
}
