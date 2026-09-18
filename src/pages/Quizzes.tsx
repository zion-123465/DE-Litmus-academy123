import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Search, Clock, Target, ArrowRight, ShieldCheck } from 'lucide-react';
import { apiFetch, formatCategory, formatNGN, parseSetting } from '../lib/api';
import CopyLinkButton from '../components/CopyLinkButton';
import Spinner from '../components/Spinner';
import { EmptyState } from '../components/ui';

interface Quiz {
  id: number;
  title: string;
  description?: string | null;
  level: string;
  department: string;
  duration_minutes: number;
  pass_mark: number;
  price: number;
  question_count?: number;
}

export default function Quizzes() {
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [level, setLevel] = useState('');
  const [levels, setLevels] = useState<string[]>(['100', '200', '300', 'WAEC', 'JAMB']);
  const [globalPrice, setGlobalPrice] = useState(1500);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const [data, rows] = await Promise.all([
          apiFetch<Quiz[]>('/api/quizzes?published_only=1&with_counts=1'),
          apiFetch<any[]>('/api/settings'),
        ]);
        setQuizzes(data);
        const lv = rows.find((r) => r.key === 'levels');
        if (lv) {
          const p = parseSetting(lv);
          if (p?.items?.length) setLevels(p.items);
        }
        const gp = rows.find((r) => r.key === 'quiz_code_price');
        if (gp) {
          const p = parseSetting(gp);
          if (p?.amount) setGlobalPrice(p.amount);
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return quizzes.filter((z) => {
      if (level && z.level !== level) return false;
      if (q && !`${z.title} ${z.description || ''} ${z.department}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [quizzes, search, level]);

  return (
    <div className="bg-navy-50/50 min-h-screen">
      <section className="bg-navy-950 hero-pattern py-12 md:py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <h1 className="font-display font-extrabold text-3xl md:text-4xl text-white">Quiz <span className="gold-text">Centre</span></h1>
          <p className="text-white/65 mt-2 max-w-2xl text-sm md:text-base">
            Proctored CBT exams with camera + noise monitoring. Buy a code, enter the hall, answer and get your score instantly.
          </p>
          <div className="mt-6 bg-white rounded-2xl p-3 md:p-4 card-shadow grid gap-3 md:grid-cols-[1fr_180px]">
            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input className="input-field pl-10" placeholder="Search quizzes…" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <select className="input-field" value={level} onChange={(e) => setLevel(e.target.value)}>
              <option value="">All categories</option>
              {levels.map((l) => (
                <option key={l} value={l}>{formatCategory(l)}</option>
              ))}
            </select>
          </div>
        </div>
      </section>

      <section className="max-w-7xl mx-auto px-4 sm:px-6 py-10">
        {loading ? (
          <Spinner label="Loading quizzes…" />
        ) : filtered.length === 0 ? (
          <EmptyState title="No quizzes available" message="Check back soon — new exams are added regularly." />
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {filtered.map((z) => {
              const price = Number(z.price) > 0 ? Number(z.price) : globalPrice;
              return (
                <div key={z.id} className="bg-white rounded-2xl border border-navy-100 p-6 card-shadow hover:border-gold-400 transition flex flex-col">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="badge bg-navy-900 text-gold-300">{formatCategory(z.level)}</span>
                    <span className="badge bg-navy-50 text-navy-800 border border-navy-100">{z.department}</span>
                  </div>
                  <h3 className="font-bold text-navy-900 text-lg leading-snug">{z.title}</h3>
                  {z.description && <p className="text-sm text-gray-500 mt-2 line-clamp-2">{z.description}</p>}
                  <div className="grid grid-cols-3 gap-2 mt-4 text-center">
                    <div className="bg-navy-50 rounded-lg py-2">
                      <Clock className="w-4 h-4 mx-auto text-navy-700" />
                      <div className="text-xs font-bold text-navy-900 mt-1">{z.duration_minutes}m</div>
                    </div>
                    <div className="bg-navy-50 rounded-lg py-2">
                      <Target className="w-4 h-4 mx-auto text-navy-700" />
                      <div className="text-xs font-bold text-navy-900 mt-1">{z.pass_mark}% pass</div>
                    </div>
                    <div className="bg-navy-50 rounded-lg py-2">
                      <ShieldCheck className="w-4 h-4 mx-auto text-navy-700" />
                      <div className="text-xs font-bold text-navy-900 mt-1">{z.question_count ?? '?'} Qs</div>
                    </div>
                  </div>
                  <div className="mt-4 pt-4 border-t border-navy-50 flex items-center justify-between gap-2">
                    <div className="font-extrabold text-navy-900">{formatNGN(price)}<span className="text-xs font-medium text-gray-400"> / code</span></div>
                    <div className="flex items-center gap-2">
                      <CopyLinkButton
                        id={z.id}
                        kind="quiz"
                        title={z.title}
                        subtitle={z.description || `${formatCategory(z.level)} · ${z.department} · ${z.question_count ?? '?'} questions`}
                        priceLabel={`${formatNGN(price)} / code`}
                        compact
                      />
                      <Link to={`/portal/take-quiz/${z.id}`} className="flex items-center gap-1.5 text-sm font-bold text-navy-950 bg-gold-400 hover:bg-gold-300 px-4 py-2 rounded-lg transition">
                        Start <ArrowRight className="w-4 h-4" />
                      </Link>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
