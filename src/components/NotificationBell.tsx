import { useEffect, useState } from 'react';
import { BellRing, Megaphone, X } from 'lucide-react';
import { apiFetch, timeAgo } from '../lib/api';

const SEEN_KEY = 'dla_seen_notifications';

function getSeen(): number[] {
  try {
    return JSON.parse(localStorage.getItem(SEEN_KEY) || '[]');
  } catch {
    return [];
  }
}

export default function NotificationBell() {
  const [items, setItems] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [seen, setSeen] = useState<number[]>(getSeen());

  useEffect(() => {
    apiFetch<any[]>('/api/notifications?limit=20')
      .then((d) => setItems(d || []))
      .catch(() => {});
  }, []);

  const unread = items.filter((n) => !seen.includes(n.id));

  const markAllSeen = () => {
    const ids = items.map((n) => n.id);
    setSeen(ids);
    try {
      localStorage.setItem(SEEN_KEY, JSON.stringify(ids));
    } catch {}
  };

  const toggle = () => {
    if (!open) markAllSeen();
    setOpen(!open);
  };

  return (
    <div className="relative">
      <button
        onClick={toggle}
        aria-label="Notifications"
        className="relative p-2.5 rounded-xl bg-white/10 hover:bg-white/15 border border-white/15 text-gold-300 transition"
      >
        <BellRing className="w-5 h-5" />
        {unread.length > 0 && (
          <span className="absolute -top-1.5 -right-1.5 min-w-5 h-5 px-1 rounded-full bg-red-600 text-white text-[10px] font-extrabold flex items-center justify-center">
            {unread.length > 9 ? '9+' : unread.length}
          </span>
        )}
      </button>

      {open && (
        <div className="fixed inset-x-0 top-0 z-[90] flex justify-center px-4 pt-20 md:pt-24 pointer-events-none">
          <div className="pointer-events-auto w-full max-w-md bg-white rounded-2xl card-shadow border border-navy-100 overflow-hidden">
            <div className="bg-navy-950 hero-pattern px-5 py-3.5 flex items-center justify-between">
              <div className="font-bold text-gold-300 text-sm flex items-center gap-2">
                <Megaphone className="w-4 h-4" /> Academy Announcements
              </div>
              <button onClick={() => setOpen(false)} className="text-white/60 hover:text-white" aria-label="Close">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="max-h-[50vh] overflow-y-auto scroll-thin">
              {items.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-8">No announcements yet.</p>
              ) : (
                items.map((n) => (
                  <div key={n.id} className={`px-5 py-3.5 border-b border-navy-50 last:border-0 ${!seen.includes(n.id) ? 'bg-gold-50/60' : ''}`}>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-navy-900">{n.title}</span>
                      <span className="badge bg-gold-100 text-gold-700 !text-[9px]">{n.category || 'announcement'}</span>
                    </div>
                    <p className="text-xs text-gray-600 mt-1 whitespace-pre-line">{n.message}</p>
                    <div className="text-[10px] text-gray-400 mt-1">{timeAgo(n.created_at)}</div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
