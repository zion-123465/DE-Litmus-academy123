import { useEffect } from 'react';
import { X } from 'lucide-react';

export default function Modal({
  open,
  onClose,
  title,
  children,
  wide = false,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  wide?: boolean;
}) {
  useEffect(() => {
    if (!open) return;
    const fn = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', fn);
    return () => window.removeEventListener('keydown', fn);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-navy-950/70 backdrop-blur-sm" onClick={onClose}></div>
      <div
        className={`relative bg-white rounded-2xl card-shadow w-full ${wide ? 'max-w-3xl' : 'max-w-lg'} max-h-[90vh] overflow-y-auto scroll-thin`}
      >
        <div className="sticky top-0 bg-white/95 backdrop-blur border-b border-navy-100 px-6 py-4 flex items-center justify-between rounded-t-2xl">
          <h3 className="font-display font-bold text-navy-900 text-lg">{title}</h3>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-navy-50 text-navy-700" aria-label="Close">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="px-6 py-5">{children}</div>
      </div>
    </div>
  );
}
