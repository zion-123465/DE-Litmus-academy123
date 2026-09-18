import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import { apiFetch, getAdminToken, setAdminToken, clearAdminToken } from '../lib/api';

interface AdminState {
  isAdmin: boolean;
  loading: boolean;
  login: (password: string) => Promise<void>;
  logout: () => void;
  verify: () => Promise<boolean>;
}

const AdminContext = createContext<AdminState>({
  isAdmin: false,
  loading: true,
  login: async () => {},
  logout: () => {},
  verify: async () => false,
});

export function AdminProvider({ children }: { children: ReactNode }) {
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  const verify = useCallback(async () => {
    const token = getAdminToken();
    if (!token) {
      setIsAdmin(false);
      setLoading(false);
      return false;
    }
    try {
      const data = await apiFetch<{ ok: boolean }>('/api/admin-auth', { admin: true });
      setIsAdmin(!!data.ok);
      if (!data.ok) clearAdminToken();
      setLoading(false);
      return !!data.ok;
    } catch {
      setIsAdmin(false);
      setLoading(false);
      return false;
    }
  }, []);

  useEffect(() => {
    verify();
  }, [verify]);

  const login = useCallback(async (password: string) => {
    const data = await apiFetch<{ ok: boolean; token: string }>('/api/admin-auth', {
      method: 'POST',
      body: JSON.stringify({ password }),
    });
    if (!data.ok || !data.token) throw new Error('Login failed');
    setAdminToken(data.token);
    setIsAdmin(true);
  }, []);

  const logout = useCallback(() => {
    clearAdminToken();
    setIsAdmin(false);
  }, []);

  return <AdminContext.Provider value={{ isAdmin, loading, login, logout, verify }}>{children}</AdminContext.Provider>;
}

export const useAdmin = () => useContext(AdminContext);
