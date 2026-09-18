export const ADMIN_TOKEN_KEY = 'dla_admin_token';

export function getAdminToken(): string {
  try {
    return sessionStorage.getItem(ADMIN_TOKEN_KEY) || '';
  } catch {
    return '';
  }
}

export function setAdminToken(token: string) {
  try {
    sessionStorage.setItem(ADMIN_TOKEN_KEY, token);
  } catch {}
}

export function clearAdminToken() {
  try {
    sessionStorage.removeItem(ADMIN_TOKEN_KEY);
  } catch {}
}

type ApiOptions = RequestInit & { admin?: boolean };

export async function apiFetch<T = any>(path: string, options: ApiOptions = {}): Promise<T> {
  const { admin, headers, ...rest } = options;
  const h: Record<string, string> = { ...(headers as Record<string, string>) };
  if (rest.body && !h['Content-Type']) h['Content-Type'] = 'application/json';
  if (admin) h['X-Admin-Key'] = getAdminToken();
  const res = await fetch(path, { ...rest, headers: h });
  const text = await res.text();
  let data: any = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  if (!res.ok) {
    const msg = data && typeof data === 'object' && data.error ? data.error : `Request failed (${res.status})`;
    throw new Error(msg);
  }
  return data as T;
}

export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const s = String(reader.result || '');
      resolve(s.includes(',') ? s.split(',')[1] : s);
    };
    reader.onerror = () => reject(new Error('Could not read file'));
    reader.readAsDataURL(file);
  });
}

export async function uploadFile(file: File, folder = 'uploads'): Promise<{ url: string; path: string }> {
  const fileBase64 = await fileToBase64(file);
  return apiFetch('/api/upload', {
    method: 'POST',
    body: JSON.stringify({ fileName: file.name, fileBase64, contentType: file.type, folder }),
  });
}

export function formatNGN(n: number | string | null | undefined): string {
  const v = Number(n) || 0;
  return '₦' + v.toLocaleString('en-NG');
}

export function parseSetting(row: any): any {
  if (!row) return null;
  const v = row.value;
  if (typeof v !== 'string') return v;
  try {
    return JSON.parse(v);
  } catch {
    return v;
  }
}

export function timeAgo(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso).getTime();
  if (isNaN(d)) return '—';
  const s = Math.floor((Date.now() - d) / 1000);
  if (s < 60) return 'just now';
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const days = Math.floor(h / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleString('en-NG', { dateStyle: 'medium', timeStyle: 'short' });
}

export function formatDuration(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(Number(totalSeconds) || 0));
  const m = Math.floor(s / 60);
  const r = s % 60;
  if (m <= 0) return `${r}s`;
  if (m < 60) return `${m}m ${r}s`;
  return `${Math.floor(m / 60)}h ${m % 60}m`;
}

// Audience-aware category label: university levels keep "N Level",
// exam tracks like WAEC / JAMB display as-is.
const EXAM_TRACKS = ['WAEC', 'JAMB', 'NECO', 'NABTEB', 'POST-UTME', 'POST UTME'];

export function formatCategory(level: string | null | undefined): string {
  const v = String(level || '').trim();
  if (!v || v === '—') return '—';
  if (EXAM_TRACKS.includes(v.toUpperCase())) return v.toUpperCase();
  if (/^\d+$/.test(v)) return `${v} Level`;
  return v;
}

// Department-aware: exam tracks use subjects, university uses departments.
export function isExamTrack(level: string | null | undefined): boolean {
  return EXAM_TRACKS.includes(String(level || '').trim().toUpperCase());
}
