import { useState } from 'react';
import { Link2, Check, X } from 'lucide-react';

interface Props {
  id: number;
  kind: 'quiz' | 'material';
  title: string;
  subtitle?: string;
  imageUrl?: string | null;
  fileUrl?: string | null;
  fileType?: string | null;
  priceLabel?: string | null;
  compact?: boolean;
}

const LOGO_URL = 'https://www.designarena.ai/u/0af0c461-858d-45e6-8a72-5a9585d1cec0';

export default function CopyLinkButton({ id, kind, title, subtitle, imageUrl, fileUrl, fileType, priceLabel, compact = false }: Props) {
  const [copied, setCopied] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  const shareUrl = `${window.location.origin}/s/${kind}/${id}`;
  // Quiz + website links preview with the academy logo; material links
  // preview with the material's own cover/file picture (logo as fallback).
  const previewImage = kind === 'material' ? imageUrl || (fileType === 'image' ? fileUrl : null) || LOGO_URL : LOGO_URL;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = shareUrl;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    }
  };

  return (
    <div className="relative">
      <div className="flex gap-1.5">
        <button
          onClick={copy}
          title="Copy share link"
          className={`flex items-center gap-1.5 font-bold rounded-lg transition ${
            compact ? 'text-[11px] px-2.5 py-1.5' : 'text-xs px-3 py-2'
          } ${copied ? 'bg-emerald-600 text-white' : 'bg-navy-50 hover:bg-navy-900 hover:text-gold-300 text-navy-800'}`}
        >
          {copied ? <Check className="w-3.5 h-3.5" /> : <Link2 className="w-3.5 h-3.5" />}
          {copied ? 'Copied!' : 'Copy Link'}
        </button>
        <button
          onClick={() => setShowPreview(!showPreview)}
          title="Preview how the link looks when shared"
          className={`font-bold rounded-lg border transition ${
            compact ? 'text-[11px] px-2.5 py-1.5' : 'text-xs px-3 py-2'
          } border-navy-100 text-navy-700 hover:border-gold-400 hover:text-gold-600`}
        >
          Preview
        </button>
      </div>

      {showPreview && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-navy-950/70 backdrop-blur-sm" onClick={() => setShowPreview(false)}></div>
          <div className="relative bg-white rounded-2xl card-shadow w-full max-w-sm overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3 border-b border-navy-100">
              <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Link preview</span>
              <button onClick={() => setShowPreview(false)} className="p-1.5 rounded-lg hover:bg-navy-50 text-navy-700" aria-label="Close">
                <X className="w-4 h-4" />
              </button>
            </div>
            {/* Chat-bubble style preview, like WhatsApp */}
            <div className="p-5 bg-[#0b141a]">
              <div className="bg-[#1f2c34] rounded-xl overflow-hidden max-w-[280px]">
                <img src={previewImage} alt="" className="w-full h-36 object-cover" />
                <div className="p-3">
                  <div className="text-[10px] font-semibold text-gray-400 uppercase">De-Litmus Academy</div>
                  <div className="text-sm font-bold text-white mt-0.5 leading-snug">{title}</div>
                  {subtitle && <div className="text-xs text-gray-400 mt-1 line-clamp-2">{subtitle}</div>}
                  {priceLabel && (
                    <span className="inline-block mt-2 text-[11px] font-extrabold bg-gold-400 text-navy-950 rounded-full px-2.5 py-0.5">
                      {priceLabel}
                    </span>
                  )}
                  <div className="text-[11px] text-emerald-400 mt-2 break-all">{shareUrl}</div>
                </div>
              </div>
              <button onClick={copy} className="mt-3 w-full gold-btn font-bold text-xs py-2.5 rounded-xl flex items-center justify-center gap-1.5">
                {copied ? <Check className="w-3.5 h-3.5" /> : <Link2 className="w-3.5 h-3.5" />}
                {copied ? 'Copied to clipboard!' : 'Copy this link'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
