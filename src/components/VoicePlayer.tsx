import { useEffect, useRef, useState } from 'react';
import { Play, Pause, Mic, Loader2, AlertCircle } from 'lucide-react';

// Robust voice-note player: preloads metadata, shows duration + progress,
// surfaces load errors with a retry, and never shows a dead control.
export default function VoicePlayer({ src, dark = false }: { src: string; dark?: boolean }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [progress, setProgress] = useState(0);
  const [dur, setDur] = useState(0);
  const [cur, setCur] = useState(0);
  const [objectUrl, setObjectUrl] = useState<string | null>(null);

  // Fetch audio as a blob first: works around servers that don't support
  // range requests / odd MIME types, and gives instant, reliable playback.
  useEffect(() => {
    let cancelled = false;
    let url: string | null = null;
    setPlaying(false);
    setReady(false);
    setFailed(false);
    setProgress(0);
    setDur(0);
    setCur(0);
    setObjectUrl(null);
    (async () => {
      try {
        const res = await fetch(src, { headers: { Range: 'bytes=0-' } }).catch(() => null);
        const r = res && res.ok ? res : await fetch(src);
        if (!r.ok) throw new Error('fetch failed');
        const blob = await r.blob();
        if (cancelled) return;
        url = URL.createObjectURL(blob);
        setObjectUrl(url);
      } catch {
        if (!cancelled) {
          // Fall back to direct src streaming
          setObjectUrl(src);
        }
      }
    })();
    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [src]);

  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    const onEnd = () => {
      setPlaying(false);
      setProgress(0);
      setCur(0);
    };
    const onMeta = () => {
      setReady(true);
      setFailed(false);
      if (isFinite(a.duration)) setDur(a.duration);
    };
    const onTime = () => {
      setCur(a.currentTime);
      if (a.duration > 0) setProgress((a.currentTime / a.duration) * 100);
    };
    const onErr = () => {
      // Only flag failure if we never got metadata
      if (!a.duration || !isFinite(a.duration)) {
        setFailed(true);
        setReady(false);
      }
      setPlaying(false);
    };
    a.addEventListener('play', onPlay);
    a.addEventListener('pause', onPause);
    a.addEventListener('ended', onEnd);
    a.addEventListener('loadedmetadata', onMeta);
    a.addEventListener('canplay', onMeta);
    a.addEventListener('timeupdate', onTime);
    a.addEventListener('error', onErr);
    return () => {
      a.removeEventListener('play', onPlay);
      a.removeEventListener('pause', onPause);
      a.removeEventListener('ended', onEnd);
      a.removeEventListener('loadedmetadata', onMeta);
      a.removeEventListener('canplay', onMeta);
      a.removeEventListener('timeupdate', onTime);
      a.removeEventListener('error', onErr);
    };
  }, [src, objectUrl]);

  const fmt = (s: number) => {
    if (!isFinite(s) || s < 0) return '0:00';
    const m = Math.floor(s / 60);
    const r = Math.floor(s % 60);
    return `${m}:${String(r).padStart(2, '0')}`;
  };

  const toggle = async () => {
    const a = audioRef.current;
    if (!a) return;
    try {
      if (a.paused) {
        setFailed(false);
        await a.play();
      } else {
        a.pause();
      }
    } catch {
      setFailed(true);
      setPlaying(false);
    }
  };

  const retry = () => {
    const a = audioRef.current;
    if (!a) return;
    setFailed(false);
    setReady(false);
    // Bust any bad cache and reload directly
    const sep = src.includes('?') ? '&' : '?';
    a.src = `${src}${sep}retry=${Date.now()}`;
    a.load();
  };

  return (
    <span className={`inline-flex items-center gap-2 rounded-xl px-2.5 py-2 min-w-[210px] max-w-[240px] ${dark ? 'bg-black/20' : 'bg-navy-950/5'}`}>
      {objectUrl ? (
        <audio ref={audioRef} src={objectUrl} preload="auto" className="hidden" />
      ) : (
        <audio ref={audioRef} preload="none" className="hidden" />
      )}
      <button
        onClick={(e) => {
          e.stopPropagation();
          toggle();
        }}
        disabled={!ready && !failed}
        className={`w-9 h-9 shrink-0 rounded-full flex items-center justify-center transition ${
          dark ? 'bg-gold-400 text-navy-950' : 'bg-navy-900 text-gold-300'
        } disabled:opacity-50`}
        aria-label={playing ? 'Pause voice note' : 'Play voice note'}
        title={playing ? 'Pause' : 'Play'}
      >
        {!ready && !failed ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : playing ? (
          <Pause className="w-4 h-4" />
        ) : (
          <Play className="w-4 h-4 ml-0.5" />
        )}
      </button>
      <span className="flex-1 min-w-0">
        {failed ? (
          <span className="flex items-center gap-1.5 text-xs">
            <AlertCircle className="w-3.5 h-3.5 text-red-500 shrink-0" />
            <span className={dark ? 'text-white/80' : 'text-gray-600'}>Couldn't load audio.</span>
            <button onClick={(e) => { e.stopPropagation(); retry(); }} className="font-bold underline text-gold-600">
              Retry
            </button>
          </span>
        ) : (
          <>
            <span className="flex items-center gap-1 text-[10px] font-bold opacity-70">
              <Mic className="w-3 h-3" /> Voice note · {ready ? fmt(dur) : '…'}
            </span>
            <span className={`block h-1.5 rounded-full mt-1 overflow-hidden ${dark ? 'bg-white/20' : 'bg-navy-100'}`}>
              <span className="block h-full bg-gold-400 rounded-full transition-all" style={{ width: `${progress}%` }} />
            </span>
            <span className="block text-[10px] font-mono opacity-60 mt-0.5">
              {fmt(cur)} / {ready ? fmt(dur) : '…'}
            </span>
          </>
        )}
      </span>
    </span>
  );
}
