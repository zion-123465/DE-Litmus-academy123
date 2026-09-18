import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Send, Loader2, Headset, Paperclip, Image as ImageIcon, FileText, Smile, X, Mic, Square, Reply, Users, Check, Clock, Maximize2, Minimize2 } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { apiFetch, formatDateTime, uploadFile } from '../../lib/api';
import Spinner from '../../components/Spinner';
import VoicePlayer from '../../components/VoicePlayer';

const LOGO_URL = 'https://www.designarena.ai/u/0af0c461-858d-45e6-8a72-5a9585d1cec0';
const EMOJIS = ['😀','😂','😍','👏','👍','🙏','🎉','🔥','❤️','😢','😮','🤔','👋','📚','✏️','💡','✅','❌','⭐','🎓'];

type Convo =
  | { kind: 'admin' }
  | { kind: 'peer'; peerId: number; peer: any };

function fmtClock(iso: string) {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleTimeString('en-NG', { hour: 'numeric', minute: '2-digit' });
}

function renderBody(m: any) {
  if (m.kind === 'image' && m.attachment_url) {
    return (
      <span className="block">
        <img src={m.attachment_url} alt="shared" className="rounded-lg max-h-56 w-auto mb-1.5" loading="lazy" />
        {m.message && m.message !== '[image]' && <span className="block">{m.message}</span>}
      </span>
    );
  }
  if (m.kind === 'file' && m.attachment_url) {
    return (
      <span className="block">
        <a href={m.attachment_url} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 underline break-all">
          <FileText className="w-4 h-4 shrink-0" /> {m.attachment_name || 'Attachment'}
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

export default function StudentMessages() {
  const { student } = useAuth();
  const [params] = useSearchParams();
  const [convo, setConvo] = useState<Convo>({ kind: 'admin' });
  const [messages, setMessages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [showAttach, setShowAttach] = useState(false);
  const [showEmoji, setShowEmoji] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [replyTo, setReplyTo] = useState<any | null>(null);
  const [recording, setRecording] = useState(false);
  const [recSecs, setRecSecs] = useState(0);
  const [threads, setThreads] = useState<any[]>([]);
  const [requests, setRequests] = useState<any[]>([]);
  const [actingReq, setActingReq] = useState<number | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [mobileInboxOpen, setMobileInboxOpen] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const mediaRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const recTimer = useRef<any>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const imgRef = useRef<HTMLInputElement>(null);
  const convoRef = useRef<Convo>(convo);
  convoRef.current = convo;

  // ?peer=<id>&name=<name> deep-link from group chat profile cards
  useEffect(() => {
    const peer = params.get('peer');
    const name = params.get('name') || 'Student';
    if (peer && student && Number(peer) !== student.id) {
      setConvo({ kind: 'peer', peerId: Number(peer), peer: { id: Number(peer), full_name: name } });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [student?.id]);

  const fetchMessages = async (c: Convo, silent = false) => {
    if (!student) return;
    if (!silent) setLoading(true);
    try {
      const d =
        c.kind === 'admin'
          ? await apiFetch<any[]>(`/api/chat?scope=private&student_id=${student.id}&limit=200`)
          : await apiFetch<any[]>(`/api/dm?action=thread&me=${student.id}&peer=${c.peerId}&limit=200`).catch((e) => {
              if (String(e.message || '').includes('not accepted')) return [];
              throw e;
            });
      // refresh peer profile from thread payload
      if (c.kind === 'peer' && d.length) {
        const other = d.find((m: any) => Number(m.student_id) === c.peerId && m.student) || d.find((m: any) => m.peer && Number(m.peer.id) === c.peerId);
        const prof = other?.student && Number(other.student.id) === c.peerId ? other.student : other?.peer;
        if (prof) setConvo({ kind: 'peer', peerId: c.peerId, peer: prof });
      }
      setMessages(d);
    } catch (e) {
      console.error(e);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  const fetchInbox = async () => {
    if (!student) return;
    try {
      const [t, r] = await Promise.all([
        apiFetch<any[]>(`/api/dm?action=threads&student_id=${student.id}`),
        apiFetch<any[]>(`/api/dm?action=requests&student_id=${student.id}`),
      ]);
      setThreads(t || []);
      setRequests(r || []);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    if (!student) return;
    fetchInbox();
    fetchMessages(convoRef.current);
    const t = setInterval(() => {
      fetchInbox();
      fetchMessages(convoRef.current, true);
    }, 5000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [student?.id]);

  useEffect(() => {
    if (!student) return;
    setMessages([]);
    setReplyTo(null);
    fetchMessages(convo, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [convo.kind, (convo as any).peerId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length, expanded]);

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

  const basePayload = () =>
    convo.kind === 'admin'
      ? {
          scope: 'private',
          student_id: student!.id,
          sender_name: student!.full_name,
          sender_role: 'student',
          reply_to: replyTo ? { id: replyTo.id, name: replyTo.sender_name, text: String(replyTo.message || '').slice(0, 120) } : null,
        }
      : {
          action: 'send',
          from_id: student!.id,
          to_id: (convo as any).peerId,
          reply_to: replyTo
            ? { id: replyTo.id, name: replyTo.sender_name || replyTo.student?.full_name || 'Student', text: String(replyTo.message || '').slice(0, 120) }
            : null,
        };

  const postPayload = (p: any) =>
    convo.kind === 'admin'
      ? apiFetch<any>('/api/chat', { method: 'POST', body: JSON.stringify(p) })
      : apiFetch<any>('/api/dm', { method: 'POST', body: JSON.stringify(p) });

  const send = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!text.trim() || sending || !student) return;
    setSending(true);
    try {
      const m = await postPayload({ ...basePayload(), kind: 'text', message: text.trim() });
      setMessages((prev) => [...prev, m]);
      setText('');
      setReplyTo(null);
      setShowEmoji(false);
    } catch (err: any) {
      alert(err.message || 'Could not send message.');
    } finally {
      setSending(false);
    }
  };

  const sendAttachment = async (file: File) => {
    if (!student || uploading) return;
    if (file.size > 9 * 1024 * 1024) {
      alert('File too large. Maximum 9MB.');
      return;
    }
    setUploading(true);
    setShowAttach(false);
    try {
      const up = await uploadFile(file, 'chat');
      const isImg = file.type.startsWith('image/');
      const m = await postPayload({
        ...basePayload(),
        kind: isImg ? 'image' : 'file',
        message: text.trim() || (isImg ? '[image]' : file.name),
        attachment_url: up.url,
        attachment_name: file.name,
      });
      setMessages((prev) => [...prev, m]);
      setText('');
      setReplyTo(null);
    } catch (err: any) {
      alert(err.message || 'Upload failed.');
    } finally {
      setUploading(false);
    }
  };

  const toggleRecord = async () => {
    if (recording) {
      try {
        mediaRef.current?.stop();
      } catch {}
      return;
    }
    if (!student) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const rec = new MediaRecorder(stream);
      chunksRef.current = [];
      rec.ondataavailable = (e) => {
        if (e.data.size) chunksRef.current.push(e.data);
      };
      rec.onstop = async () => {
        clearInterval(recTimer.current);
        setRecording(false);
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: rec.mimeType || 'audio/webm' });
        if (blob.size < 500) return;
        const file = new File([blob], `voice-${Date.now()}.webm`, { type: 'audio/webm' });
        const secs = recSecs;
        setUploading(true);
        try {
          const up = await uploadFile(file, 'chat');
          const m = await postPayload({
            ...basePayload(),
            kind: 'voice',
            message: `Voice note (${secs}s)`,
            attachment_url: up.url,
            attachment_name: file.name,
          });
          setMessages((prev) => [...prev, m]);
          setReplyTo(null);
        } catch (err: any) {
          alert(err.message || 'Voice upload failed.');
        } finally {
          setUploading(false);
          setRecSecs(0);
        }
      };
      mediaRef.current = rec;
      rec.start();
      setRecording(true);
      setRecSecs(0);
      recTimer.current = setInterval(() => setRecSecs((s) => s + 1), 1000);
    } catch {
      alert('Microphone access was denied. Allow mic access to record voice notes.');
    }
  };

  const respondRequest = async (id: number, action: 'accept' | 'decline') => {
    setActingReq(id);
    try {
      const r = await apiFetch<any>('/api/dm', { method: 'PUT', body: JSON.stringify({ action, id, student_id: student!.id }) });
      setRequests((prev) => prev.map((x) => (x.id === id ? { ...x, status: r.status } : x)));
      if (action === 'accept') fetchInbox();
    } catch (err: any) {
      alert(err.message || 'Failed.');
    } finally {
      setActingReq(null);
    }
  };

  const withdraw = async (id: number) => {
    setActingReq(id);
    try {
      await apiFetch('/api/dm', { method: 'DELETE', body: JSON.stringify({ id, student_id: student!.id }) });
      setRequests((prev) => prev.filter((x) => x.id !== id));
    } catch (err: any) {
      alert(err.message || 'Failed.');
    } finally {
      setActingReq(null);
    }
  };

  const incoming = requests.filter((r) => r.status === 'pending' && Number(r.to_id) === student?.id);
  const outgoing = requests.filter((r) => r.status === 'pending' && Number(r.from_id) === student?.id);
  const isAdminConvo = convo.kind === 'admin';
  const peer = !isAdminConvo ? (convo as any).peer : null;
  const peerStatus = !isAdminConvo
    ? (() => {
        const rel = requests.find(
          (r) =>
            (Number(r.from_id) === (convo as any).peerId && Number(r.to_id) === student?.id) ||
            (Number(r.to_id) === (convo as any).peerId && Number(r.from_id) === student?.id)
        );
        if (threads.some((t) => Number(t.peer_id) === (convo as any).peerId)) return 'accepted';
        return rel?.status || 'none';
      })()
    : 'accepted';

  const startRequest = async () => {
    if (isAdminConvo || !student) return;
    try {
      const r = await apiFetch<any>('/api/dm', {
        method: 'POST',
        body: JSON.stringify({ action: 'request', from_id: student.id, to_id: (convo as any).peerId }),
      });
      setRequests((prev) => {
        const i = prev.findIndex((x) => x.id === r.id);
        if (i >= 0) {
          const c = [...prev];
          c[i] = { ...r, from: c[i].from, to: c[i].to };
          return c;
        }
        return [{ ...r, to: peer }, ...prev];
      });
    } catch (err: any) {
      alert(err.message || 'Could not send request.');
    }
  };

  if (loading && messages.length === 0) return <Spinner label="Loading your chats…" />;

  const peerAvatar = (p: any, size = 'w-10 h-10') =>
    p?.avatar_url ? (
      <img src={p.avatar_url} alt="" className={`${size} rounded-full object-cover shrink-0`} />
    ) : (
      <div className={`${size} rounded-full bg-navy-900 text-gold-300 font-extrabold flex items-center justify-center shrink-0`}>
        {(p?.full_name || 'S').charAt(0).toUpperCase()}
      </div>
    );

  return (
    <div className={expanded ? 'fixed inset-0 z-[95] bg-navy-950/90 backdrop-blur-sm p-2 sm:p-6 overflow-y-auto' : 'flex-1 flex flex-col min-h-0 bg-navy-50/60'}>
      <div className={expanded ? 'max-w-6xl mx-auto space-y-4 min-h-full flex flex-col' : 'flex-1 flex flex-col min-h-0 max-w-6xl w-full mx-auto p-2 sm:p-4 gap-3'}>
      <div className="flex items-center justify-between gap-3 flex-wrap shrink-0 px-1">
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={() => window.history.back()}
            className="lg:hidden p-2.5 rounded-xl bg-white border border-navy-100 text-navy-900 shrink-0"
            aria-label="Back"
          >
            ←
          </button>
          <div className="min-w-0">
            <h1 className={`font-display font-extrabold text-xl sm:text-2xl flex items-center gap-2 ${expanded ? 'text-white' : 'text-navy-900'}`}>
              <Headset className="w-5 h-5 sm:w-6 sm:h-6 text-gold-500 shrink-0" /> Messages
            </h1>
            <p className={`text-xs sm:text-sm truncate ${expanded ? 'text-white/70' : 'text-gray-500'}`}>Admin + fellow students · requests required for peers</p>
          </div>
        </div>
        <button
          onClick={() => setExpanded(!expanded)}
          title={expanded ? 'Exit full screen (Esc)' : 'Expand full screen'}
          className="flex items-center gap-2 bg-white border border-navy-100 hover:border-gold-400 font-bold text-xs px-4 py-2.5 rounded-xl text-navy-900 transition shrink-0"
        >
          {expanded ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          {expanded ? 'Exit' : 'Expand'}
        </button>
      </div>

      <div className="grid lg:grid-cols-[300px_1fr] gap-3 sm:gap-4 flex-1 min-h-0">
        {/* Inbox — on phones it becomes a slide-over toggled from the header */}
        <div className={`bg-white rounded-2xl border border-navy-100 card-shadow overflow-hidden flex-col min-h-0 ${mobileInboxOpen ? 'flex fixed inset-x-3 top-32 bottom-24 z-[60] lg:static' : 'hidden lg:flex'}`}>
          <div className="lg:hidden flex items-center justify-between px-4 py-2 border-b border-navy-100">
            <span className="text-xs font-bold text-navy-900">Conversations</span>
            <button onClick={() => setMobileInboxOpen(false)} className="p-1.5 rounded-lg hover:bg-navy-50 text-navy-700" aria-label="Close">
              <X className="w-4 h-4" />
            </button>
          </div>
          <button
            onClick={() => { setConvo({ kind: 'admin' }); setMobileInboxOpen(false); }}
            className={`w-full text-left px-4 py-3 border-b border-navy-100 hover:bg-navy-50/60 transition flex items-center gap-3 ${isAdminConvo ? 'bg-gold-50' : ''}`}
          >            <img src={LOGO_URL} alt="Admin" className="w-10 h-10 rounded-full object-cover ring-2 ring-gold-400 shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="font-bold text-sm text-navy-900">Academy Admin</div>
              <div className="text-[11px] text-emerald-600 font-semibold">Always available · replies here</div>
            </div>
          </button>

          {incoming.length > 0 && (
            <div className="px-3 py-2 border-b border-navy-100 bg-amber-50/60">
              <div className="text-[11px] font-bold uppercase tracking-wider text-amber-700 px-1 pb-1.5">Chat requests ({incoming.length})</div>
              <div className="space-y-1.5">
                {incoming.map((r) => (
                  <div key={r.id} className="flex items-center gap-2 bg-white border border-amber-200 rounded-xl px-2.5 py-2">
                    {peerAvatar(r.from, 'w-8 h-8')}
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-bold text-navy-900 truncate">{r.from?.full_name || `Student #${r.from_id}`}</div>
                      <div className="text-[10px] text-gray-500">wants to chat privately</div>
                    </div>
                    <button
                      onClick={() => respondRequest(r.id, 'accept')}
                      disabled={actingReq === r.id}
                      className="text-[11px] font-bold bg-emerald-600 text-white px-2.5 py-1.5 rounded-lg disabled:opacity-50"
                    >
                      Accept
                    </button>
                    <button
                      onClick={() => respondRequest(r.id, 'decline')}
                      disabled={actingReq === r.id}
                      className="text-[11px] font-bold bg-gray-100 text-gray-600 px-2.5 py-1.5 rounded-lg disabled:opacity-50"
                    >
                      Decline
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex-1 min-h-0 overflow-y-auto scroll-thin">
            {threads.length === 0 && outgoing.length === 0 ? (
              <p className="text-xs text-gray-400 text-center py-8 px-4">
                No student chats yet.<br />Tap any avatar in the group chat to view a profile and send a chat request.
              </p>
            ) : (
              <>
                {threads.map((t) => (
                  <button
                    key={t.peer_id}
                    onClick={() => { setConvo({ kind: 'peer', peerId: t.peer_id, peer: t.peer }); setMobileInboxOpen(false); }}
                    className={`w-full text-left px-4 py-3 border-b border-navy-50 hover:bg-navy-50/60 transition flex items-center gap-3 ${!isAdminConvo && (convo as any).peerId === t.peer_id ? 'bg-gold-50' : ''}`}
                  >
                    {peerAvatar(t.peer)}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-bold text-sm text-navy-900 truncate">{t.peer?.full_name || `Student #${t.peer_id}`}</span>
                        {t.unread > 0 && <span className="badge bg-red-600 text-white shrink-0">{t.unread}</span>}
                      </div>
                      <div className="text-xs text-gray-500 truncate">{t.last?.message}</div>
                    </div>
                  </button>
                ))}
                {outgoing.map((r) => (
                  <div key={r.id} className="px-4 py-3 border-b border-navy-50 flex items-center gap-3 opacity-80">
                    {peerAvatar(r.to)}
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-sm text-navy-900 truncate">{r.to?.full_name || `Student #${r.to_id}`}</div>
                      <div className="text-[11px] text-amber-600 font-semibold flex items-center gap-1"><Clock className="w-3 h-3" /> Request pending</div>
                    </div>
                    <button onClick={() => withdraw(r.id)} disabled={actingReq === r.id} className="text-[11px] font-bold text-gray-400 hover:text-red-500">
                      Withdraw
                    </button>
                  </div>
                ))}
              </>
            )}
          </div>
        </div>

        {/* Active conversation */}
        <div className="bg-white rounded-2xl border border-navy-100 card-shadow overflow-hidden flex flex-col min-h-0">
          <div className="px-4 sm:px-5 py-3 border-b border-navy-100 flex items-center gap-3 shrink-0">
            <button
              onClick={() => setMobileInboxOpen(true)}
              className="lg:hidden p-2 rounded-lg bg-navy-50 text-navy-800 shrink-0"
              aria-label="Open conversations"
              title="Conversations"
            >
              <Users className="w-4 h-4" />
            </button>
            {isAdminConvo ? (
            {isAdminConvo ? (
              <>
                <img src={LOGO_URL} alt="Admin" className="w-9 h-9 rounded-full object-cover ring-2 ring-gold-400" />
                <div>
                  <div className="font-bold text-sm text-navy-900">Academy Admin</div>
                  <div className="text-[11px] text-emerald-600 font-semibold">Private · admin replies here</div>
                </div>
              </>
            ) : (
              <>
                {peerAvatar(peer, 'w-9 h-9')}
                <div>
                  <div className="font-bold text-sm text-navy-900">{peer?.full_name || 'Student'}</div>
                  <div className="text-[11px] text-gray-500">
                    {peerStatus === 'accepted' ? 'Connected · private chat' : peerStatus === 'pending' || peerStatus === 'none' ? 'Request required to chat' : `Request ${peerStatus}`}
                  </div>
                </div>
              </>
            )}
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto scroll-thin p-4 space-y-3 bg-navy-50/40" style={{ backgroundImage: 'radial-gradient(rgba(20,9,77,0.05) 1px, transparent 1px)', backgroundSize: '22px 22px' }}>
            {!isAdminConvo && peerStatus !== 'accepted' ? (
              <div className="text-center py-12 px-6">
                <Users className="w-12 h-12 text-navy-200 mx-auto mb-3" />
                <p className="font-bold text-navy-900">Send a chat request first</p>
                <p className="text-sm text-gray-500 mt-1 max-w-xs mx-auto">
                  {peerStatus === 'pending'
                    ? `Your request to ${peer?.full_name || 'this student'} is pending. You'll be able to chat once they accept.`
                    : `Ask ${peer?.full_name || 'this student'} to accept your request before chatting privately.`}
                </p>
                {peerStatus !== 'pending' && (
                  <button onClick={startRequest} className="mt-4 gold-btn font-bold text-sm px-6 py-2.5 rounded-xl inline-flex items-center gap-2">
                    <Check className="w-4 h-4" /> Send Chat Request
                  </button>
                )}
              </div>
            ) : messages.length === 0 ? (
              <div className="text-center py-14">
                <img src={isAdminConvo ? LOGO_URL : peer?.avatar_url || LOGO_URL} alt="" className="w-16 h-16 rounded-full object-cover mx-auto ring-2 ring-gold-400 mb-4" />
                <p className="font-bold text-navy-900">No messages yet</p>
                <p className="text-sm text-gray-500 mt-1">Say hello to start the conversation.</p>
              </div>
            ) : (
              messages.map((m) => {
                const mine = isAdminConvo ? m.sender_role === 'student' : Number(m.student_id) === student?.id;
                const showAdmin = isAdminConvo && !mine;
                return (
                  <div key={m.id} className={`flex gap-2.5 ${mine ? 'flex-row-reverse' : ''}`}>
                    {showAdmin ? (
                      <img src={LOGO_URL} alt="Admin" className="w-9 h-9 rounded-full object-cover ring-2 ring-gold-400 shrink-0 self-end" />
                    ) : mine ? (
                      student?.avatar_url ? (
                        <img src={student.avatar_url} alt="" className="w-9 h-9 rounded-full object-cover ring-1 ring-navy-100 shrink-0 self-end" />
                      ) : (
                        <div className="w-9 h-9 rounded-full bg-navy-900 text-gold-300 font-extrabold text-sm flex items-center justify-center shrink-0 self-end">
                          {(student?.full_name || 'S').charAt(0).toUpperCase()}
                        </div>
                      )
                    ) : m.student?.avatar_url ? (
                      <img src={m.student.avatar_url} alt="" className="w-9 h-9 rounded-full object-cover ring-1 ring-navy-100 shrink-0 self-end" />
                    ) : (
                      <div className="w-9 h-9 rounded-full bg-navy-900 text-gold-300 font-extrabold text-sm flex items-center justify-center shrink-0 self-end">
                        {(m.student?.full_name || peer?.full_name || 'S').charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div className={`max-w-[75%] ${mine ? 'text-right' : ''}`}>
                      <div className={`text-[11px] font-bold ${mine ? 'text-navy-800' : showAdmin ? 'text-gold-600' : 'text-navy-800'}`}>
                        {mine ? 'You' : showAdmin ? 'Admin' : m.student?.full_name || peer?.full_name || 'Student'}
                      </div>
                      <div
                        className={`mt-1 inline-block text-sm px-4 py-2.5 rounded-2xl leading-relaxed break-words text-left shadow-sm ${
                          mine ? 'bg-gold-400 text-navy-950 rounded-tr-md' : showAdmin ? 'bg-navy-900 text-white rounded-tl-md border border-gold-400/40' : 'bg-white border border-navy-100 text-navy-900 rounded-tl-md'
                        }`}
                      >
                        {m.reply_to && (
                          <div className={`mb-1.5 rounded-lg px-2.5 py-1.5 text-xs border-l-4 ${mine || showAdmin ? 'bg-black/15 border-gold-300' : 'bg-navy-50 border-gold-500'}`}>
                            <div className="font-bold opacity-80">{m.reply_to.name}</div>
                            <div className="opacity-70 truncate">{m.reply_to.text}</div>
                          </div>
                        )}
                        {renderBody(m)}
                      </div>
                      <div className={`text-[10px] text-gray-400 mt-1 flex items-center gap-2 ${mine ? 'justify-end' : ''}`}>
                        {fmtClock(m.created_at)}
                        <button onClick={() => setReplyTo(m)} className="flex items-center gap-0.5 font-bold text-navy-400 hover:text-gold-600" title="Reply">
                          <Reply className="w-3 h-3" /> Reply
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
            <div ref={bottomRef} />
          </div>

          {(isAdminConvo || peerStatus === 'accepted') && (
            <div className="border-t border-navy-100 p-3 sm:p-4 bg-white">
              {replyTo && (
                <div className="flex items-center justify-between bg-navy-50 border border-navy-100 rounded-xl px-3 py-2 mb-2 text-xs">
                  <div className="truncate">
                    <span className="font-bold text-navy-900">Replying to {replyTo.sender_name || replyTo.student?.full_name || 'Student'}: </span>
                    <span className="text-gray-500">{String(replyTo.message || '').slice(0, 80)}</span>
                  </div>
                  <button onClick={() => setReplyTo(null)} className="text-gray-400 hover:text-red-500 ml-2"><X className="w-4 h-4" /></button>
                </div>
              )}
              {showEmoji && (
                <div className="bg-navy-50 border border-navy-100 rounded-xl p-2 mb-2 flex flex-wrap gap-1">
                  {EMOJIS.map((e) => (
                    <button key={e} type="button" onClick={() => setText((t) => t + e)} className="text-xl hover:scale-125 transition p-0.5">{e}</button>
                  ))}
                </div>
              )}
              <form onSubmit={send} className="flex gap-2 items-end">
                <div className="relative">
                  <button type="button" onClick={() => { setShowAttach(!showAttach); setShowEmoji(false); }} className="p-3 rounded-xl bg-navy-50 hover:bg-navy-900 hover:text-gold-300 text-navy-800 transition" title="Attach">
                    <Paperclip className="w-5 h-5" />
                  </button>
                  {showAttach && (
                    <div className="absolute bottom-14 left-0 bg-white border border-navy-100 rounded-xl card-shadow p-2 w-44 space-y-1 z-10">
                      <button type="button" onClick={() => imgRef.current?.click()} className="w-full flex items-center gap-2.5 text-sm font-semibold text-navy-900 hover:bg-navy-50 rounded-lg px-3 py-2">
                        <ImageIcon className="w-4 h-4 text-gold-600" /> Photo
                      </button>
                      <button type="button" onClick={() => fileRef.current?.click()} className="w-full flex items-center gap-2.5 text-sm font-semibold text-navy-900 hover:bg-navy-50 rounded-lg px-3 py-2">
                        <FileText className="w-4 h-4 text-gold-600" /> Document
                      </button>
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => { setShowEmoji(!showEmoji); setShowAttach(false); }}
                  className={`p-3 rounded-xl transition ${showEmoji ? 'bg-gold-400 text-navy-950' : 'bg-navy-50 hover:bg-navy-900 hover:text-gold-300 text-navy-800'}`}
                  title="Emoji"
                >
                  <Smile className="w-5 h-5" />
                </button>
                <input
                  className="input-field flex-1"
                  placeholder={uploading ? 'Uploading…' : 'Write a message…'}
                  value={text}
                  maxLength={2000}
                  disabled={uploading}
                  onChange={(e) => setText(e.target.value)}
                />
                {text.trim() || uploading ? (
                  <button type="submit" disabled={sending || !text.trim()} className="gold-btn font-bold p-3 rounded-xl disabled:opacity-50 flex items-center">
                    {sending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={toggleRecord}
                    title={recording ? `Stop recording (${recSecs}s)` : 'Record voice note'}
                    className={`font-bold p-3 rounded-xl flex items-center gap-1.5 transition ${recording ? 'bg-red-600 text-white animate-pulse' : 'bg-navy-900 text-gold-300 hover:bg-navy-800'}`}
                  >
                    {recording ? <Square className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
                    {recording && <span className="text-xs font-mono">{recSecs}s</span>}
                  </button>
                )}
              </form>
              <input ref={imgRef} type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && sendAttachment(e.target.files[0])} />
              <input ref={fileRef} type="file" accept=".pdf,.doc,.docx,.txt,.zip,.xls,.xlsx,.ppt,.pptx" className="hidden" onChange={(e) => e.target.files?.[0] && sendAttachment(e.target.files[0])} />
            </div>
          )}
        </div>
      </div>
      </div>
    </div>
  );
}
