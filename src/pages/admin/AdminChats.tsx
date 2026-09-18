import { useEffect, useRef, useState } from 'react';
import { Users, Headset, Send, Loader2, Trash2, Link2, Check, ShieldCheck, Search, Paperclip, Image as ImageIcon, FileText, Mic, Square, Smile, X, Reply, Maximize2, Minimize2 } from 'lucide-react';
import { apiFetch, formatDateTime, timeAgo, uploadFile } from '../../lib/api';
import Spinner from '../../components/Spinner';
import { EmptyState } from '../../components/ui';
import VoicePlayer from '../../components/VoicePlayer';

const LOGO_URL = 'https://www.designarena.ai/u/0af0c461-858d-45e6-8a72-5a9585d1cec0';
const EMOJIS = ['😀','😂','😍','👏','👍','🙏','🎉','🔥','❤️','😢','😮','🤔','👋','📚','✏️','💡','✅','❌','⭐','🎓'];

function fmtClock(iso: string) {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleTimeString('en-NG', { hour: 'numeric', minute: '2-digit' });
}

function renderBody(m: any) {
  if (m.kind === 'image' && m.attachment_url) {
    return (
      <span className="block">
        <img src={m.attachment_url} alt="shared" className="rounded-lg max-h-48 w-auto mb-1" loading="lazy" />
        {m.message && m.message !== '[image]' && <span className="block">{m.message}</span>}
      </span>
    );
  }
  if (m.kind === 'file' && m.attachment_url) {
    return (
      <span className="block">
        <a href={m.attachment_url} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 underline break-all">
          <FileText className="w-3.5 h-3.5 shrink-0" /> {m.attachment_name || 'Attachment'}
        </a>
        {m.message && <span className="block mt-1">{m.message}</span>}
      </span>
    );
  }
  if (m.kind === 'voice' && m.attachment_url) {
    return <VoicePlayer src={m.attachment_url} />;
  }
  const parts = String(m.message || '').split(/(https?:\/\/[^\s]+)/g);
  return (
    <span>
      {parts.map((p: string, i: number) =>
        /^https?:\/\//.test(p) ? (
          <a key={i} href={p} target="_blank" rel="noreferrer" className="underline break-all">{p}</a>
        ) : (
          <span key={i}>{p}</span>
        )
      )}
    </span>
  );
}

type Tab = 'group' | 'private';

export default function AdminChats() {
  const [tab, setTab] = useState<Tab>('group');
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);

  // group
  const [group, setGroup] = useState<any[]>([]);
  const [gText, setGText] = useState('');
  const [gSending, setGSending] = useState(false);
  const [copied, setCopied] = useState(false);

  // private
  const [threads, setThreads] = useState<any[]>([]);
  const [activeId, setActiveId] = useState<number | null>(null);
  const [pMessages, setPMessages] = useState<any[]>([]);
  const [pText, setPText] = useState('');
  const [pSending, setPSending] = useState(false);
  const [pSearch, setPSearch] = useState('');

  const groupBottom = useRef<HTMLDivElement>(null);
  const privBottom = useRef<HTMLDivElement>(null);
  const [pAttachOpen, setPAttachOpen] = useState(false);
  const [pEmojiOpen, setPEmojiOpen] = useState(false);
  const [pUploading, setPUploading] = useState(false);
  const [pReply, setPReply] = useState<any | null>(null);
  const [pRecording, setPRecording] = useState(false);
  const [pRecSecs, setPRecSecs] = useState(0);
  const pMediaRef = useRef<MediaRecorder | null>(null);
  const pChunksRef = useRef<Blob[]>([]);
  const pRecTimer = useRef<any>(null);
  const pFileRef = useRef<HTMLInputElement>(null);
  const pImgRef = useRef<HTMLInputElement>(null);

  const groupUrl = `${window.location.origin}/group-chat`;

  const copyGroupLink = async () => {
    try {
      await navigator.clipboard.writeText(groupUrl);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = groupUrl;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  const fetchGroup = async (silent = false) => {
    try {
      const d = await apiFetch<any[]>('/api/chat?scope=group&limit=100', { admin: true });
      setGroup(d);
    } catch (e) {
      if (!silent) console.error(e);
    }
  };

  const fetchThreads = async (silent = false) => {
    try {
      const d = await apiFetch<any[]>('/api/chat?admin_unread=1', { admin: true });
      setThreads(d);
    } catch (e) {
      if (!silent) console.error(e);
    }
  };

  const fetchPrivate = async (sid: number, silent = false) => {
    try {
      const d = await apiFetch<any[]>(`/api/chat?scope=private&student_id=${sid}&limit=200`, { admin: true });
      setPMessages(d);
      await apiFetch('/api/chat', { method: 'PUT', admin: true, body: JSON.stringify({ action: 'mark_read', student_id: sid }) }).catch(() => {});
      if (!silent) fetchThreads(true);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    (async () => {
      setLoading(true);
      await Promise.all([fetchGroup(), fetchThreads()]);
      setLoading(false);
    })();
    const t = setInterval(() => {
      fetchGroup(true);
      fetchThreads(true);
      if (activeId) fetchPrivate(activeId, true);
    }, 6000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId]);

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

  useEffect(() => {
    groupBottom.current?.scrollIntoView();
  }, [group.length, tab]);

  useEffect(() => {
    privBottom.current?.scrollIntoView();
  }, [pMessages.length, tab, activeId]);

  const sendGroup = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!gText.trim() || gSending) return;
    setGSending(true);
    try {
      const m = await apiFetch<any>('/api/chat', {
        method: 'POST',
        admin: true,
        body: JSON.stringify({ scope: 'group', sender_name: 'Admin', sender_role: 'admin', message: gText.trim() }),
      });
      setGroup((prev) => [...prev, m]);
      setGText('');
    } catch (err: any) {
      alert(err.message || 'Could not send.');
    } finally {
      setGSending(false);
    }
  };

  const sendPrivate = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!pText.trim() || pSending || !activeId) return;
    setPSending(true);
    try {
      const m = await apiFetch<any>('/api/chat', {
        method: 'POST',
        admin: true,
        body: JSON.stringify({
          scope: 'private',
          student_id: activeId,
          sender_name: 'Admin',
          sender_role: 'admin',
          message: pText.trim(),
          reply_to: pReply ? { id: pReply.id, name: pReply.sender_name, text: String(pReply.message || '').slice(0, 120) } : null,
        }),
      });
      setPMessages((prev) => [...prev, m]);
      setPText('');
      setPReply(null);
      setPEmojiOpen(false);
      fetchThreads(true);
    } catch (err: any) {
      alert(err.message || 'Could not send.');
    } finally {
      setPSending(false);
    }
  };

  const sendPrivateAttachment = async (file: File) => {
    if (!activeId || pUploading) return;
    if (file.size > 9 * 1024 * 1024) {
      alert('File too large. Maximum 9MB.');
      return;
    }
    setPUploading(true);
    setPAttachOpen(false);
    try {
      const up = await uploadFile(file, 'chat');
      const isImg = file.type.startsWith('image/');
      const m = await apiFetch<any>('/api/chat', {
        method: 'POST',
        admin: true,
        body: JSON.stringify({
          scope: 'private',
          student_id: activeId,
          sender_name: 'Admin',
          sender_role: 'admin',
          message: pText.trim() || (isImg ? '[image]' : file.name),
          kind: isImg ? 'image' : 'file',
          attachment_url: up.url,
          attachment_name: file.name,
          reply_to: pReply ? { id: pReply.id, name: pReply.sender_name, text: String(pReply.message || '').slice(0, 120) } : null,
        }),
      });
      setPMessages((prev) => [...prev, m]);
      setPText('');
      setPReply(null);
      fetchThreads(true);
    } catch (err: any) {
      alert(err.message || 'Upload failed.');
    } finally {
      setPUploading(false);
    }
  };

  const togglePrivateRecord = async () => {
    if (pRecording) {
      try {
        pMediaRef.current?.stop();
      } catch {}
      return;
    }
    if (!activeId) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const rec = new MediaRecorder(stream);
      pChunksRef.current = [];
      rec.ondataavailable = (e) => {
        if (e.data.size) pChunksRef.current.push(e.data);
      };
      rec.onstop = async () => {
        clearInterval(pRecTimer.current);
        setPRecording(false);
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(pChunksRef.current, { type: rec.mimeType || 'audio/webm' });
        if (blob.size < 500) return;
        const file = new File([blob], `voice-${Date.now()}.webm`, { type: 'audio/webm' });
        setPUploading(true);
        try {
          const up = await uploadFile(file, 'chat');
          const m = await apiFetch<any>('/api/chat', {
            method: 'POST',
            admin: true,
            body: JSON.stringify({
              scope: 'private',
              student_id: activeId,
              sender_name: 'Admin',
              sender_role: 'admin',
              message: `Voice note (${pRecSecs}s)`,
              kind: 'voice',
              attachment_url: up.url,
              attachment_name: file.name,
            }),
          });
          setPMessages((prev) => [...prev, m]);
          fetchThreads(true);
        } catch (err: any) {
          alert(err.message || 'Voice upload failed.');
        } finally {
          setPUploading(false);
          setPRecSecs(0);
        }
      };
      pMediaRef.current = rec;
      rec.start();
      setPRecording(true);
      setPRecSecs(0);
      pRecTimer.current = setInterval(() => setPRecSecs((s) => s + 1), 1000);
    } catch {
      alert('Microphone access was denied.');
    }
  };

  const deleteMsg = async (id: number, isGroup: boolean) => {
    if (!confirm('Delete this message for everyone?')) return;
    try {
      await apiFetch('/api/chat', { method: 'DELETE', admin: true, body: JSON.stringify({ id }) });
      if (isGroup) setGroup((prev) => prev.filter((m) => m.id !== id));
      else setPMessages((prev) => prev.filter((m) => m.id !== id));
    } catch (err: any) {
      alert(err.message || 'Delete failed.');
    }
  };

  const openThread = (sid: number) => {
    setActiveId(sid);
    setPMessages([]);
    fetchPrivate(sid);
  };

  const filteredThreads = threads.filter((t) => {
    const q = pSearch.trim().toLowerCase();
    if (!q) return true;
    return `${t.student?.full_name || ''} ${t.last?.message || ''}`.toLowerCase().includes(q);
  });
  const unreadTotal = threads.reduce((s, t) => s + (t.unread || 0), 0);
  const activeThread = threads.find((t) => t.student_id === activeId);

  if (loading) return <Spinner label="Loading chats…" />;

  return (
    <div className={expanded ? 'fixed inset-0 z-[95] bg-navy-950/90 backdrop-blur-sm p-2 sm:p-6 overflow-y-auto' : 'space-y-5'}>
      <div className={expanded ? 'max-w-6xl mx-auto space-y-4 min-h-full flex flex-col' : 'space-y-5'}>
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className={`font-display font-extrabold text-2xl ${expanded ? 'text-white' : 'text-navy-900'}`}>Chats & Messages</h1>
          <p className={`text-sm ${expanded ? 'text-white/70' : 'text-gray-500'}`}>Control the group chat and reply students privately.</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => setTab('group')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition ${tab === 'group' ? 'bg-navy-900 text-gold-300' : 'bg-white border border-navy-100 text-navy-800'}`}
          >
            <Users className="w-4 h-4" /> Group Chat
          </button>
          <button
            onClick={() => setTab('private')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition ${tab === 'private' ? 'bg-navy-900 text-gold-300' : 'bg-white border border-navy-100 text-navy-800'}`}
          >
            <Headset className="w-4 h-4" /> Private
            {unreadTotal > 0 && <span className="badge bg-red-600 text-white">{unreadTotal}</span>}
          </button>
          <button
            onClick={() => setExpanded(!expanded)}
            title={expanded ? 'Exit full screen (Esc)' : 'Expand full screen'}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition ${expanded ? 'gold-btn' : 'bg-white border border-navy-100 text-navy-800 hover:border-gold-400'}`}
          >
            {expanded ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            {expanded ? 'Exit' : 'Expand'}
          </button>
        </div>
      </div>

      {tab === 'group' && (
        <div className={`bg-white rounded-2xl border border-navy-100 card-shadow overflow-hidden flex flex-col ${expanded ? 'flex-1 min-h-0' : ''}`}>
          <div className="flex items-center justify-between gap-3 px-5 py-3 border-b border-navy-100 flex-wrap">
            <div className="text-sm font-bold text-navy-900">Academy Group Room <span className="text-gray-400 font-medium">({group.length} messages)</span></div>
            <button
              onClick={copyGroupLink}
              className={`flex items-center gap-1.5 text-xs font-bold px-3.5 py-2 rounded-lg transition ${copied ? 'bg-emerald-600 text-white' : 'bg-navy-50 hover:bg-navy-900 hover:text-gold-300 text-navy-800'}`}
            >
              {copied ? <Check className="w-3.5 h-3.5" /> : <Link2 className="w-3.5 h-3.5" />}
              {copied ? 'Copied!' : 'Copy Group Link'}
            </button>
          </div>
          <div className={`${expanded ? 'flex-1 min-h-[50vh]' : 'h-[46vh] min-h-[280px]'} overflow-y-auto scroll-thin p-4 space-y-3 bg-navy-50/40`}>
            {group.length === 0 ? (
              <EmptyState title="No group messages" message="Messages students post in the group room appear here." />
            ) : (
              group.map((m) => (
                <div key={m.id} className="flex gap-2.5 group/msg">
                  {m.sender_role === 'admin' ? (
                    <img src={LOGO_URL} alt="Admin" className="w-8 h-8 rounded-full object-cover ring-2 ring-gold-400 shrink-0" />
                  ) : m.student?.avatar_url ? (
                    <img src={m.student.avatar_url} alt="" className="w-8 h-8 rounded-full object-cover shrink-0" />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-navy-900 text-gold-300 font-extrabold text-xs flex items-center justify-center shrink-0">
                      {(m.sender_name || 'S').charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 text-[11px] font-bold">
                      <span className={m.sender_role === 'admin' ? 'text-gold-600' : 'text-navy-800'}>{m.sender_name}</span>
                      {m.sender_role === 'admin' && <span className="badge bg-navy-900 text-gold-300 !text-[9px]">ADMIN</span>}
                      <span className="text-gray-400 font-medium">{formatDateTime(m.created_at)}</span>
                    </div>
                    <div className="mt-1 inline-block text-sm px-3.5 py-2 rounded-xl bg-white border border-navy-100 text-navy-900 break-words">
                      {m.reply_to && (
                        <div className="mb-1.5 rounded-lg px-2.5 py-1.5 text-xs border-l-4 bg-navy-50 border-gold-500">
                          <div className="font-bold">{m.reply_to.name}</div>
                          <div className="opacity-70 truncate">{m.reply_to.text}</div>
                        </div>
                      )}
                      {renderBody(m)}
                    </div>
                  </div>
                  <button
                    onClick={() => deleteMsg(m.id, true)}
                    title="Delete message"
                    className="opacity-0 group-hover/msg:opacity-100 p-1.5 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 transition shrink-0 self-start"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))
            )}
            <div ref={groupBottom} />
          </div>
          <form onSubmit={sendGroup} className="border-t border-navy-100 p-4 flex gap-2">
            <input className="input-field" placeholder="Post as Admin to the group…" value={gText} maxLength={2000} onChange={(e) => setGText(e.target.value)} />
            <button type="submit" disabled={gSending || !gText.trim()} className="gold-btn font-bold px-5 rounded-xl disabled:opacity-50 flex items-center gap-2">
              {gSending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />} Send
            </button>
          </form>
        </div>
      )}

      {tab === 'private' && (
        <div className={`grid lg:grid-cols-[300px_1fr] gap-4 ${expanded ? 'flex-1 min-h-0' : ''}`}>
          <div className="bg-white rounded-2xl border border-navy-100 card-shadow overflow-hidden">
            <div className="p-3 border-b border-navy-100">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input className="input-field pl-9 !py-2 text-sm" placeholder="Search students…" value={pSearch} onChange={(e) => setPSearch(e.target.value)} />
              </div>
            </div>
            <div className={`${expanded ? 'flex-1 min-h-[40vh]' : 'max-h-[52vh]'} overflow-y-auto scroll-thin`}>
              {filteredThreads.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-10">No private chats yet.</p>
              ) : (
                filteredThreads.map((t) => (
                  <button
                    key={t.student_id}
                    onClick={() => openThread(t.student_id)}
                    className={`w-full text-left px-4 py-3 border-b border-navy-50 hover:bg-navy-50/60 transition flex items-center gap-3 ${activeId === t.student_id ? 'bg-gold-50' : ''}`}
                  >
                    {t.student?.avatar_url ? (
                      <img src={t.student.avatar_url} alt="" className="w-10 h-10 rounded-full object-cover shrink-0" />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-navy-900 text-gold-300 font-extrabold flex items-center justify-center shrink-0">
                        {(t.student?.full_name || 'S').charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-bold text-sm text-navy-900 truncate">{t.student?.full_name || `Student #${t.student_id}`}</span>
                        {t.unread > 0 && <span className="badge bg-red-600 text-white shrink-0">{t.unread}</span>}
                      </div>
                      <div className="text-xs text-gray-500 truncate">{t.last?.sender_role === 'admin' ? 'You: ' : ''}{t.last?.message}</div>
                      <div className="text-[10px] text-gray-400">{timeAgo(t.last?.created_at)}</div>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-navy-100 card-shadow overflow-hidden flex flex-col">
            {!activeId ? (
              <div className="flex-1 flex items-center justify-center py-20 text-center px-6">
                <div>
                  <Headset className="w-12 h-12 text-navy-200 mx-auto mb-3" />
                  <p className="font-bold text-navy-900">Select a student</p>
                  <p className="text-sm text-gray-500">Choose a conversation to read and reply privately.</p>
                </div>
              </div>
            ) : (
              <>
                <div className="px-5 py-3 border-b border-navy-100 flex items-center gap-3">
                  <ShieldCheck className="w-4 h-4 text-gold-600" />
                  <div className="font-bold text-sm text-navy-900">
                    {activeThread?.student?.full_name || `Student #${activeId}`}
                  </div>
                </div>
                <div className={`${expanded ? 'flex-1 min-h-[40vh]' : 'h-[42vh] min-h-[260px]'} overflow-y-auto scroll-thin p-4 space-y-3 bg-navy-50/40`}>
                  {pMessages.map((m) => {
                    const mine = m.sender_role === 'admin';
                    return (
                      <div key={m.id} className={`flex gap-2 ${mine ? 'flex-row-reverse' : ''} group/msg`}>
                        <div
                          className={`max-w-[80%] text-sm px-3.5 py-2 rounded-xl break-words ${
                            mine ? 'bg-navy-900 text-white rounded-tr-md' : 'bg-white border border-navy-100 text-navy-900 rounded-tl-md'
                          }`}
                        >
                          {m.reply_to && (
                            <div className={`mb-1.5 rounded-lg px-2.5 py-1.5 text-xs border-l-4 ${mine ? 'bg-black/15 border-gold-300' : 'bg-navy-50 border-gold-500'}`}>
                              <div className="font-bold opacity-80">{m.reply_to.name}</div>
                              <div className="opacity-70 truncate">{m.reply_to.text}</div>
                            </div>
                          )}
                          {renderBody(m)}
                          <div className={`text-[10px] mt-1 ${mine ? 'text-white/50' : 'text-gray-400'}`}>{fmtClock(m.created_at)}</div>
                        </div>
                        <div className="flex flex-col gap-1 self-start">
                          <button
                            onClick={() => setPReply(m)}
                            title="Reply"
                            className="opacity-0 group-hover/msg:opacity-100 p-1 rounded text-gray-300 hover:text-gold-600 transition"
                          >
                            <Reply className="w-3.5 h-3.5" />
                          </button>
                        <button
                          onClick={() => deleteMsg(m.id, false)}
                          title="Delete"
                          className="opacity-0 group-hover/msg:opacity-100 p-1 rounded text-gray-300 hover:text-red-500 transition"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                        </div>
                      </div>
                    );
                  })}
                  <div ref={privBottom} />
                </div>
                <div className="border-t border-navy-100 p-3 sm:p-4 bg-white">
                  {pReply && (
                    <div className="flex items-center justify-between bg-navy-50 border border-navy-100 rounded-xl px-3 py-2 mb-2 text-xs">
                      <div className="truncate">
                        <span className="font-bold text-navy-900">Replying to {pReply.sender_name}: </span>
                        <span className="text-gray-500">{String(pReply.message || '').slice(0, 80)}</span>
                      </div>
                      <button onClick={() => setPReply(null)} className="text-gray-400 hover:text-red-500 ml-2"><X className="w-4 h-4" /></button>
                    </div>
                  )}
                  {pEmojiOpen && (
                    <div className="bg-navy-50 border border-navy-100 rounded-xl p-2 mb-2 flex flex-wrap gap-1">
                      {EMOJIS.map((e) => (
                        <button key={e} type="button" onClick={() => setPText((t) => t + e)} className="text-lg hover:scale-125 transition p-0.5">{e}</button>
                      ))}
                    </div>
                  )}
                  <form onSubmit={sendPrivate} className="flex gap-2 items-end">
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => { setPAttachOpen(!pAttachOpen); setPEmojiOpen(false); }}
                        className="p-3 rounded-xl bg-navy-50 hover:bg-navy-900 hover:text-gold-300 text-navy-800 transition"
                        title="Attach"
                      >
                        <Paperclip className="w-4 h-4" />
                      </button>
                      {pAttachOpen && (
                        <div className="absolute bottom-13 left-0 mb-2 bg-white border border-navy-100 rounded-xl card-shadow p-2 w-40 space-y-1 z-10">
                          <button type="button" onClick={() => pImgRef.current?.click()} className="w-full flex items-center gap-2 text-xs font-semibold text-navy-900 hover:bg-navy-50 rounded-lg px-3 py-2">
                            <ImageIcon className="w-4 h-4 text-gold-600" /> Photo
                          </button>
                          <button type="button" onClick={() => pFileRef.current?.click()} className="w-full flex items-center gap-2 text-xs font-semibold text-navy-900 hover:bg-navy-50 rounded-lg px-3 py-2">
                            <FileText className="w-4 h-4 text-gold-600" /> Document
                          </button>
                        </div>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => { setPEmojiOpen(!pEmojiOpen); setPAttachOpen(false); }}
                      className={`p-3 rounded-xl transition ${pEmojiOpen ? 'bg-gold-400 text-navy-950' : 'bg-navy-50 hover:bg-navy-900 hover:text-gold-300 text-navy-800'}`}
                      title="Emoji"
                    >
                      <Smile className="w-4 h-4" />
                    </button>
                    <input className="input-field flex-1" placeholder={pUploading ? 'Uploading…' : 'Reply privately…'} value={pText} maxLength={2000} disabled={pUploading} onChange={(e) => setPText(e.target.value)} />
                    {pText.trim() || pUploading ? (
                      <button type="submit" disabled={pSending || !pText.trim()} className="gold-btn font-bold p-3 rounded-xl disabled:opacity-50 flex items-center">
                        {pSending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={togglePrivateRecord}
                        title={pRecording ? `Stop (${pRecSecs}s)` : 'Voice note'}
                        className={`font-bold p-3 rounded-xl flex items-center gap-1 transition ${pRecording ? 'bg-red-600 text-white animate-pulse' : 'bg-navy-900 text-gold-300 hover:bg-navy-800'}`}
                      >
                        {pRecording ? <Square className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                        {pRecording && <span className="text-xs font-mono">{pRecSecs}s</span>}
                      </button>
                    )}
                  </form>
                  <input ref={pImgRef} type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && sendPrivateAttachment(e.target.files[0])} />
                  <input ref={pFileRef} type="file" accept=".pdf,.doc,.docx,.txt,.zip,.xls,.xlsx,.ppt,.pptx" className="hidden" onChange={(e) => e.target.files?.[0] && sendPrivateAttachment(e.target.files[0])} />
                </div>
              </>
            )}
          </div>
        </div>
      )}
      </div>
    </div>
  );
}
