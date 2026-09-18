import { useEffect } from 'react';
import { X, ShieldCheck } from 'lucide-react';

interface Props {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  fileUrl: string;
  fileType: string;
  studentName?: string | null;
  bodyText?: string | null;
}

// Secure in-site reader: text materials render as AI-arranged study notes,
// PDFs render inside the page via Google Docs viewer (no direct file link
// exposed), images render in a protected viewer.
// Right-click, drag, copy and print are blocked while reading.
export default function MaterialReader({ open, onClose, title, subtitle, fileUrl, fileType, studentName, bodyText }: Props) {
  useEffect(() => {
    if (!open) return;
    const block = (e: Event) => {
      e.preventDefault();
      e.stopPropagation();
      return false;
    };
    const blockKey = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if ((e.ctrlKey || e.metaKey) && ['s', 'p', 'u', 'c'].includes(k)) {
        e.preventDefault();
        e.stopPropagation();
      }
      if (e.key === 'PrintScreen') {
        e.preventDefault();
      }
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('contextmenu', block, true);
    document.addEventListener('copy', block, true);
    document.addEventListener('cut', block, true);
    document.addEventListener('dragstart', block, true);
    document.addEventListener('keydown', blockKey, true);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('contextmenu', block, true);
      document.removeEventListener('copy', block, true);
      document.removeEventListener('cut', block, true);
      document.removeEventListener('dragstart', block, true);
      document.removeEventListener('keydown', blockKey, true);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  if (!open) return null;

  const ft = (fileType || '').toLowerCase();
  const isText = ft === 'text';
  const isPdf = !isText && ft !== 'image';
  let textBlocks: { type: string; text: string }[] = [];
  if (isText && bodyText) {
    try {
      const parsed = JSON.parse(bodyText);
      if (Array.isArray(parsed?.blocks)) textBlocks = parsed.blocks;
    } catch {
      textBlocks = [{ type: 'p', text: bodyText }];
    }
  }
  const viewerUrl = isPdf
    ? `https://docs.google.com/viewer?url=${encodeURIComponent(fileUrl)}&embedded=true`
    : null;

  return (
    <div className="fixed inset-0 z-[100] flex flex-col bg-navy-950">
      <div className="flex items-center gap-3 px-4 sm:px-6 py-3 border-b border-gold-400/25 bg-navy-950/95 shrink-0">
        <ShieldCheck className="w-5 h-5 text-gold-400 shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="font-bold text-white text-sm truncate">{title}</div>
          {subtitle && <div className="text-[11px] text-white/50 truncate">{subtitle}</div>}
        </div>
        <div className="hidden sm:block text-[10px] font-bold uppercase tracking-widest text-gold-300/80 border border-gold-400/40 rounded-full px-3 py-1">
          Read-only · No download
        </div>
        <button
          onClick={onClose}
          className="p-2 rounded-lg bg-white/10 hover:bg-gold-400 hover:text-navy-950 text-white transition"
          aria-label="Close reader"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="flex-1 relative overflow-hidden select-none" onContextMenu={(e) => e.preventDefault()}>
        {isText ? (
          <div className="absolute inset-0 overflow-y-auto scroll-thin bg-navy-50/60">
            <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8 pb-16">
              <div className="bg-white rounded-2xl border border-navy-100 card-shadow p-6 sm:p-8 space-y-3">
                <div className="text-[10px] font-bold uppercase tracking-[0.25em] text-gold-600">AI-arranged study note</div>
                {textBlocks.length === 0 && <p className="text-sm text-gray-500">This material has no readable text yet.</p>}
                {textBlocks.map((b, i) => (
                  <div key={i}>
                    {b.type === 'h' && <h2 className="font-display font-extrabold text-navy-900 text-xl pt-2">{b.text}</h2>}
                    {b.type === 'h2' && <h3 className="font-bold text-gold-700 text-base pt-2">{b.text}</h3>}
                    {b.type === 'p' && <p className="text-[15px] text-gray-800 leading-relaxed">{b.text}</p>}
                    {b.type === 'li' && (
                      <div className="flex gap-2.5 text-[15px] text-gray-800">
                        <span className="text-gold-600 font-extrabold shrink-0">•</span>
                        <span className="leading-relaxed">{b.text}</span>
                      </div>
                    )}
                    {b.type === 'quote' && (
                      <div className="border-l-4 border-gold-400 bg-gold-50 px-4 py-3 text-[15px] italic text-gray-800 rounded-r-xl">{b.text}</div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : isPdf ? (
          <iframe
            key={fileUrl}
            src={viewerUrl!}
            title={title}
            className="absolute inset-0 w-full h-full bg-white"
            frameBorder="0"
          />
        ) : (
          <div className="absolute inset-0 overflow-auto scroll-thin flex items-start justify-center p-4 bg-navy-950">
            <img
              src={fileUrl}
              alt={title}
              draggable={false}
              className="max-w-full rounded-xl shield-ring pointer-events-none"
              onContextMenu={(e) => e.preventDefault()}
            />
          </div>
        )}
        {/* Watermark strip */}
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 pointer-events-none">
          <div className="bg-navy-950/80 border border-gold-400/40 rounded-full px-4 py-1 text-[10px] font-bold text-gold-300 whitespace-nowrap">
            De-Litmus Academy · {studentName || 'Licensed reader'} · Copying disabled
          </div>
        </div>
      </div>
    </div>
  );
}
