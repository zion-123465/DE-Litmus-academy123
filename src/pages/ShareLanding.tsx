import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { FileText, Image as ImageIcon, Clock, Target, ShieldCheck, ArrowRight, Loader2, Eye } from 'lucide-react';
import { apiFetch, formatCategory, formatNGN } from '../lib/api';
import MaterialReader from '../components/MaterialReader';
import { useAuth } from '../contexts/AuthContext';

const LOGO_URL = 'https://www.designarena.ai/u/0af0c461-858d-45e6-8a72-5a9585d1cec0';

// Public share-landing page: /s/quiz/:id or /s/material/:id
// Anyone opening a copied link sees a rich preview card, then continues.
export default function ShareLanding() {
  const { kind, id } = useParams();
  const [item, setItem] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [reading, setReading] = useState(false);
  const { student } = useAuth();

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        if (kind === 'quiz') {
          const q = await apiFetch<any>(`/api/quizzes?id=${id}&with_counts=1`);
          if (!q || q.is_published === false) setNotFound(true);
          else {
            setItem(q);
            document.title = `${q.title} — De-Litmus Academy`;
          }
        } else if (kind === 'material') {
          const m = await apiFetch<any>(`/api/materials?id=${id}`);
          if (!m) setNotFound(true);
          else {
            setItem(m);
            document.title = `${m.title} — De-Litmus Academy`;
          }
        } else {
          setNotFound(true);
        }
      } catch {
        setNotFound(true);
      } finally {
        setLoading(false);
      }
    })();
  }, [kind, id]);

  if (loading) {
    return (
      <div className="min-h-screen bg-navy-950 hero-pattern flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-10 h-10 text-gold-400 animate-spin mx-auto" />
          <p className="text-white/60 text-sm mt-3">Opening shared link…</p>
        </div>
      </div>
    );
  }

  if (notFound || !item) {
    return (
      <div className="min-h-screen bg-navy-950 hero-pattern flex items-center justify-center px-4">
        <div className="text-center max-w-sm">
          <img src={LOGO_URL} alt="De-Litmus Academy" className="w-20 h-20 rounded-full object-cover mx-auto ring-2 ring-gold-400 mb-5" />
          <h1 className="font-display font-extrabold text-2xl text-white">Link unavailable</h1>
          <p className="text-white/60 text-sm mt-2">This quiz or material is no longer available or has been deactivated.</p>
          <Link to="/" className="mt-6 inline-block gold-btn font-bold text-sm px-6 py-3 rounded-xl">Go to Homepage</Link>
        </div>
      </div>
    );
  }

  const isQuiz = kind === 'quiz';

  return (
    <div className="min-h-screen bg-navy-950 hero-pattern flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md bg-white rounded-3xl card-shadow overflow-hidden">
        <div className="bg-navy-900 px-6 py-4 flex items-center gap-3">
          <img src={LOGO_URL} alt="De-Litmus Academy" className="w-11 h-11 rounded-full object-cover ring-2 ring-gold-400" />
          <div>
            <div className="font-display font-bold text-gold-300 text-sm">DE-LITMUS ACADEMY</div>
            <div className="text-[10px] uppercase tracking-[0.25em] text-white/50">Shared {isQuiz ? 'Quiz' : 'Material'}</div>
          </div>
        </div>

        <div className={isQuiz ? 'bg-navy-950 hero-pattern px-6 py-6 flex justify-center' : 'h-44 bg-navy-900 relative'}>
          {isQuiz ? (
            <img src={LOGO_URL} alt="De-Litmus Academy" className="w-32 h-32 rounded-full object-cover ring-2 ring-gold-400 shield-ring" />
          ) : item.cover_url ? (
            <img src={item.cover_url} alt={item.title} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center hero-pattern">
              {item.file_type === 'image' ? <ImageIcon className="w-12 h-12 text-gold-400/60" /> : <FileText className="w-12 h-12 text-gold-400/60" />}
            </div>
          )}
        </div>

        <div className="p-6">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="badge bg-navy-900 text-gold-300">{formatCategory(item.level)}</span>
            <span className="badge bg-navy-50 text-navy-800 border border-navy-100">{item.department}</span>
            {!isQuiz && (item.is_free || Number(item.price) <= 0 ? (
              <span className="badge bg-emerald-500 text-white">FREE</span>
            ) : (
              <span className="badge bg-gold-400 text-navy-950">{formatNGN(item.price)}</span>
            ))}
          </div>
          <h1 className="font-display font-extrabold text-xl text-navy-900 mt-3 leading-snug">{item.title}</h1>
          {item.description && <p className="text-sm text-gray-500 mt-2 line-clamp-3">{item.description}</p>}

          {isQuiz && (
            <div className="grid grid-cols-3 gap-2 mt-4 text-center">
              <div className="bg-navy-50 rounded-lg py-2">
                <Clock className="w-4 h-4 mx-auto text-navy-700" />
                <div className="text-xs font-bold text-navy-900 mt-1">{item.duration_minutes}m</div>
              </div>
              <div className="bg-navy-50 rounded-lg py-2">
                <Target className="w-4 h-4 mx-auto text-navy-700" />
                <div className="text-xs font-bold text-navy-900 mt-1">{item.pass_mark}% pass</div>
              </div>
              <div className="bg-navy-50 rounded-lg py-2">
                <ShieldCheck className="w-4 h-4 mx-auto text-navy-700" />
                <div className="text-xs font-bold text-navy-900 mt-1">{item.question_count ?? '?'} Qs</div>
              </div>
            </div>
          )}

          <div className="mt-5 space-y-2.5">
            {isQuiz ? (
              <Link
                to={`/portal/take-quiz/${item.id}`}
                className="w-full gold-btn font-bold text-sm py-3 rounded-xl flex items-center justify-center gap-2"
              >
                Take this Quiz <ArrowRight className="w-4 h-4" />
              </Link>
            ) : item.is_free || Number(item.price) <= 0 ? (
              <button
                onClick={() => setReading(true)}
                className="w-full gold-btn font-bold text-sm py-3 rounded-xl flex items-center justify-center gap-2"
              >
                <Eye className="w-4 h-4" /> Read Now (in-site)
              </button>
            ) : (
              <Link
                to="/materials"
                className="w-full gold-btn font-bold text-sm py-3 rounded-xl flex items-center justify-center gap-2"
              >
                View in Library <ArrowRight className="w-4 h-4" />
              </Link>
            )}
            <Link
              to="/"
              className="block text-center text-xs font-bold text-navy-700 hover:text-gold-600"
            >
              ← Back to De-Litmus Academy homepage
            </Link>
          </div>
        </div>
      </div>

      {!isQuiz && reading && (
        <MaterialReader
          open={reading}
          onClose={() => setReading(false)}
          title={item.title}
          subtitle={`${formatCategory(item.level)} · ${item.department}`}
          fileUrl={item.file_url}
          fileType={item.file_type}
          bodyText={item.body_text || null}
          studentName={student?.full_name}
        />
      )}
    </div>
  );
}