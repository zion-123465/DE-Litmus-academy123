import { useEffect, useRef, useState } from 'react';
import { Camera, Mic, RefreshCw, AlertTriangle, CheckCircle2, XCircle, Eye, Maximize2, X } from 'lucide-react';
import { apiFetch, formatCategory, timeAgo } from '../../lib/api';
import Spinner from '../../components/Spinner';
import { EmptyState } from '../../components/ui';

interface Feed {
  id: number;
  attempt_id: number;
  student_id: number;
  image: string | null;
  warnings: number;
  mic_level: number;
  face_visible: boolean;
  gaze_ok: boolean;
  answered: number;
  total: number;
  updated_at: string;
  student: { id: number; full_name: string; email: string; matric_no: string | null; level: string | null; department: string | null } | null;
  quiz: { id: number; title: string } | null;
}

export default function AdminLiveMonitor() {
  const [feeds, setFeeds] = useState<Feed[]>([]);
  const [loading, setLoading] = useState(true);
  const [auto, setAuto] = useState(true);
  const [focus, setFocus] = useState<Feed | null>(null);
  const autoRef = useRef(true);
  autoRef.current = auto;

  const fetchFeeds = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const d = await apiFetch<Feed[]>('/api/live-feed', { admin: true });
      setFeeds(d);
    } catch (e) {
      console.error(e);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    fetchFeeds();
    const t = setInterval(() => {
      if (autoRef.current) fetchFeeds(true);
    }, 4000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (focus) {
      const updated = feeds.find((f) => f.attempt_id === focus.attempt_id);
      if (updated) setFocus(updated);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [feeds]);

  useEffect(() => {
    if (!focus) return;
    const fn = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setFocus(null);
    };
    window.addEventListener('keydown', fn);
    return () => window.removeEventListener('keydown', fn);
  }, [focus]);

  if (loading) return <Spinner label="Connecting to live feeds…" />;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-display font-extrabold text-2xl text-navy-900 flex items-center gap-2">
            Live Exam Monitor
            {feeds.length > 0 && (
              <span className="badge bg-red-600 text-white proctor-pulse">● {feeds.length} LIVE</span>
            )}
          </h1>
          <p className="text-sm text-gray-500">Watch students writing right now — live camera snapshots, warnings and mic levels.</p>
        </div>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-2 text-xs font-bold text-navy-900 bg-white border border-navy-100 rounded-xl px-3 py-2.5 cursor-pointer">
            <input type="checkbox" checked={auto} onChange={(e) => setAuto(e.target.checked)} className="w-4 h-4 accent-yellow-600" />
            Auto-refresh
          </label>
          <button onClick={() => fetchFeeds()} className="flex items-center gap-1.5 border border-navy-100 bg-white hover:border-gold-400 font-bold text-sm px-4 py-2.5 rounded-xl text-navy-900">
            <RefreshCw className="w-4 h-4" /> Refresh
          </button>
        </div>
      </div>

      {feeds.length === 0 ? (
        <EmptyState
          title="No students writing right now"
          message="When a student enters the exam hall, their live camera feed appears here automatically."
        />
      ) : (
        <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-5">
          {feeds.map((f) => {
            const pct = f.total > 0 ? Math.round((f.answered / f.total) * 100) : 0;
            const danger = f.warnings >= 15;
            return (
              <div key={f.attempt_id} className="bg-white rounded-2xl border border-navy-100 overflow-hidden card-shadow">
                <button
                  onClick={() => setFocus(f)}
                  title="Click to enlarge — crystal clear view"
                  className="relative aspect-video bg-navy-950 w-full block cursor-zoom-in group"
                >
                  {f.image ? (
                    <img src={f.image} alt="Live student camera" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center text-white/40 gap-2">
                      <Camera className="w-8 h-8" />
                      <span className="text-xs font-semibold">Waiting for camera…</span>
                    </div>
                  )}
                  <span className="absolute top-2 left-2 badge bg-red-600 text-white proctor-pulse">● LIVE</span>
                  <span className={`absolute top-2 right-2 badge ${danger ? 'bg-red-600 text-white' : f.warnings > 0 ? 'bg-amber-500 text-navy-950' : 'bg-emerald-500 text-white'}`}>
                    <AlertTriangle className="w-3 h-3" /> {f.warnings} warnings
                  </span>
                  <span className="absolute bottom-2 right-2 badge bg-navy-950/80 text-gold-300 opacity-0 group-hover:opacity-100 transition">
                    <Maximize2 className="w-3 h-3" /> Enlarge
                  </span>
                </button>
                <div className="p-4">
                  <div className="font-bold text-navy-900 text-sm truncate">{f.student?.full_name || `Student #${f.student_id}`}</div>
                  <div className="text-[11px] text-gray-500 truncate">
                    {f.student?.matric_no || 'No reg. no.'} · {f.student?.level ? formatCategory(f.student.level) : ''} {f.student?.department || ''}
                  </div>
                  <div className="text-xs font-semibold text-gold-700 mt-1 truncate">{f.quiz?.title || `Quiz attempt #${f.attempt_id}`}</div>

                  <div className="mt-3 space-y-2">
                    <div className="flex items-center gap-2 text-xs">
                      <Mic className="w-3.5 h-3.5 text-navy-700 shrink-0" />
                      <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full transition-all ${f.mic_level > 60 ? 'bg-red-500' : f.mic_level > 30 ? 'bg-gold-400' : 'bg-emerald-500'}`}
                          style={{ width: `${f.mic_level}%` }}
                        ></div>
                      </div>
                      <span className="font-bold text-gray-500 w-8 text-right">{f.mic_level}%</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {f.face_visible ? (
                        <span className="badge bg-emerald-100 text-emerald-700"><CheckCircle2 className="w-3 h-3" /> Face visible</span>
                      ) : (
                        <span className="badge bg-red-100 text-red-600"><XCircle className="w-3 h-3" /> No face</span>
                      )}
                      {f.gaze_ok ? (
                        <span className="badge bg-emerald-100 text-emerald-700"><Eye className="w-3 h-3" /> Eyes on screen</span>
                      ) : (
                        <span className="badge bg-amber-100 text-amber-800"><Eye className="w-3 h-3" /> Looking away</span>
                      )}
                    </div>
                    <div>
                      <div className="flex justify-between text-[11px] font-bold text-gray-500 mb-1">
                        <span>Progress</span>
                        <span>{f.answered}/{f.total} · {pct}%</span>
                      </div>
                      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full bg-navy-900 transition-all" style={{ width: `${pct}%` }}></div>
                      </div>
                    </div>
                    <div className="text-[10px] text-gray-400">Updated {timeAgo(f.updated_at)}</div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Focused crystal-clear view */}
      {focus && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-navy-950/90 backdrop-blur-sm" onClick={() => setFocus(null)}></div>
          <div className="relative bg-navy-950 border border-gold-400/40 rounded-2xl card-shadow w-full max-w-4xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3 border-b border-gold-400/25">
              <div className="min-w-0">
                <div className="font-bold text-white text-sm truncate">
                  {focus.student?.full_name || `Student #${focus.student_id}`}
                </div>
                <div className="text-[11px] text-gold-300 truncate">
                  {focus.quiz?.title || `Attempt #${focus.attempt_id}`} · {focus.warnings} warnings · Q {focus.answered}/{focus.total}
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="badge bg-red-600 text-white proctor-pulse">● LIVE</span>
                <button onClick={() => setFocus(null)} className="p-2 rounded-lg bg-white/10 hover:bg-gold-400 hover:text-navy-950 text-white transition" aria-label="Close">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
            <div className="bg-black">
              {focus.image ? (
                <img src={focus.image} alt="Live student camera — enlarged" className="w-full max-h-[70vh] object-contain" />
              ) : (
                <div className="h-64 flex flex-col items-center justify-center text-white/40 gap-2">
                  <Camera className="w-10 h-10" />
                  <span className="text-sm font-semibold">Waiting for camera…</span>
                </div>
              )}
            </div>
            <div className="flex items-center gap-2 flex-wrap px-5 py-3 border-t border-gold-400/25">
              {focus.face_visible ? (
                <span className="badge bg-emerald-100 text-emerald-700"><CheckCircle2 className="w-3 h-3" /> Face visible</span>
              ) : (
                <span className="badge bg-red-100 text-red-600"><XCircle className="w-3 h-3" /> No face</span>
              )}
              {focus.gaze_ok ? (
                <span className="badge bg-emerald-100 text-emerald-700"><Eye className="w-3 h-3" /> Eyes on screen</span>
              ) : (
                <span className="badge bg-amber-100 text-amber-800"><Eye className="w-3 h-3" /> Looking away</span>
              )}
              <span className="badge bg-white/10 text-white/80"><Mic className="w-3 h-3" /> Mic {focus.mic_level}%</span>
              <span className="text-[11px] text-white/50 ml-auto">Updated {timeAgo(focus.updated_at)} · auto-refreshing</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
