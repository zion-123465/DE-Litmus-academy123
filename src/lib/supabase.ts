import { createClient } from '@supabase/supabase-js';

const url =
  import.meta.env.VITE_SUPABASE_URL ||
  (import.meta as any).env?.NEXT_PUBLIC_SUPABASE_URL ||
  (process as any).env?.VITE_SUPABASE_URL ||
  (process as any).env?.NEXT_PUBLIC_SUPABASE_URL ||
  '';

const anonKey =
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  (import.meta as any).env?.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  (process as any).env?.VITE_SUPABASE_ANON_KEY ||
  (process as any).env?.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  '';

const supabase = createClient(url, anonKey);

export default supabase;
