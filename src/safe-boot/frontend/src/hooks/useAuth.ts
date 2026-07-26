/**
 * Authentication hook skeleton — provides auth state and actions.
 * ITS-V1: JWT from SecureStore + refresh token rotation.
 */

import { useState, useCallback } from 'react';

export function useAuth() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  const login = useCallback(async (_email: string, _password: string) => {
    // TODO: Implement against auth domain API
    return false;
  }, []);

  const logout = useCallback(async () => {
    setUserId(null);
    setIsAuthenticated(false);
    // TODO: Revoke session and clear SecureStore
  }, []);

  return { isAuthenticated, userId, login, logout };
}
