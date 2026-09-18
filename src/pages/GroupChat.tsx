import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Users, Send, Loader2, Link2, Check, ShieldCheck, Paperclip, Image as ImageIcon, FileText, X, Mic, Square, Smile, Reply, ChevronDown, Headset } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { apiFetch, formatDateTime, uploadFile } from '../lib/api';
import Spinner from '../components/Spinner';
import { EmptyState } from '../components/ui';
import VoicePlayer from '../components/VoicePlayer';
import ProfileCard from '../components/ProfileCard';

const LOGO_URL = 'https://www.designarena.ai/u/0af0c461-858d-45e6-8a72-5a9585d1cec0';

const EMOJIS = ['😀','😂','😍','👏','👍','🙏','🎉','🔥','❤️','😢','😮','🤔','👋','📚','✏️','💡','✅','❌','⭐','🎓'];

function fmtClock(iso: string) {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleTimeString('en-NG', { hour: 'numeric', minute: '2-digit' });
}

function dayLabel(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const sameDay = (a: Date, b: Date) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  if (sameDay(d, now)) return 'Today';
  const y = new Date(now);
  y.setDate(now.getDate() - 1);
  if (sameDay(d, y)) return 'Yesterday';
  return d.toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' });
}

function renderBody(m: any, darkVoice = false) {
  const kind = m.kind || 'text';
  if (kind === 'image' && m.attachment_url) {
    return (
      <span className="block">
        <img src={m.attachment_url} alt="shared" className="rounded-lg max-h-56 w-auto mb-1.5" loading="lazy" />
        {m.message && m.message !== '[image]' && <span className="block">{m.message}</span>}
      </span>
    );
  }
  if (kind === 'file' && m.attachment_url) {
    return (
      <span className="block">
        <a href={m.attachment_url} target="_blank" rel="noreferrer" className="flex items-center gap-2 underline break-all">
          <FileText className="w-4 h-4 shrink-0" /> {m.attachment_name || 'Attachment'}
        </a>
        {m.message && <span className="block mt-1">{m.message}</span>}
      </span>
    );
  }
  if (kind === 'voice' && m.attachment_url) {
    return (
      <span className="block">
        <VoicePlayer src={m.attachment_url} dark={darkVoice} />
      </span>
    );
  }
  // linkify URLs
  const parts = String(m.message || '').split(/(https?:\/\/[^\s]+)/g);
  return (
    <span>
      {parts.map((p: string, i: number) =>
        /^https?:\/\//.test(p) ? (
          <a key={i} href={p} target="_blank" rel="noreferrer" className="underline break-all text-inherit">
            {p}
          </a>
        ) : (
          <span key={i}>{p}</span>
        )
      )}
    </span>
  );
}

export default function GroupChat() {
  const { student, user } = useAuth();
  const navigate = useNavigate();
  const [messages, setMessages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showAttach, setShowAttach] = useState(false);
  const [showEmoji, setShowEmoji] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [replyTo, setReplyTo] = useState<any | null>(null);
  const [recording, setRecording] = useState(false);
  const [recSecs, setRecSecs] = useState(0);
  const [onlineCount, setOnlineCount] = useState(0);
  const [profileOpen, setProfileOpen] = useState(false);
  const [profilePerson, setProfilePerson] = useState<any | null>(null);
  const [profileIsAdmin, setProfileIsAdmin] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const pollRef = useRef<any>(null);
  const mediaRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const recTimer = useRef<any>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const imgRef = useRef<HTMLInputElement>(null);

  const groupUrl = `${window.location.origin}/group-chat`;

  const copyLink = async () => {
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

  const fetchAll = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const d = await apiFetch<any[]>('/api/chat?scope=group&limit=100');
      setMessages(d);
      setOnlineCount(new Set((d || []).slice(-30).map((m: any) => m.student_id || 'admin')).size);
    } catch (e) {
      console.error(e);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    fetchAll();
    pollRef.current = setInterval(() => fetchAll(true), 5000);
    return () => clearInterval(pollRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  const postMessage = async (payload: any) => {
    const m = await apiFetch<any>('/api/chat', { method: 'POST', body: JSON.stringify(payload) });
    setMessages((prev) => [...prev, m]);
    return m;
  };

  const basePayload = () => ({
    scope: 'group',
    student_id: student!.id,
    sender_name: student!.full_name,
    sender_role: 'student',
    reply_to: replyTo ? { id: replyTo.id, name: replyTo.sender_name, text: String(replyTo.message || '').slice(0, 120) } : null,
  });

  const send = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!text.trim() || sending || !student) return;
    setSending(true);
    try {
      await postMessage({ ...basePayload(), kind: 'text', message: text.trim() });
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
      await postMessage({
        ...basePayload(),
        kind: isImg ? 'image' : 'file',
        message: text.trim() || (isImg ? '[image]' : file.name),
        attachment_url: up.url,
        attachment_name: file.name,
      });
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
        setUploading(true);
        try {
          const up = await uploadFile(file, 'chat');
          await postMessage({ ...basePayload(), kind: 'voice', message: `Voice note (${recSecs}s)`, attachment_url: up.url, attachment_name: file.name });
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

  if (loading) return <Spinner label="Loading group chat…" />;

  let lastDay = '';

  return (
    <div className="bg-navy-950 flex-1 flex flex-col min-h-0 overflow-hidden">
      {/* Full-screen chat header */}
      <section className="bg-navy-950 hero-pattern border-b border-gold-400/25 py-2.5 shrink-0 z-30">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3">
              <img src={LOGO_URL} alt="" className="w-11 h-11 rounded-full object-cover ring-2 ring-gold-400" />
              <div>
                <h1 className="font-display font-extrabold text-xl md:text-2xl text-white">
                  Academy <span className="gold-text">Group Chat</span>
                </h1>
                <p className="text-white/60 text-xs flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 proctor-pulse"></span>
                  {onlineCount} active · moderated by admin
                </p>
              </div>
            </div>
            <button
              onClick={copyLink}
              className={`flex items-center gap-2 font-bold text-sm px-5 py-2.5 rounded-xl transition shrink-0 ${
                copied ? 'bg-emerald-500 text-white' : 'gold-btn'
              }`}
            >
              {copied ? <Check className="w-4 h-4" /> : <Link2 className="w-4 h-4" />}
              {copied ? 'Link Copied!' : 'Copy Group Link'}
            </button>
          </div>
        </div>
      </section>

      {/* Full-screen chat body — fills phone screen edge to edge */}
      <section className="flex-1 w-full max-w-6xl mx-auto px-0 sm:px-6 py-0 sm:py-3 flex flex-col min-h-0">
        <div className="bg-white sm:rounded-2xl border-y sm:border border-navy-100 card-shadow overflow-hidden flex flex-col flex-1 min-h-0">
          <div className="flex-1 overflow-y-auto scroll-thin p-4 sm:p-6 space-y-1 bg-navy-50/40" style={{ backgroundImage: 'radial-gradient(rgba(20,9,77,0.05) 1px, transparent 1px)', backgroundSize: '22px 22px' }}>
            {messages.length === 0 ? (
              <EmptyState title="No messages yet" message="Be the first to say hello to the academy!" />
            ) : (
              messages.map((m) => {
                const mine = student && m.student_id === student.id && m.sender_role === 'student';
                const isAdmin = m.sender_role === 'admin';
                const day = dayLabel(m.created_at);
                const showDay = day !== lastDay;
                lastDay = day;
                return (
                  <div key={m.id}>
                    {showDay && (
                      <div className="flex justify-center my-3">
                        <span className="text-[10px] font-bold uppercase tracking-wider bg-navy-900 text-gold-300 rounded-full px-3 py-1">{day}</span>
                      </div>
                    )}
                    <div className={`flex gap-2.5 py-1 ${mine ? 'flex-row-reverse' : ''}`}>
                      {isAdmin ? (
                        <button
                          onClick={() => { setProfilePerson(null); setProfileIsAdmin(true); setProfileOpen(true); }}
                          title="View admin profile"
                          className="shrink-0 self-end hover:scale-105 transition"
                        >
                          <img src={LOGO_URL} alt="Admin" className="w-9 h-9 rounded-full object-cover ring-2 ring-gold-400 cursor-pointer" />
                        </button>
                      ) : m.student?.avatar_url ? (
                        <button
                          onClick={() => { setProfilePerson(m.student); setProfileIsAdmin(false); setProfileOpen(true); }}
                          title={`View ${m.sender_name}'s profile`}
                          className="shrink-0 self-end hover:scale-105 transition"
                        >
                          <img src={m.student.avatar_url} alt="" className="w-9 h-9 rounded-full object-cover ring-1 ring-navy-100 cursor-pointer" />
                        </button>
                      ) : (
                        <button
                          onClick={() => { setProfilePerson(m.student?.id ? m.student : { full_name: m.sender_name }); setProfileIsAdmin(false); setProfileOpen(true); }}
                          title={`View ${m.sender_name}'s profile`}
                          className="shrink-0 self-end hover:scale-105 transition"
                        >
                          <div className="w-9 h-9 rounded-full bg-navy-900 text-gold-300 font-extrabold text-sm flex items-center justify-center cursor-pointer">
                            {(m.sender_name || 'S').charAt(0).toUpperCase()}
                          </div>
                        </button>
                      )}
                      <div className={`max-w-[78%] sm:max-w-[70%] ${mine ? 'text-right' : ''}`}>
                        <div className={`flex items-center gap-1.5 text-[11px] font-bold ${mine ? 'justify-end' : ''}`}>
                          <span className={isAdmin ? 'text-gold-600' : 'text-navy-800'}>
                            {mine ? 'You' : m.sender_name}
                          </span>
                          {isAdmin && (
                            <span className="badge bg-navy-900 text-gold-300 !text-[9px] flex items-center gap-0.5">
                              <ShieldCheck className="w-2.5 h-2.5" /> ADMIN
                            </span>
                          )}
                        </div>
                        <div
                          className={`mt-1 inline-block text-sm px-4 py-2.5 rounded-2xl leading-relaxed break-words text-left shadow-sm ${
                            isAdmin
                              ? 'bg-navy-900 text-white rounded-tl-md border border-gold-400/40'
                              : mine
                              ? 'bg-gold-400 text-navy-950 rounded-tr-md'
                              : 'bg-white border border-navy-100 text-navy-900 rounded-tl-md'
                          }`}
                        >
                          {m.reply_to && (
                            <div className={`mb-1.5 rounded-lg px-2.5 py-1.5 text-xs border-l-4 ${mine || isAdmin ? 'bg-black/15 border-gold-300' : 'bg-navy-50 border-gold-500'}`}>
                              <div className="font-bold opacity-80">{m.reply_to.name}</div>
                              <div className="opacity-70 truncate">{m.reply_to.text}</div>
                            </div>
                          )}
                          {renderBody(m, isAdmin || !!mine)}
                        </div>
                        <div className={`text-[10px] text-gray-400 mt-1 flex items-center gap-2 ${mine ? 'justify-end' : ''}`}>
                          {fmtClock(m.created_at)}
                          {user && student && (
                            <>
                              <button
                                onClick={() => setReplyTo(m)}
                                className="flex items-center gap-0.5 font-bold text-navy-400 hover:text-gold-600"
                                title="Reply"
                              >
                                <Reply className="w-3 h-3" /> Reply
                              </button>
                              {!mine && (
                                <button
                                  onClick={() => {
                                    if (isAdmin) navigate('/portal/messages');
                                    else if (m.student_id) navigate(`/portal/messages?peer=${m.student_id}&name=${encodeURIComponent(m.sender_name || 'Student')}`);
                                  }}
                                  className="flex items-center gap-0.5 font-bold text-navy-400 hover:text-gold-600"
                                  title={isAdmin ? 'Talk to admin privately' : `Message ${m.sender_name} privately (request first)`}
                                >
                                  <Headset className="w-3 h-3" /> {isAdmin ? 'DM Admin' : 'DM'}
                                </button>
                              )}
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
            <div ref={bottomRef} />
          </div>

          <div className="border-t border-navy-100 p-3 sm:p-4 bg-white">
            {user && student ? (
              <>
                {replyTo && (
                  <div className="flex items-center justify-between bg-navy-50 border border-navy-100 rounded-xl px-3 py-2 mb-2 text-xs">
                    <div className="truncate">
                      <span className="font-bold text-navy-900">Replying to {replyTo.sender_name}: </span>
                      <span className="text-gray-500">{String(replyTo.message || '').slice(0, 80)}</span>
                    </div>
                    <button onClick={() => setReplyTo(null)} className="text-gray-400 hover:text-red-500 ml-2"><X className="w-4 h-4" /></button>
                  </div>
                )}
                {showEmoji && (
                  <div className="bg-navy-50 border border-navy-100 rounded-xl p-2.5 mb-2 flex flex-wrap gap-1">
                    {EMOJIS.map((e) => (
                      <button key={e} onClick={() => setText((t) => t + e)} className="text-xl hover:scale-125 transition p-0.5">
                        {e}
                      </button>
                    ))}
                  </div>
                )}
                <form onSubmit={send} className="flex gap-2 items-end">
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => { setShowAttach(!showAttach); setShowEmoji(false); }}
                      className="p-3 rounded-xl bg-navy-50 hover:bg-navy-900 hover:text-gold-300 text-navy-800 transition"
                      title="Attach"
                    >
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
                <p className="text-[11px] text-gray-400 mt-2 flex items-center gap-1">
                  <ChevronDown className="w-3 h-3" /> Tap any avatar to view a profile · Photos, documents & voice notes supported · Abusive messages are removed by the admin.
                </p>
              </>
            ) : (
              <div className="text-center text-sm text-gray-500 py-2">
                <Link to="/login" className="font-bold text-navy-800 hover:text-gold-600">Login</Link> or{' '}
                <Link to="/register" className="font-bold text-navy-800 hover:text-gold-600">join free</Link> to chat with the group.
              </div>
            )}
          </div>
        </div>
      </section>

      <ProfileCard
        open={profileOpen}
        onClose={() => setProfileOpen(false)}
        person={profilePerson}
        isAdminCard={profileIsAdmin}
        showMessageButton={!!user && !!student}
        onMessage={(sid) =>
          profileIsAdmin || sid < 0
            ? navigate('/portal/messages')
            : navigate(`/portal/messages?peer=${sid}&name=${encodeURIComponent(profilePerson?.full_name || 'Student')}`)
        }
      />
    </div>
  );
}
