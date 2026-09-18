import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Search, FileText, Image as ImageIcon, BookOpen, Lock, Filter, Loader2, Eye } from 'lucide-react';
import { apiFetch, formatCategory, formatNGN, parseSetting } from '../lib/api';
import CopyLinkButton from '../components/CopyLinkButton';
import MaterialReader from '../components/MaterialReader';
import { useAuth } from '../contexts/AuthContext';
import Spinner from '../components/Spinner';
import { EmptyState } from '../components/ui';

interface Material {
  id: number;
  title: string;
  description?: string | null;
  level: string;
  department: string;
  file_url: string;
  file_type: string;
  cover_url?: string | null;
  price: number;
  is_free: boolean;
  downloads: number;
  body_text?: string | null;
  created_at: string;
}

export default function Materials() {
  const { student } = useAuth();
  const [materials, setMaterials] = useState<Material[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [level, setLevel] = useState('');
  const [department, setDepartment] = useState('');
  const [levels, setLevels] = useState<string[]>(['100', '200', '300', 'WAEC', 'JAMB']);
  const [departments, setDepartments] = useState<string[]>([]);
  const [myBooks, setMyBooks] = useState<Set<number>>(new Set());
  const [reading, setReading] = useState<Material | null>(null);

  useEffect(() => {
    fetchMaterials();
    fetchSettings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (student) fetchMyBooks();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [student?.id]);

  const fetchMaterials = async () => {
    setLoading(true);
    try {
      const data = await apiFetch<Material[]>('/api/materials?limit=200');
      setMaterials(data);
      const deps = [...new Set(data.map((m) => m.department).filter(Boolean))];
      setDepartments((prev) => (prev.length ? prev : deps));
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const fetchSettings = async () => {
    try {
      const rows = await apiFetch<any[]>('/api/settings');
      const lv = rows.find((r) => r.key === 'levels');
      const dp = rows.find((r) => r.key === 'departments');
      if (lv) {
        const p = parseSetting(lv);
        if (p?.items?.length) setLevels(p.items);
      }
      if (dp) {
        const p = parseSetting(dp);
        if (p?.items?.length) setDepartments(p.items);
      }
    } catch {}
  };

  const fetchMyBooks = async () => {
    try {
      const pays = await apiFetch<any[]>(`/api/payments?student_id=${student!.id}&item_type=book`);
      setMyBooks(new Set(pays.filter((p) => p.status === 'approved').map((p) => Number(p.item_id))));
    } catch {}
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return materials.filter((m) => {
      if (level && m.level !== level) return false;
      if (department && m.department !== department) return false;
      if (q && !`${m.title} ${m.description || ''} ${m.department}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [materials, search, level, department]);

  const handleRead = async (m: Material) => {
    try {
      await apiFetch('/api/materials', { method: 'PUT', body: JSON.stringify({ id: m.id, action: 'download' }) });
    } catch {}
    setReading(m);
  };

  const canAccess = (m: Material) => m.is_free || Number(m.price) <= 0 || (student && myBooks.has(m.id));

  return (
    <div className="bg-navy-50/50 min-h-screen">
      <section className="bg-navy-950 hero-pattern py-12 md:py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <h1 className="font-display font-extrabold text-3xl md:text-4xl text-white">Academy <span className="gold-text">Library</span></h1>
          <p className="text-white/65 mt-2 max-w-2xl text-sm md:text-base">
            Search study materials by keyword, category (100 / 200 / 300 / WAEC / JAMB) and department. Paid books unlock only after your payment is approved by the AI or admin. All reading happens securely inside this website — no downloads.
          </p>
          <div className="mt-6 bg-white rounded-2xl p-3 md:p-4 card-shadow grid gap-3 md:grid-cols-[1fr_160px_200px]">
            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                className="input-field pl-10"
                placeholder="Search by title, topic or keyword…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <select className="input-field" value={level} onChange={(e) => setLevel(e.target.value)}>
              <option value="">All categories</option>
              {levels.map((l) => (
                <option key={l} value={l}>{formatCategory(l)}</option>
              ))}
            </select>
            <select className="input-field" value={department} onChange={(e) => setDepartment(e.target.value)}>
              <option value="">All departments</option>
              {departments.map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-white/60">
            <Filter className="w-3.5 h-3.5" />
            <span>{filtered.length} result{filtered.length === 1 ? '' : 's'}</span>
            {(level || department || search) && (
              <button
                onClick={() => { setLevel(''); setDepartment(''); setSearch(''); }}
                className="ml-2 text-gold-300 font-bold hover:underline"
              >
                Clear filters
              </button>
            )}
          </div>
        </div>
      </section>

      <section className="max-w-7xl mx-auto px-4 sm:px-6 py-10">
        {loading ? (
          <Spinner label="Loading library…" />
        ) : filtered.length === 0 ? (
          <EmptyState title="No materials found" message="Try a different keyword, level or department." />
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {filtered.map((m) => {
              const access = canAccess(m);
              const paid = Number(m.price) > 0 && !m.is_free;
              return (
                <div key={m.id} className="bg-white rounded-2xl border border-navy-100 overflow-hidden card-shadow hover:border-gold-400 transition flex flex-col">
                  <div className="h-40 bg-navy-900 relative overflow-hidden">
                    {m.cover_url ? (
                      <img src={m.cover_url} alt={m.title} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center hero-pattern">
                        {m.file_type === 'image' ? (
                          <ImageIcon className="w-12 h-12 text-gold-400/60" />
                        ) : (
                          <FileText className="w-12 h-12 text-gold-400/60" />
                        )}
                      </div>
                    )}
                    <div className="absolute top-3 left-3 flex gap-2">
                      <span className="badge bg-navy-950/90 text-gold-300">{formatCategory(m.level)}</span>
                      <span className="badge bg-white/90 text-navy-900">{(m.file_type || 'PDF').toUpperCase()}</span>
                    </div>
                    <div className="absolute top-3 right-3">
                      {paid ? (
                        <span className="badge bg-gold-400 text-navy-950">{formatNGN(m.price)}</span>
                      ) : (
                        <span className="badge bg-emerald-500 text-white">FREE</span>
                      )}
                    </div>
                  </div>
                  <div className="p-5 flex flex-col flex-1">
                    <div className="text-[11px] font-bold uppercase tracking-wider text-gold-600">{m.department}</div>
                    <h3 className="font-bold text-navy-900 mt-1 leading-snug">{m.title}</h3>
                    {m.description && <p className="text-sm text-gray-500 mt-2 line-clamp-2">{m.description}</p>}
                    <div className="text-xs text-gray-400 mt-3 flex items-center gap-1"><BookOpen className="w-3.5 h-3.5" /> {m.downloads || 0} reads · In-site reader only</div>
                    <div className="mt-3">
                      <CopyLinkButton
                        id={m.id}
                        kind="material"
                        title={m.title}
                        subtitle={`${formatCategory(m.level)} · ${m.department}${m.description ? ' — ' + m.description : ''}`}
                        imageUrl={m.cover_url}
                        fileUrl={m.file_url}
                        fileType={m.file_type}
                        priceLabel={paid ? formatNGN(m.price) : 'FREE'}
                        compact
                      />
                    </div>
                    <div className="mt-4 pt-4 border-t border-navy-50 flex gap-2">
                      {access ? (
                        <button
                          onClick={() => handleRead(m)}
                          className="flex-1 flex items-center justify-center gap-2 gold-btn font-bold text-sm px-4 py-2.5 rounded-xl"
                        >
                          <Eye className="w-4 h-4" /> Read Now
                        </button>
                      ) : (
                        <Link
                          to={student ? `/portal/buy-book/${m.id}` : '/login'}
                          className="flex-1 flex items-center justify-center gap-2 bg-navy-900 hover:bg-navy-800 text-gold-300 font-bold text-sm px-4 py-2.5 rounded-xl transition"
                        >
                          <Lock className="w-4 h-4" /> Buy to Access
                        </Link>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {reading && (
        <MaterialReader
          open={!!reading}
          onClose={() => setReading(null)}
          title={reading.title}
          subtitle={`${formatCategory(reading.level)} · ${reading.department}`}
          fileUrl={reading.file_url}
          fileType={reading.file_type}
          bodyText={(reading as any).body_text || null}
          studentName={student?.full_name}
        />
      )}
    </div>
  );
}

export function MaterialsLoadingFallback() {
  return (
    <div className="flex justify-center py-10">
      <Loader2 className="w-6 h-6 animate-spin text-navy-700" />
    </div>
  );
}
