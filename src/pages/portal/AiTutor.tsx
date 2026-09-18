import { useEffect, useState } from 'react';
import { Sparkles, Send, Loader2, Bot, GraduationCap, Maximize2, Minimize2 } from 'lucide-react';
import { apiFetch } from '../../lib/api';
import { useAuth } from '../../contexts/AuthContext';

interface Msg {
  role: 'user' | 'ai';
  text: string;
}

const SUGGESTIONS = [
  'How do I buy a quiz code?',
  'How does the 20-warning rule work?',
  'Where are my quiz scores?',
  'How do I read a material?',
];

export default function AiTutor() {
  const { student } = useAuth();
  const [messages, setMessages] = useState<Msg[]>([
    { role: 'ai', text: 'Hello! I\'m Litmus AI, your study companion. Ask me anything about the academy — quiz codes, payments, exams, materials — or any study topic (Maths, English, Sciences, WAEC/JAMB prep). How can I help you today?' },
  ]);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    const el = document.getElementById('ai-tutor-scroll');
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages.length, busy, expanded]);

  useEffect(() => {
    if (!expanded) return;
    document.body.style.overflow = 'hidden';
    const fn = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setExpanded(false);
    };
    window.addEventListener('keydown', fn);
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', fn);
    };
  }, [expanded]);

  const ask = async (q?: string) => {
    const question = (q ?? text).trim();
    if (!question || busy) return;
    setText('');
    const history = [...messages, { role: 'user' as const, text: question }];
    setMessages(history);
    setBusy(true);
    try {
      const r = await apiFetch<{ answer: string }>('/api/ai-tutor', {
        method: 'POST',
        body: JSON.stringify({
          question,
          student_name: student?.full_name || 'Student',
          history: history.slice(-8).map((m) => ({ role: m.role === 'ai' ? 'assistant' : 'user', content: m.text })),
        }),
      });
      setMessages([...history, { role: 'ai', text: r.answer }]);
    } catch (e: any) {
      setMessages([...history, { role: 'ai', text: 'Sorry, I could not think right now. Please try again in a moment — or use "Chat with Admin" for urgent help.' }]);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={`flex flex-col min-h-0 ${expanded ? 'fixed inset-0 z-[95] bg-navy-950 p-0' : 'flex-1 max-w-5xl w-full mx-auto px-0 sm:px-2 py-0 sm:py-4 gap-3'}`}>
      <div className={expanded ? 'h-full flex flex-col min-h-0' : 'flex-1 flex flex-col min-h-0 gap-3'}>
      <div className={`flex items-center justify-between gap-3 flex-wrap shrink-0 ${expanded ? 'px-3 sm:px-6 pt-3 sm:pt-5' : 'px-1'}`}>
        <button
          onClick={() => window.history.back()}
          className={`lg:hidden p-2.5 rounded-xl shrink-0 ${expanded ? 'bg-white/10 text-white' : 'bg-white border border-navy-100 text-navy-900'}`}
          aria-label="Back"
        >
          ←
        </button>
        <div className="flex-1 min-w-0">
          <h1 className={`font-display font-extrabold text-xl sm:text-2xl flex items-center gap-2 ${expanded ? 'text-white' : 'text-navy-900'}`}>
            <Sparkles className="w-5 h-5 sm:w-6 sm:h-6 text-gold-500 shrink-0" /> AI Tutor
          </h1>
          <p className={`text-xs sm:text-sm truncate ${expanded ? 'text-white/70' : 'text-gray-500'}`}>Learn anything with Litmus AI — study topics or how this website works.</p>
        </div>
        <button
          onClick={() => setExpanded(!expanded)}
          title={expanded ? 'Exit full screen (Esc)' : 'Expand chat full screen'}
          className="flex items-center gap-2 bg-white border border-navy-100 hover:border-gold-400 font-bold text-xs px-4 py-2.5 rounded-xl text-navy-900 transition shrink-0"
        >
          {expanded ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          {expanded ? 'Exit' : 'Expand'}
        </button>
      </div>

      <div className={`bg-white sm:rounded-2xl border-y sm:border border-navy-100 card-shadow overflow-hidden flex flex-col flex-1 min-h-0 ${expanded ? 'sm:mx-6 sm:mb-6 sm:rounded-2xl' : ''}`}>
        <div className="bg-navy-950 hero-pattern px-5 py-3.5 flex items-center gap-3 shrink-0">
          <div className="w-9 h-9 rounded-full bg-gold-400 text-navy-950 flex items-center justify-center">
            <Bot className="w-5 h-5" />
          </div>
          <div>
            <div className="font-bold text-gold-300 text-sm">Litmus AI</div>
            <div className="text-[11px] text-white/60 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span> Always online · answers instantly
            </div>
          </div>
        </div>

        <div id="ai-tutor-scroll" className="flex-1 min-h-0 overflow-y-auto scroll-thin p-4 sm:p-5 space-y-4 bg-navy-50/40">
          {messages.map((m, i) => (
            <div key={i} className={`flex gap-2.5 ${m.role === 'user' ? 'flex-row-reverse' : ''}`}>
              {m.role === 'ai' ? (
                <div className="w-8 h-8 rounded-full bg-navy-900 text-gold-300 flex items-center justify-center shrink-0">
                  <GraduationCap className="w-4 h-4" />
                </div>
              ) : (
                <div className="w-8 h-8 rounded-full bg-gold-400 text-navy-950 font-extrabold text-xs flex items-center justify-center shrink-0">
                  {(student?.full_name || 'S').charAt(0).toUpperCase()}
                </div>
              )}
              <div
                className={`max-w-[80%] text-sm px-4 py-3 rounded-2xl leading-relaxed whitespace-pre-line break-words ${
                  m.role === 'user'
                    ? 'bg-gold-400 text-navy-950 rounded-tr-md'
                    : 'bg-white border border-navy-100 text-navy-900 rounded-tl-md'
                }`}
              >
                {m.text}
              </div>
            </div>
          ))}
          {busy && (
            <div className="flex gap-2.5">
              <div className="w-8 h-8 rounded-full bg-navy-900 text-gold-300 flex items-center justify-center shrink-0">
                <GraduationCap className="w-4 h-4" />
              </div>
              <div className="bg-white border border-navy-100 rounded-2xl rounded-tl-md px-4 py-3 flex items-center gap-2 text-sm text-gray-500">
                <Loader2 className="w-4 h-4 animate-spin text-gold-600" /> Litmus AI is thinking…
              </div>
            </div>
          )}
        </div>

        <div className="border-t border-navy-100 p-4 space-y-3">
          <div className="flex flex-wrap gap-2">
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                onClick={() => ask(s)}
                disabled={busy}
                className="text-xs font-semibold bg-navy-50 hover:bg-gold-100 border border-navy-100 hover:border-gold-400 text-navy-800 rounded-full px-3 py-1.5 transition disabled:opacity-50"
              >
                {s}
              </button>
            ))}
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              ask();
            }}
            className="flex gap-2"
          >
            <input
              className="input-field"
              placeholder="Ask anything — e.g. Explain photosynthesis…"
              value={text}
              maxLength={1000}
              onChange={(e) => setText(e.target.value)}
            />
            <button type="submit" disabled={busy || !text.trim()} className="gold-btn font-bold px-5 rounded-xl disabled:opacity-50 flex items-center gap-2">
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              <span className="hidden sm:inline">Ask</span>
            </button>
          </form>
        </div>
      </div>
      </div>
    </div>
  );
}
