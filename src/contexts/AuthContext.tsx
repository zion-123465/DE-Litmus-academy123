import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import supabase from '../lib/supabase';
import { apiFetch } from '../lib/api';

export interface Student {
  id: number;
  user_id: string;
  email: string;
  full_name: string;
  phone?: string | null;
  level?: string | null;
  department?: string | null;
  matric_no?: string | null;
  avatar_url?: string | null;
  created_at?: string;
}

interface AuthState {
  user: any;
  session: any;
  student: Student | null;
  loading: boolean;
  refreshStudent: () => Promise<Student | null>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthState>({
  user: null,
  session: null,
  student: null,
  loading: true,
  refreshStudent: async () => null,
  signOut: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<any>(null);
  const [session, setSession] = useState<any>(null);
  const [student, setStudent] = useState<Student | null>(null);
  const [loading, setLoading] = useState(true);

  const loadStudent = useCallback(async (u: any): Promise<Student | null> => {
    if (!u) {
      setStudent(null);
      return null;
    }
    try {
      const data = await apiFetch<Student | null>(`/api/students?user_id=${encodeURIComponent(u.id)}`);
      if (data) {
        setStudent(data);
        return data;
      }
      // Auto-create a basic student profile (e.g. Google sign-in first login)
      const fullName =
        u.user_metadata?.full_name || u.user_metadata?.name || (u.email ? u.email.split('@')[0] : 'Student');
      const created = await apiFetch<Student>('/api/students', {
        method: 'POST',
        body: JSON.stringify({ user_id: u.id, email: u.email, full_name: fullName }),
      });
      setStudent(created);
      return created;
    } catch (e) {
      console.error('loadStudent failed', e);
      setStudent(null);
      return null;
    }
  }, []);

  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!mounted) return;
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) await loadStudent(session.user);
      setLoading(false);
    });
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, sess) => {
      setSession(sess);
      setUser(sess?.user ?? null);
      if (sess?.user) await loadStudent(sess.user);
      else setStudent(null);
      setLoading(false);
    });
    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [loadStudent]);

  const refreshStudent = useCallback(async () => loadStudent(user), [loadStudent, user]);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setStudent(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, session, student, loading, refreshStudent, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
