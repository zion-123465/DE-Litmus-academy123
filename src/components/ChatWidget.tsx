import { useState } from 'react';
import { MessageCircle, X, Phone, MapPin, Users, Send } from 'lucide-react';

const ADMIN_PHONE_DISPLAY = '0810 685 2839';
const ADMIN_PHONE_INTL = '2348106852839';
const GROUP_LINK = 'https://chat.whatsapp.com/It1JrM2epz0CKjghB9FbaU?s=cl&p=a&mlu=4&ilr=4';
const ADDRESS = 'Beside Noble Hostel, before Chemistry Lab, Presco Campus';

export default function ChatWidget() {
  const [open, setOpen] = useState(false);
  const [msg, setMsg] = useState('');

  const waLink = (text: string) => `https://wa.me/${ADMIN_PHONE_INTL}?text=${encodeURIComponent(text)}`;

  const quick = [
    'Hello! I need help with a quiz code.',
    'Hello! I have a payment question.',
    'Hello! I forgot my login details.',
  ];

  return (
    <>
      {/* Floating button */}
      <button
        onClick={() => setOpen(!open)}
        aria-label="Chat with admin"
        className="fixed bottom-5 right-5 z-[90] w-14 h-14 rounded-full gold-btn flex items-center justify-center card-shadow hover:scale-105 transition"
      >
        {open ? <X className="w-6 h-6" /> : <MessageCircle className="w-6 h-6" />}
        {!open && <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-emerald-500 border-2 border-white"></span>}
      </button>

      {open && (
        <div className="fixed bottom-24 right-5 z-[90] w-[calc(100vw-2.5rem)] max-w-sm bg-white rounded-2xl card-shadow border border-navy-100 overflow-hidden">
          <div className="bg-navy-950 hero-pattern px-5 py-4">
            <div className="font-display font-bold text-gold-300">Chat with the Admin</div>
            <div className="text-xs text-white/60 flex items-center gap-1.5 mt-0.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400"></span> Typically replies on WhatsApp
            </div>
          </div>
          <div className="p-5 space-y-4">
            <div className="bg-navy-50 border border-navy-100 rounded-xl p-4 space-y-2.5 text-sm">
              <a href={`tel:${ADMIN_PHONE_INTL}`} className="flex items-center gap-2.5 font-bold text-navy-900 hover:text-gold-600">
                <span className="w-8 h-8 rounded-lg bg-navy-900 text-gold-300 flex items-center justify-center shrink-0"><Phone className="w-4 h-4" /></span>
                {ADMIN_PHONE_DISPLAY}
              </a>
              <a href={GROUP_LINK} target="_blank" rel="noreferrer" className="flex items-center gap-2.5 font-bold text-navy-900 hover:text-gold-600">
                <span className="w-8 h-8 rounded-lg bg-emerald-600 text-white flex items-center justify-center shrink-0"><Users className="w-4 h-4" /></span>
                Join WhatsApp Group
              </a>
              <div className="flex items-start gap-2.5 text-gray-600 text-xs leading-relaxed">
                <span className="w-8 h-8 rounded-lg bg-gold-100 text-gold-700 flex items-center justify-center shrink-0"><MapPin className="w-4 h-4" /></span>
                {ADDRESS}
              </div>
            </div>

            <div>
              <div className="label-text">Quick messages</div>
              <div className="flex flex-wrap gap-2">
                {quick.map((q) => (
                  <a
                    key={q}
                    href={waLink(q)}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs font-semibold bg-navy-50 hover:bg-gold-100 border border-navy-100 hover:border-gold-400 text-navy-800 rounded-full px-3 py-1.5 transition"
                  >
                    {q.replace('Hello! ', '')}
                  </a>
                ))}
              </div>
            </div>

            <div className="flex gap-2">
              <input
                className="input-field"
                placeholder="Type your message…"
                value={msg}
                onChange={(e) => setMsg(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && msg.trim()) window.open(waLink(msg.trim()), '_blank');
                }}
              />
              <a
                href={waLink(msg.trim() || 'Hello! I need help.')}
                target="_blank"
                rel="noreferrer"
                className="gold-btn font-bold p-3 rounded-xl shrink-0"
                aria-label="Send on WhatsApp"
              >
                <Send className="w-4 h-4" />
              </a>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
