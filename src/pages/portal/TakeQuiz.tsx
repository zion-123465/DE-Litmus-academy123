import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  Camera, Mic, ShieldCheck, AlertTriangle, Clock, CheckCircle2, XCircle,
  ChevronLeft, ChevronRight, Flag, Volume2, Maximize, Loader2, Trophy, Ticket, Eye,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { apiFetch, formatCategory, formatDuration, parseSetting } from '../../lib/api';
import Spinner from '../../components/Spinner';
import Modal from '../../components/Modal';

interface Question {
  id: number;
  quiz_id: number;
  question_text: string;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  marks: number;
}

interface WarningEntry {
  n: number;
  category: string;
  message: string;
  at: string;
  elapsed: number;
}

type Phase = 'gate' | 'exam' | 'result';

const COOLDOWNS: Record<string, number> = {
  tab: 5000, focus: 10000, fullscreen: 5000, noise: 20000,
  camera: 15000, face: 30000, gaze: 12000, eyes: 12000, head: 15000,
  multi: 20000, context: 30000, copy: 30000, devtools: 10000,
};

const SENSITIVITY_MAP: Record<string, number> = { low: 0.09, medium: 0.055, high: 0.03 };

export default function TakeQuiz() {
  const { quizId } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { student } = useAuth();

  const [phase, setPhase] = useState<Phase>('gate');
  const [quiz, setQuiz] = useState<any | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [attempt, setAttempt] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [gateError, setGateError] = useState('');
  const [code, setCode] = useState(searchParams.get('code') || '');
  const [maxWarnings, setMaxWarnings] = useState(20);
  const [noiseThreshold, setNoiseThreshold] = useState(0.055);
  const [requireCamera, setRequireCamera] = useState(true);
  const [requireFullscreen, setRequireFullscreen] = useState(true);

  // Devices
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [devicesReady, setDevicesReady] = useState(false);
  const [deviceError, setDeviceError] = useState('');
  const [testingDevices, setTestingDevices] = useState(false);
  const [micLevel, setMicLevel] = useState(0);

  // Exam state
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [currentIdx, setCurrentIdx] = useState(0);
  const [timeLeft, setTimeLeft] = useState(0);
  const [warnings, setWarnings] = useState(0);
  const [warningLog, setWarningLog] = useState<WarningEntry[]>([]);
  const [banner, setBanner] = useState<WarningEntry | null>(null);
  const [fsLost, setFsLost] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [confirmSubmit, setConfirmSubmit] = useState(false);
  const [result, setResult] = useState<any | null>(null);
  const [autoReason, setAutoReason] = useState('');
  const [verifyName, setVerifyName] = useState('');
  const [verifyEmail, setVerifyEmail] = useState('');
  const [verifyMatric, setVerifyMatric] = useState('');
  const [proctorStatus, setProctorStatus] = useState<'ok' | 'face-missing' | 'looking-away' | 'unstable'>('ok');

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const gateVideoRef = useRef<HTMLVideoElement | null>(null);
  const examRef = useRef<HTMLDivElement | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const lastWarnRef = useRef<Record<string, number>>({});
  const noiseHotRef = useRef(0);
  const darkFramesRef = useRef(0);
  const gazeAwayRef = useRef(0);
  const headTurnRef = useRef(0);
  const eyeMoveRef = useRef(0);
  const motionAlertRef = useRef(0);
  const multiFaceRef = useRef(0);
  const proctorStatusRef = useRef<'ok' | 'face-missing' | 'looking-away' | 'unstable'>('ok');
  const micLevelRef = useRef(0);
  const faceVisibleRef = useRef(true);
  const gazeOkRef = useRef(true);
  const baselineRef = useRef<{ cx: number; cy: number } | null>(null);
  const baselineFramesRef = useRef(0);
  const submittedRef = useRef(false);
  const timeLeftRef = useRef(0);
  const answersRef = useRef<Record<number, string>>({});
  const warningsRef = useRef(0);
  const warningLogRef = useRef<WarningEntry[]>([]);
  const attemptRef = useRef<any | null>(null);
  const questionsRef = useRef<Question[]>([]);
  const phaseRef = useRef<Phase>('gate');
  const bannerTimerRef = useRef<any>(null);
  const durationRef = useRef(0);

  phaseRef.current = phase;
  timeLeftRef.current = timeLeft;
  answersRef.current = answers;
  warningsRef.current = warnings;
  warningLogRef.current = warningLog;
  attemptRef.current = attempt;
  questionsRef.current = questions;

  // ---------- audible alert helpers ----------
  const beep = useCallback(() => {
    try {
      const Ctx = window.AudioContext || (window as any).webkitAudioContext;
      if (!Ctx) return;
      if (!audioCtxRef.current) audioCtxRef.current = new Ctx();
      const ctx = audioCtxRef.current;
      if (ctx.state === 'suspended') ctx.resume();
      [0, 0.28].forEach((delay) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'square';
        osc.frequency.value = 880;
        gain.gain.setValueAtTime(0.0001, ctx.currentTime + delay);
        gain.gain.exponentialRampToValueAtTime(0.25, ctx.currentTime + delay + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + delay + 0.22);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(ctx.currentTime + delay);
        osc.stop(ctx.currentTime + delay + 0.25);
      });
    } catch {}
  }, []);

  const speak = useCallback((text: string) => {
    try {
      if (!('speechSynthesis' in window)) return;
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.rate = 1.05;
      u.volume = 1;
      window.speechSynthesis.speak(u);
    } catch {}
  }, []);

  // ---------- warning engine ----------
  const addWarning = useCallback(
    (category: string, message: string, spoken?: string) => {
      if (phaseRef.current !== 'exam' || submittedRef.current) return;
      const now = Date.now();
      const last = lastWarnRef.current[category] || 0;
      if (now - last < (COOLDOWNS[category] || 8000)) return;
      // focus events that arrive right after a tab warning are the same offence
      if (category === 'focus' && now - (lastWarnRef.current['tab'] || 0) < 8000) return;
      lastWarnRef.current[category] = now;

      const n = warningsRef.current + 1;
      const entry: WarningEntry = {
        n,
        category,
        message,
        at: new Date().toISOString(),
        elapsed: durationRef.current * 60 - timeLeftRef.current,
      };
      setWarnings(n);
      setWarningLog((prev) => [...prev, entry]);
      setBanner(entry);
      if (bannerTimerRef.current) clearTimeout(bannerTimerRef.current);
      bannerTimerRef.current = setTimeout(() => setBanner(null), 5000);

      beep();
      speak(spoken || `Warning ${n} of ${maxWarnings}. ${message}. Please comply immediately.`);

      if (n >= maxWarnings) {
        setAutoReason('Maximum warnings reached — quiz auto-submitted');
        speak(`Final warning. ${maxWarnings} warnings reached. Your quiz is being submitted automatically now.`);
        submitExam(true, 'Maximum warnings reached — auto-submitted at 20 warnings');
      }
    },
    [beep, speak, maxWarnings]
  );

  // ---------- submit ----------
  const submitExam = useCallback(
    async (auto: boolean, reason = '') => {
      if (submittedRef.current) return;
      submittedRef.current = true;
      const att = attemptRef.current;
      if (!att) return;
      setSubmitting(true);
      setConfirmSubmit(false);
      if (reason) setAutoReason(reason);
      try {
        try {
          window.speechSynthesis?.cancel();
        } catch {}
        const data = await apiFetch<any>('/api/quiz-attempts', {
          method: 'POST',
          body: JSON.stringify({
            action: 'submit',
            attempt_id: att.id,
            answers: answersRef.current,
            warning_log: warningLogRef.current,
            time_spent_seconds: durationRef.current * 60 - timeLeftRef.current,
            auto,
          }),
        });
        setResult(data);
      } catch (e: any) {
        console.error('submit failed', e);
        setResult({ error: e.message || 'Submission failed. Your answers were saved — please contact support with attempt #' + att.id });
      } finally {
        cleanupMedia();
        try {
          if (document.fullscreenElement) await document.exitFullscreen();
        } catch {}
        setSubmitting(false);
        setPhase('result');
      }
    },
    []
  );

  const cleanupMedia = () => {
    try {
      const s = (window as any).__dla_stream as MediaStream | undefined;
      if (s) {
        s.getTracks().forEach((t) => t.stop());
        (window as any).__dla_stream = undefined;
      }
    } catch {}
    try {
      analyserRef.current?.disconnect();
    } catch {}
    analyserRef.current = null;
  };

  // ---------- initial load ----------
  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const [q, rows] = await Promise.all([
          apiFetch<any>(`/api/quizzes?id=${quizId}`),
          apiFetch<any[]>('/api/settings'),
        ]);
        if (!q) {
          setGateError('Quiz not found.');
          return;
        }
        setQuiz(q);
        const rules = rows.find((r) => r.key === 'quiz_rules');
        if (rules) {
          const p = parseSetting(rules);
          if (p) {
            if (p.max_warnings) setMaxWarnings(Number(p.max_warnings) || 20);
            if (p.noise_threshold && SENSITIVITY_MAP[p.noise_threshold]) setNoiseThreshold(SENSITIVITY_MAP[p.noise_threshold]);
            if (typeof p.require_camera === 'boolean') setRequireCamera(p.require_camera);
            if (typeof p.require_fullscreen === 'boolean') setRequireFullscreen(p.require_fullscreen);
          }
        }
      } catch (e: any) {
        setGateError(e.message || 'Could not load quiz.');
      } finally {
        setLoading(false);
      }
    })();
    return () => {
      cleanupMedia();
      try {
        window.speechSynthesis?.cancel();
      } catch {}
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quizId]);

  // ---------- device setup ----------
  const enableDevices = async () => {
    setDeviceError('');
    setTestingDevices(true);
    try {
      // Pre-fill identity verification from the student profile; student confirms before entering.
      if (student) {
        setVerifyName((v) => v || student.full_name || '');
        setVerifyEmail((v) => v || student.email || '');
        setVerifyMatric((v) => v || (student.matric_no as string) || '');
      }
      const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: 640 } }, audio: true });
      (window as any).__dla_stream = s;
      setStream(s);
      // analyser for mic
      try {
        const Ctx = window.AudioContext || (window as any).webkitAudioContext;
        const ctx = new Ctx();
        audioCtxRef.current = ctx;
        const src = ctx.createMediaStreamSource(s);
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 2048;
        src.connect(analyser);
        analyserRef.current = analyser;
      } catch (e) {
        console.error('analyser failed', e);
      }
      setTimeout(() => {
        if (gateVideoRef.current) {
          gateVideoRef.current.srcObject = s;
          gateVideoRef.current.play().catch(() => {});
        }
      }, 100);
      setDevicesReady(true);
      // mic meter loop for gate preview
      const buf = new Float32Array(2048);
      const tick = () => {
        if (phaseRef.current !== 'gate') return;
        const an = analyserRef.current;
        if (an) {
          an.getFloatTimeDomainData(buf as any);
          let sum = 0;
          for (let i = 0; i < buf.length; i++) sum += buf[i] * buf[i];
          const rms = Math.sqrt(sum / buf.length);
          setMicLevel(Math.min(100, Math.round((rms / 0.25) * 100)));
        }
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    } catch (e: any) {
      console.error(e);
      setDeviceError(
        e?.name === 'NotAllowedError'
          ? 'Camera/microphone permission was denied. Please allow access and try again — proctoring requires both.'
          : 'Could not access camera/microphone. Check your device and browser permissions, then retry.'
      );
    } finally {
      setTestingDevices(false);
    }
  };

  // ---------- start exam ----------
  const startExam = async () => {
    setGateError('');
    if (!student) {
      setGateError('Please login first.');
      return;
    }
    if (!student.matric_no || !String(student.matric_no).trim()) {
      setGateError('Your registration number is missing. Please add it on your Profile page before taking a quiz.');
      return;
    }
    // Order enforced: purchased quiz code FIRST, then personal details.
    if (!code.trim()) {
      setGateError('Step 1: enter the quiz code you purchased to activate your questions.');
      return;
    }
    if (!verifyName.trim() || !verifyEmail.trim() || !verifyMatric.trim()) {
      setGateError('Step 2: enter your name, email and registration number before starting.');
      return;
    }
    if (verifyEmail.trim().toLowerCase() !== String(student.email).toLowerCase()) {
      setGateError('The email entered does not match your student account email.');
      return;
    }
    if (verifyMatric.trim().toLowerCase() !== String(student.matric_no).trim().toLowerCase()) {
      setGateError('The registration number entered does not match your student profile.');
      return;
    }
    if (requireCamera && !devicesReady) {
      setGateError('Please enable your camera and microphone first.');
      return;
    }
    setSubmitting(true);
    try {
      const res = await apiFetch<any>('/api/quiz-attempts', {
        method: 'POST',
        body: JSON.stringify({ action: 'start', student_id: student.id, quiz_id: Number(quizId), code: code.trim() }),
      });
      const qs = await apiFetch<Question[]>(`/api/questions?quiz_id=${quizId}`);
      if (!qs.length) {
        setGateError('This quiz has no questions yet. Please contact the academy.');
        setSubmitting(false);
        return;
      }
      setAttempt(res.attempt);
      setQuestions(qs);
      if (res.attempt?.answers && typeof res.attempt.answers === 'object') setAnswers(res.attempt.answers);
      const dur = Number(quiz.duration_minutes) || 30;
      durationRef.current = dur;
      setTimeLeft(dur * 60);
      timeLeftRef.current = dur * 60;
      setWarnings(res.attempt?.warnings || 0);
      warningsRef.current = res.attempt?.warnings || 0;
      setWarningLog(Array.isArray(res.attempt?.warning_log) ? res.attempt.warning_log : []);
      warningLogRef.current = Array.isArray(res.attempt?.warning_log) ? res.attempt.warning_log : [];
      setPhase('exam');
      // fullscreen
      if (requireFullscreen) {
        try {
          await examRef.current?.requestFullscreen();
        } catch {
          console.warn('fullscreen request failed');
        }
      }
      setTimeout(() => {
        if (videoRef.current && (window as any).__dla_stream) {
          videoRef.current.srcObject = (window as any).__dla_stream;
          videoRef.current.play().catch(() => {});
        }
      }, 300);
      speak(`Exam started. You have ${dur} minutes. Stay in frame and keep quiet. Good luck.`);
    } catch (e: any) {
      setGateError(e.message || 'Could not start quiz. Check your code and try again.');
    } finally {
      setSubmitting(false);
    }
  };

  // ---------- exam loops: timer, mic, camera, heartbeat ----------
  useEffect(() => {
    if (phase !== 'exam') return;

    const timer = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) {
          clearInterval(timer);
          setTimeout(() => submitExam(false, "Time up — answers submitted"), 100);
          return 0;
        }
        if (t === 300) speak('Five minutes remaining.');
        if (t === 60) speak('One minute remaining.');
        return t - 1;
      });
    }, 1000);

    // mic noise monitor
    const buf = new Float32Array(2048);
    const micCheck = setInterval(() => {
      const an = analyserRef.current;
      if (!an) return;
      try {
        an.getFloatTimeDomainData(buf as any);
        let sum = 0;
        for (let i = 0; i < buf.length; i++) sum += buf[i] * buf[i];
        const rms = Math.sqrt(sum / buf.length);
        const pct = Math.min(100, Math.round((rms / 0.25) * 100));
        micLevelRef.current = pct;
        setMicLevel(pct);
        if (rms > noiseThreshold) {
          noiseHotRef.current += 1;
          if (noiseHotRef.current >= 8) {
            noiseHotRef.current = 0;
            addWarning('noise', 'Background noise detected — keep the room silent', undefined);
          }
        } else {
          noiseHotRef.current = 0;
        }
      } catch {}
    }, 200);

    // STRICT AI proctor: face presence + head movement + eye-region motion.
    // Runs every 800ms and separately detects:
    //  1. face not showing at all (no face in frame)
    //  2. head moved / face shifted position (looking away, turned head)
    //  3. eye-region movement (rapid eye motion / looking sideways)
    const canvas = document.createElement('canvas');
    canvas.width = 48;
    canvas.height = 48;
    const g = canvas.getContext('2d', { willReadFrequently: true });
    // Skin-tone pixel classifier (YCbCr-ish rule on RGB) used to find the face
    // blob and track its centroid as a proxy for head/eye direction.
    const isSkin = (r: number, gg: number, b: number) => {
      if (r < 40 || gg < 20 || b < 10) return false;
      if (Math.max(r, gg, b) - Math.min(r, gg, b) < 12) return false;
      if (Math.abs(r - gg) < 8) return false;
      if (r < gg || r < b) return false;
      return true;
    };
    let prevEyeSig: number[] | null = null;
    let prevFrameMean: number[] | null = null;
    const setStatus = (s: 'ok' | 'face-missing' | 'looking-away' | 'unstable') => {
      if (proctorStatusRef.current !== s) {
        proctorStatusRef.current = s;
        setProctorStatus(s);
      }
    };
    const camCheck = setInterval(() => {
      const s = (window as any).__dla_stream as MediaStream | undefined;
      if (!s) {
        if (requireCamera) addWarning('camera', 'Camera feed lost — reconnect immediately');
        return;
      }
      const track = s.getVideoTracks()[0];
      if (!track || track.readyState === 'ended' || !track.enabled) {
        addWarning('camera', 'Camera disconnected or disabled');
        return;
      }
      const v = videoRef.current;
      if (!v || v.videoWidth === 0 || !g) {
        if (requireCamera) {
          motionAlertRef.current += 1;
          if (motionAlertRef.current >= 3) {
            motionAlertRef.current = 0;
            faceVisibleRef.current = false;
            gazeOkRef.current = false;
            setStatus('face-missing');
            addWarning('face', 'Face not showing — the AI cannot see you. Face the camera now');
          }
        }
        return;
      }
      if (v && v.videoWidth > 0 && g) {
        try {
          g.drawImage(v, 0, 0, 48, 48);
          const px = g.getImageData(0, 0, 48, 48).data;
          let total = 0;
          let skinCount = 0;
          let sx = 0;
          let sy = 0;
          let minX = 48, maxX = -1, minY = 48, maxY = -1;
          for (let y = 0; y < 48; y++) {
            for (let x = 0; x < 48; x++) {
              const i = (y * 48 + x) * 4;
              const r = px[i];
              const gg = px[i + 1];
              const b = px[i + 2];
              total += (r + gg + b) / 3;
              if (isSkin(r, gg, b)) {
                skinCount++;
                sx += x;
                sy += y;
                if (x < minX) minX = x;
                if (x > maxX) maxX = x;
                if (y < minY) minY = y;
                if (y > maxY) maxY = y;
              }
            }
          }
          const mean = total / (48 * 48);
          const coverage = skinCount / (48 * 48);

          // ---- 1. FACE NOT SHOWING (strict, fast) ----
          const faceGone = mean < 9 || coverage < 0.015;
          faceVisibleRef.current = !faceGone;
          if (faceGone) {
            gazeOkRef.current = false;
            setStatus('face-missing');
            motionAlertRef.current = 0;
            gazeAwayRef.current += 1;
            if (gazeAwayRef.current >= 2) {
              gazeAwayRef.current = 0;
              baselineRef.current = null;
              baselineFramesRef.current = 0;
              prevEyeSig = null;
              addWarning(
                'face',
                mean < 9
                  ? 'Face not showing — the screen went dark. Sit in good light and face the camera'
                  : 'Face not showing — the AI cannot see you. Look at the screen now'
              );
            }
            return;
          }
          motionAlertRef.current = 0;
          gazeAwayRef.current = 0;

          // ---- 2. MULTIPLE FACES / SECOND PERSON ----
          // A second skin blob far from the main cluster suggests someone else.
          const faceW = maxX - minX + 1;
          const faceH = maxY - minY + 1;
          const spread = Math.max(faceW, faceH);
          if (coverage > 0.22 || spread >= 44) {
            multiFaceRef.current += 1;
            if (multiFaceRef.current >= 3) {
              multiFaceRef.current = 0;
              setStatus('unstable');
              addWarning('multi', 'Possible second person detected — only the candidate must be visible');
            }
          } else {
            multiFaceRef.current = 0;
          }

          // ---- 3. HEAD MOVEMENT (face position drift vs calibrated baseline) ----
          const cx = sx / skinCount;
          const cy = sy / skinCount;
          if (!baselineRef.current) {
            baselineFramesRef.current += 1;
            baselineRef.current = { cx, cy };
            if (baselineFramesRef.current < 3) return;
          }
          const bl: { cx: number; cy: number } = baselineRef.current;
          const drift = Math.hypot(cx - bl.cx, cy - bl.cy);
          if (drift > 8) {
            // Head moved / turned away from the screen position.
            headTurnRef.current += 1;
            gazeOkRef.current = false;
            setStatus('looking-away');
            if (headTurnRef.current >= 2) {
              headTurnRef.current = 0;
              addWarning('head', 'Head movement detected — face the screen directly, do not turn away');
            }
          } else {
            headTurnRef.current = 0;
            // Slowly adapt the baseline to natural posture shifts.
            baselineRef.current = { cx: bl.cx + (cx - bl.cx) * 0.05, cy: bl.cy + (cy - bl.cy) * 0.05 };
          }

          // ---- 4. EYE-REGION MOVEMENT (strict gaze tracking) ----
          // Compare the upper-face band (eye region) signature frame-to-frame.
          // Large rapid change = eyes darting / looking sideways / blinking off-screen.
          const eyeSig: number[] = [];
          const ey0 = Math.max(0, Math.floor(minY + faceH * 0.15));
          const ey1 = Math.min(47, Math.floor(minY + faceH * 0.45));
          for (let y = ey0; y <= ey1; y += 2) {
            let rowDark = 0;
            let rowN = 0;
            for (let x = Math.max(0, minX); x <= Math.min(47, maxX); x += 2) {
              const i = (y * 48 + x) * 4;
              const lum = (px[i] + px[i + 1] + px[i + 2]) / 3;
              rowDark += lum < 70 ? 1 : 0;
              rowN++;
            }
            eyeSig.push(rowN ? rowDark / rowN : 0);
          }
          if (prevEyeSig && prevEyeSig.length === eyeSig.length && eyeSig.length > 0) {
            let diff = 0;
            for (let k = 0; k < eyeSig.length; k++) diff += Math.abs(eyeSig[k] - prevEyeSig[k]);
            const avgDiff = diff / eyeSig.length;
            if (avgDiff > 0.22) {
              // Significant eye-region change between consecutive checks.
              eyeMoveRef.current += 1;
              gazeOkRef.current = false;
              setStatus('looking-away');
              if (eyeMoveRef.current >= 2) {
                eyeMoveRef.current = 0;
                addWarning('eyes', 'Eye movement detected — keep your eyes fixed on your questions');
              }
            } else {
              eyeMoveRef.current = 0;
              if (drift <= 8) {
                gazeOkRef.current = true;
                setStatus('ok');
              }
            }
          }
          prevEyeSig = eyeSig;

          // ---- 5. WHOLE-FRAME INSTABILITY (fidgeting / camera being moved) ----
          const frameMean: number[] = [];
          for (let b = 0; b < 8; b++) {
            let ssum = 0;
            let sn = 0;
            for (let y = b * 6; y < b * 6 + 6; y++) {
              for (let x = 0; x < 48; x += 3) {
                const i = (y * 48 + x) * 4;
                ssum += (px[i] + px[i + 1] + px[i + 2]) / 3;
                sn++;
              }
            }
            frameMean.push(ssum / Math.max(1, sn));
          }
          if (prevFrameMean) {
            let fdiff = 0;
            for (let k = 0; k < 8; k++) fdiff += Math.abs(frameMean[k] - prevFrameMean[k]);
            if (fdiff / 8 > 26) {
              darkFramesRef.current += 1;
              if (darkFramesRef.current >= 3) {
                darkFramesRef.current = 0;
                setStatus('unstable');
                addWarning('gaze', 'Unstable camera view — sit still and keep facing the screen');
              }
            } else {
              darkFramesRef.current = 0;
            }
          }
          prevFrameMean = frameMean;
        } catch {}
      }
    }, 800);

    // heartbeat to server
    const beat = setInterval(() => {
      const att = attemptRef.current;
      if (!att || submittedRef.current) return;
      apiFetch('/api/quiz-attempts', {
        method: 'POST',
        body: JSON.stringify({
          action: 'heartbeat',
          attempt_id: att.id,
          warnings: warningsRef.current,
          warning_log: warningLogRef.current,
          answers: answersRef.current,
        }),
      }).catch(() => {});
    }, 15000);

    // live camera feed: push a CLEAR high-resolution snapshot to the admin
    // monitor every 4s so the admin watching sees a sharp, clear picture
    const snapCanvas = document.createElement('canvas');
    snapCanvas.width = 640;
    snapCanvas.height = 480;
    const snapCtx = snapCanvas.getContext('2d', { willReadFrequently: true });
    const snap = setInterval(() => {
      const att = attemptRef.current;
      if (!att || submittedRef.current) return;
      const v = videoRef.current;
      let image: string | null = null;
      try {
        if (v && v.videoWidth > 0 && snapCtx) {
          // cover-fit the video frame into 640x480 without stretching
          const vw = v.videoWidth;
          const vh = v.videoHeight;
          const scale = Math.max(640 / vw, 480 / vh);
          const dw = vw * scale;
          const dh = vh * scale;
          snapCtx.fillStyle = '#000';
          snapCtx.fillRect(0, 0, 640, 480);
          snapCtx.drawImage(v, (640 - dw) / 2, (480 - dh) / 2, dw, dh);
          image = snapCanvas.toDataURL('image/jpeg', 0.85);
        }
      } catch {}
      apiFetch('/api/live-feed', {
        method: 'POST',
        body: JSON.stringify({
          attempt_id: att.id,
          student_id: att.student_id,
          image,
          warnings: warningsRef.current,
          mic_level: micLevelRef.current,
          face_visible: faceVisibleRef.current,
          gaze_ok: gazeOkRef.current,
          answered: Object.keys(answersRef.current).length,
          total: questionsRef.current.length,
        }),
      }).catch(() => {});
    }, 4000);

    // anti-cheat listeners
    const onVis = () => {
      if (document.hidden) addWarning('tab', 'Tab switch detected — stay on the exam page');
    };
    const onBlur = () => addWarning('focus', 'Window focus lost — return to the exam immediately');
    const onFs = () => {
      if (!document.fullscreenElement && requireFullscreen && phaseRef.current === 'exam' && !submittedRef.current) {
        setFsLost(true);
        addWarning('fullscreen', 'Fullscreen exited — return to fullscreen now');
      } else {
        setFsLost(false);
      }
    };
    const onCtx = (e: Event) => {
      e.preventDefault();
      addWarning('context', 'Right-click is disabled during exams');
    };
    const onCopy = (e: Event) => {
      e.preventDefault();
      addWarning('copy', 'Copying is disabled during exams');
    };
    const onKey = (e: KeyboardEvent) => {
      const k = e.key;
      if (k === 'F12' || ((e.ctrlKey || e.metaKey) && ['u', 's', 'p'].includes(k.toLowerCase())) || (e.ctrlKey && e.shiftKey && ['i', 'j', 'c'].includes(k.toLowerCase()))) {
        e.preventDefault();
        addWarning('devtools', 'Developer tools and shortcuts are blocked');
      }
      if (k === 'PrintScreen') addWarning('devtools', 'Screenshots are not allowed');
    };
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };

    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('blur', onBlur);
    document.addEventListener('fullscreenchange', onFs);
    document.addEventListener('contextmenu', onCtx);
    document.addEventListener('copy', onCopy);
    document.addEventListener('cut', onCopy);
    document.addEventListener('paste', onCopy);
    document.addEventListener('keydown', onKey);
    window.addEventListener('beforeunload', onBeforeUnload);

    return () => {
      clearInterval(timer);
      clearInterval(micCheck);
      clearInterval(camCheck);
      clearInterval(beat);
      clearInterval(snap);
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('blur', onBlur);
      document.removeEventListener('fullscreenchange', onFs);
      document.removeEventListener('contextmenu', onCtx);
      document.removeEventListener('copy', onCopy);
      document.removeEventListener('cut', onCopy);
      document.removeEventListener('paste', onCopy);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('beforeunload', onBeforeUnload);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, noiseThreshold, requireCamera, requireFullscreen]);

  const mm = Math.floor(timeLeft / 60);
  const ss = timeLeft % 60;
  const answeredCount = Object.keys(answers).length;
  const danger = timeLeft < 300;
  const crit = timeLeft < 60;

  const selectOption = (qid: number, opt: string) => {
    if (submittedRef.current) return;
    setAnswers((prev) => ({ ...prev, [qid]: opt }));
  };

  const reenterFullscreen = async () => {
    try {
      await examRef.current?.requestFullscreen();
      setFsLost(false);
    } catch {
      addWarning('fullscreen', 'Could not re-enter fullscreen — tap again');
    }
  };

  // ================= RENDER: GATE =================
  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Spinner label="Loading exam hall…" />
      </div>
    );
  }

  if (phase === 'gate') {
    return (
      <div className="max-w-3xl mx-auto space-y-5">
        <div className="bg-navy-950 hero-pattern rounded-2xl p-6 md:p-8 text-white card-shadow">
          <div className="text-xs font-bold tracking-[0.25em] text-gold-400 uppercase">Proctored Exam Hall</div>
          <h1 className="font-display font-extrabold text-2xl md:text-3xl mt-2">{quiz?.title || 'Quiz'}</h1>
          <div className="flex flex-wrap gap-2 mt-3">
            <span className="badge bg-white/10 text-white">{formatCategory(quiz?.level)}</span>
            <span className="badge bg-white/10 text-white">{quiz?.department}</span>
            <span className="badge bg-gold-400 text-navy-950 flex items-center gap-1"><Clock className="w-3 h-3" /> {quiz?.duration_minutes} mins</span>
            <span className="badge bg-white/10 text-white">Pass {quiz?.pass_mark}%</span>
          </div>
          {quiz?.description && <p className="text-white/65 text-sm mt-3">{quiz.description}</p>}
          {quiz?.instructions && (
            <div className="mt-4 bg-white/5 border border-white/10 rounded-xl p-4 text-sm text-white/75 whitespace-pre-line">{quiz.instructions}</div>
          )}
        </div>

        <div className="bg-white rounded-2xl border border-navy-100 p-6 card-shadow">
          <h3 className="font-bold text-navy-900 flex items-center gap-2 mb-4">
            <ShieldCheck className="w-5 h-5 text-gold-600" /> Exam Rules — Read Carefully
          </h3>
          <ul className="space-y-2.5 text-sm text-gray-600">
            {[
              `Your camera and microphone stay ON throughout. Your live camera feed is visible to the admin. The AI strictly monitors your face and eyes — if your face moves, your eyes move, or your face is not showing, you get an instant cheating warning.`,
              `Each offence triggers an AUDIBLE spoken warning plus a siren.`,
              `At ${maxWarnings} warnings your quiz is AUTO-SUBMITTED immediately.`,
              'Do not switch tabs, minimise, exit fullscreen, right-click, copy or open developer tools.',
              'Keep your face centred, eyes on your questions, and the room silent. The timer cannot be paused.',
            ].map((r, i) => (
              <li key={i} className="flex gap-2.5">
                <span className="w-5 h-5 shrink-0 rounded-full bg-navy-900 text-gold-300 text-[11px] font-bold flex items-center justify-center mt-0.5">{i + 1}</span>
                {r}
              </li>
            ))}
          </ul>
        </div>

        <div className="bg-white rounded-2xl border border-navy-100 p-6 card-shadow space-y-4">
          <h3 className="font-bold text-navy-900 flex items-center gap-2">
            <Ticket className="w-5 h-5 text-gold-600" /> Step 1 — Enter Quiz Code
          </h3>
          <p className="text-xs text-gray-500">Step 1 of 3 — input your purchased quiz code first to activate your questions. Each code works only once and deactivates after use.</p>
          <input
            className="input-field font-mono font-bold tracking-widest uppercase text-center text-lg"
            placeholder="DLA-XXXX-XXXX"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
          />
          {!code && (
            <p className="text-xs text-gray-500 text-center">
              No code? <Link to="/portal/buy-code" className="font-bold text-navy-800 hover:text-gold-600">Buy one here</Link>
            </p>
          )}
        </div>

        <div className="bg-white rounded-2xl border border-navy-100 p-6 card-shadow space-y-4">
          <h3 className="font-bold text-navy-900 flex items-center gap-2">
            <Eye className="w-5 h-5 text-gold-600" /> Step 2 — Eye & Face Monitoring Check
          </h3>
          {!devicesReady ? (
            <>
              <p className="text-sm text-gray-500">
                Grant camera and microphone access so the proctor can monitor your session. Your live camera
                feed is visible to the admin while you write.
              </p>
              <button
                onClick={enableDevices}
                disabled={testingDevices}
                className="gold-btn font-bold text-sm px-6 py-3 rounded-xl flex items-center gap-2 disabled:opacity-60"
              >
                {testingDevices ? <Loader2 className="w-4 h-4 animate-spin" /> : <Camera className="w-4 h-4" />}
                {testingDevices ? 'Requesting access…' : 'Enable Camera & Mic'}
              </button>
              {deviceError && (
                <div className="flex items-start gap-2 bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3">
                  <XCircle className="w-4 h-4 mt-0.5 shrink-0" /> {deviceError}
                </div>
              )}
            </>
          ) : (
            <div className="grid sm:grid-cols-2 gap-4 items-center">
              <div className="relative rounded-xl overflow-hidden bg-navy-950 aspect-video">
                <video ref={gateVideoRef} muted playsInline className="w-full h-full object-cover mirror" style={{ transform: 'scaleX(-1)' }} />
                <span className="absolute top-2 left-2 badge bg-red-600 text-white proctor-pulse">● LIVE</span>
              </div>
              <div>
                <div className="flex items-center gap-2 text-sm font-bold text-emerald-700">
                  <CheckCircle2 className="w-5 h-5" /> Devices working
                </div>
                <div className="mt-3">
                  <div className="flex items-center gap-2 text-xs font-semibold text-gray-500 mb-1">
                    <Mic className="w-3.5 h-3.5" /> Microphone level — speak to test
                  </div>
                  <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-emerald-500 via-gold-400 to-red-500 transition-all" style={{ width: `${micLevel}%` }}></div>
                  </div>
                </div>
                <p className="text-xs text-gray-500 mt-3">Strict AI watch: keep your face centred in good light. Any face movement, eye movement, or missing face raises an instant cheating warning.</p>
              </div>
            </div>
          )}
        </div>

        {gateError && (
          <div className="flex items-start gap-2 bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3">
            <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" /> {gateError}
          </div>
        )}

        <div className="bg-white rounded-2xl border border-navy-100 p-6 card-shadow space-y-4">
          <h3 className="font-bold text-navy-900 flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-gold-600" /> Step 3 — Confirm Your Details
          </h3>
          <p className="text-xs text-gray-500">
            After entering your quiz code above, enter your name, email and registration number exactly as on your student profile. They must match before you can start.
          </p>
          <div className="grid sm:grid-cols-2 gap-3">
            <div className="sm:col-span-2">
              <label className="label-text">Full Name *</label>
              <input className="input-field" placeholder="e.g. Adaeze Okafor" value={verifyName} onChange={(e) => setVerifyName(e.target.value)} />
            </div>
            <div>
              <label className="label-text">Email *</label>
              <input type="email" className="input-field" placeholder="you@example.com" value={verifyEmail} onChange={(e) => setVerifyEmail(e.target.value)} />
            </div>
            <div>
              <label className="label-text">Registration Number *</label>
              <input className="input-field font-mono" placeholder="e.g. DLA/2026/001" value={verifyMatric} onChange={(e) => setVerifyMatric(e.target.value)} />
            </div>
          </div>
        </div>

        <button
          onClick={startExam}
          disabled={submitting || (requireCamera && !devicesReady)}
          className="w-full gold-btn font-extrabold py-4 rounded-2xl text-base disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Maximize className="w-5 h-5" />}
          {submitting ? 'Verifying code & opening hall…' : 'Enter Exam Hall (Fullscreen)'}
        </button>
      </div>
    );
  }

  // ================= RENDER: RESULT =================
  if (phase === 'result') {
    if (result?.error) {
      return (
        <div className="max-w-xl mx-auto bg-white rounded-2xl border border-red-200 p-8 text-center">
          <XCircle className="w-14 h-14 mx-auto text-red-500" />
          <h2 className="font-bold text-navy-900 text-xl mt-4">Submission Issue</h2>
          <p className="text-sm text-gray-500 mt-2">{result.error}</p>
          <button onClick={() => navigate('/portal/scores')} className="mt-5 gold-btn font-bold text-sm px-6 py-3 rounded-xl">
            Go to My Scores
          </button>
        </div>
      );
    }
    const pct = Number(result?.percentage) || 0;
    const pass = !!result?.passed;
    return (
      <div className="max-w-2xl mx-auto space-y-5">
        <div className={`rounded-3xl p-8 text-center card-shadow text-white ${pass ? 'bg-emerald-600' : 'bg-navy-950'}`}>
          {pass ? <Trophy className="w-16 h-16 mx-auto text-gold-300" /> : <Flag className="w-14 h-14 mx-auto text-gold-400" />}
          <h2 className="font-display font-extrabold text-3xl mt-4">{pct}%</h2>
          <p className="font-bold mt-1">{pass ? 'Congratulations — You Passed!' : 'Keep Moving — Try Again!'}</p>
          <p className="text-white/70 text-sm mt-2">
            {result?.score ?? 0} / {result?.total_marks ?? 0} marks · {formatDuration(result?.time_spent_seconds || 0)} spent
            {autoReason ? ` · ${autoReason}` : ''}
          </p>
          {pass && <p className="text-gold-300 text-sm font-bold mt-2">De-Litmus Academy celebrates your honest success ★</p>}
        </div>

        <div className="bg-white rounded-2xl border border-navy-100 p-6">
          <h3 className="font-bold text-navy-900 mb-3 flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-amber-500" /> Proctoring Record ({warningLog.length} warnings)
          </h3>
          {warningLog.length === 0 ? (
            <p className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4" /> Clean session — zero warnings. Exemplary conduct!
            </p>
          ) : (
            <div className="max-h-56 overflow-y-auto scroll-thin space-y-2">
              {warningLog.map((w) => (
                <div key={w.n} className="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-xs">
                  <span className="font-extrabold text-amber-700">#{w.n}</span>
                  <span className="flex-1 text-gray-700">{w.message}</span>
                  <span className="text-gray-400 font-mono">{formatDuration(w.elapsed)}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex flex-wrap gap-3 justify-center">
          <button onClick={() => navigate('/portal/scores')} className="gold-btn font-bold text-sm px-6 py-3 rounded-xl">View All Scores</button>
          <button onClick={() => navigate('/portal/start-quiz')} className="border border-navy-100 bg-white hover:border-gold-400 font-bold text-sm px-6 py-3 rounded-xl text-navy-900">
            Take Another Quiz
          </button>
        </div>
      </div>
    );
  }

  // ================= RENDER: EXAM =================
  const q = questions[currentIdx];
  return (
    <div ref={examRef} className="bg-navy-950 min-h-screen no-select relative">
      {banner && (
        <div className="fixed top-0 left-0 right-0 z-[90] warn-flash">
          <div className="bg-red-600 text-white px-4 py-3 flex items-center gap-3 shadow-2xl">
            <Volume2 className="w-6 h-6 shrink-0 animate-pulse" />
            <div className="flex-1 min-w-0">
              <div className="font-extrabold text-sm sm:text-base">
                ⚠ WARNING {banner.n} / {maxWarnings}
              </div>
              <div className="text-xs sm:text-sm text-white/90 truncate">{banner.message}</div>
            </div>
            <AlertTriangle className="w-6 h-6 shrink-0" />
          </div>
        </div>
      )}

      {/* top bar */}
      <div className={`sticky top-0 z-40 border-b border-gold-400/30 ${banner ? 'mt-[68px]' : ''} bg-navy-950/95 backdrop-blur`}>
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <ShieldCheck className="w-5 h-5 text-gold-400 shrink-0" />
            <span className="font-bold text-white text-sm truncate hidden sm:inline">{quiz?.title}</span>
          </div>
          <div className="flex-1"></div>
          <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-extrabold text-sm tick-tock ${crit ? 'bg-red-600 text-white animate-pulse' : danger ? 'bg-amber-500 text-navy-950' : 'bg-white/10 text-gold-300'}`}>
            <Clock className="w-4 h-4" /> {mm}:{String(ss).padStart(2, '0')}
          </div>
          <div className={`px-3 py-1.5 rounded-lg font-extrabold text-sm ${warnings >= maxWarnings - 5 ? 'bg-red-600 text-white' : 'bg-white/10 text-white'}`}>
            ⚠ {warnings}/{maxWarnings}
          </div>
          <button
            onClick={() => setConfirmSubmit(true)}
            className="gold-btn font-bold text-xs sm:text-sm px-3 sm:px-4 py-2 rounded-lg"
          >
            Submit
          </button>
        </div>
        <div className="h-1 bg-white/10">
          <div className="h-full bg-gold-400 transition-all" style={{ width: `${(answeredCount / Math.max(1, questions.length)) * 100}%` }}></div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-6 grid lg:grid-cols-[1fr_240px] gap-5 pb-40">
        {/* question card */}
        <div className="bg-white rounded-2xl p-5 sm:p-8 card-shadow">
          <div className="flex items-center justify-between text-xs font-bold text-gray-400 mb-4">
            <span>QUESTION {currentIdx + 1} OF {questions.length}</span>
            <span>{q?.marks || 1} MARK{(q?.marks || 1) === 1 ? '' : 'S'}</span>
          </div>
          <h2 className="font-bold text-navy-900 text-base sm:text-lg leading-relaxed">{q?.question_text}</h2>
          <div className="mt-6 space-y-3">
            {(['A', 'B', 'C', 'D'] as const).map((opt) => {
              const key = `option_${opt.toLowerCase()}` as keyof Question;
              const selected = answers[q?.id] === opt;
              return (
                <button
                  key={opt}
                  onClick={() => selectOption(q.id, opt)}
                  className={`w-full text-left flex items-start gap-3 rounded-xl border-2 px-4 py-3.5 transition ${
                    selected ? 'border-gold-500 bg-gold-50 shadow' : 'border-navy-100 hover:border-gold-400 bg-white'
                  }`}
                >
                  <span
                    className={`w-8 h-8 shrink-0 rounded-lg font-extrabold text-sm flex items-center justify-center ${
                      selected ? 'bg-gold-400 text-navy-950' : 'bg-navy-50 text-navy-800'
                    }`}
                  >
                    {opt}
                  </span>
                  <span className="text-sm text-navy-900 font-medium pt-1.5">{String(q?.[key] || '')}</span>
                </button>
              );
            })}
          </div>
          <div className="mt-8 flex items-center justify-between">
            <button
              onClick={() => setCurrentIdx((i) => Math.max(0, i - 1))}
              disabled={currentIdx === 0}
              className="flex items-center gap-1.5 text-sm font-bold text-navy-800 border border-navy-100 px-4 py-2.5 rounded-xl disabled:opacity-40 hover:border-gold-400"
            >
              <ChevronLeft className="w-4 h-4" /> Prev
            </button>
            <span className="text-xs text-gray-400 font-semibold">{answeredCount}/{questions.length} answered</span>
            {currentIdx < questions.length - 1 ? (
              <button
                onClick={() => setCurrentIdx((i) => Math.min(questions.length - 1, i + 1))}
                className="flex items-center gap-1.5 text-sm font-bold text-navy-950 bg-gold-400 px-4 py-2.5 rounded-xl hover:bg-gold-300"
              >
                Next <ChevronRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                onClick={() => setConfirmSubmit(true)}
                className="flex items-center gap-1.5 text-sm font-bold text-white bg-emerald-600 px-4 py-2.5 rounded-xl hover:bg-emerald-500"
              >
                <Flag className="w-4 h-4" /> Finish
              </button>
            )}
          </div>
        </div>

        {/* palette */}
        <div className="bg-white/5 border border-white/10 rounded-2xl p-4 h-fit lg:sticky lg:top-24">
          <div className="text-xs font-bold text-gold-300 uppercase tracking-wider mb-3">Answer Map</div>
          <div className="grid grid-cols-8 lg:grid-cols-5 gap-1.5">
            {questions.map((qq, i) => (
              <button
                key={qq.id}
                onClick={() => setCurrentIdx(i)}
                className={`aspect-square rounded-lg text-xs font-extrabold transition ${
                  i === currentIdx
                    ? 'bg-gold-400 text-navy-950 ring-2 ring-white'
                    : answers[qq.id]
                    ? 'bg-emerald-500 text-white'
                    : 'bg-white/10 text-white/60 hover:bg-white/20'
                }`}
              >
                {i + 1}
              </button>
            ))}
          </div>
          <div className="mt-3 space-y-1.5 text-[11px] text-white/60 font-semibold">
            <div className="flex items-center gap-2"><span className="w-3 h-3 rounded bg-emerald-500"></span> Answered ({answeredCount})</div>
            <div className="flex items-center gap-2"><span className="w-3 h-3 rounded bg-white/20"></span> Unanswered ({questions.length - answeredCount})</div>
          </div>
        </div>
      </div>

      {/* camera PiP */}
      <div className="fixed bottom-4 right-4 z-40 w-40 sm:w-52">
        <div className={`relative rounded-xl overflow-hidden border-2 bg-navy-950 shadow-2xl aspect-video ${proctorStatus === 'ok' ? 'border-gold-400' : 'border-red-500'}`}>
          {stream ? (
            <video ref={videoRef} muted playsInline className="w-full h-full object-cover" style={{ transform: 'scaleX(-1)' }} />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center text-white/50 text-xs gap-1">
              <Camera className="w-5 h-5" /> No camera
            </div>
          )}
          <span className="absolute top-1.5 left-1.5 badge bg-red-600 text-white proctor-pulse !text-[10px]">● REC</span>
          <span className={`absolute bottom-1.5 left-1.5 badge !text-[10px] ${proctorStatus === 'ok' ? 'bg-emerald-600 text-white' : proctorStatus === 'face-missing' ? 'bg-red-600 text-white' : 'bg-amber-500 text-navy-950'}`}>
            {proctorStatus === 'ok' ? '◉ AI watching' : proctorStatus === 'face-missing' ? '◉ No face!' : proctorStatus === 'looking-away' ? '◉ Eyes away!' : '◉ Unstable!'}
          </span>
        </div>
        <div className="mt-1.5 bg-navy-950/90 border border-white/15 rounded-lg px-2.5 py-1.5 flex items-center gap-2">
          <Mic className="w-3.5 h-3.5 text-gold-400 shrink-0" />
          <div className="flex-1 h-1.5 bg-white/15 rounded-full overflow-hidden">
            <div className="h-full bg-gradient-to-r from-emerald-500 via-gold-400 to-red-500" style={{ width: `${micLevel}%` }}></div>
          </div>
        </div>
      </div>

      {/* fullscreen lost overlay */}
      {fsLost && (
        <div className="fixed inset-0 z-[80] bg-navy-950/95 flex items-center justify-center p-6">
          <div className="bg-white rounded-2xl p-8 max-w-md text-center">
            <Maximize className="w-12 h-12 mx-auto text-red-500" />
            <h3 className="font-extrabold text-navy-900 text-xl mt-4">Fullscreen Exited!</h3>
            <p className="text-sm text-gray-500 mt-2">
              The timer is still running and a warning has been recorded. Return to fullscreen immediately to continue.
            </p>
            <button onClick={reenterFullscreen} className="mt-5 gold-btn font-bold text-sm px-6 py-3 rounded-xl w-full">
              Return to Fullscreen
            </button>
          </div>
        </div>
      )}

      {/* submitting overlay */}
      {submitting && (
        <div className="fixed inset-0 z-[85] bg-navy-950/90 flex items-center justify-center">
          <div className="text-center">
            <Loader2 className="w-12 h-12 mx-auto text-gold-400 animate-spin" />
            <p className="text-white font-bold mt-4">Submitting your answers…</p>
            <p className="text-white/50 text-sm">Grading securely on the server</p>
          </div>
        </div>
      )}

      <Modal open={confirmSubmit} onClose={() => setConfirmSubmit(false)} title="Submit Quiz?">
        <p className="text-sm text-gray-600">
          You answered <strong>{answeredCount}</strong> of <strong>{questions.length}</strong> questions.
          {questions.length - answeredCount > 0 && (
            <span className="text-amber-700 font-semibold"> {questions.length - answeredCount} unanswered will be marked wrong.</span>
          )}
        </p>
        <p className="text-sm text-gray-600 mt-2">Warnings recorded: <strong>{warnings}</strong>. This cannot be undone.</p>
        <div className="mt-5 flex gap-3">
          <button onClick={() => setConfirmSubmit(false)} className="flex-1 border border-navy-100 font-bold text-sm py-3 rounded-xl text-navy-900 hover:border-gold-400">
            Keep Answering
          </button>
          <button onClick={() => submitExam(false)} className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm py-3 rounded-xl">
            Submit Now
          </button>
        </div>
      </Modal>
    </div>
  );
}
