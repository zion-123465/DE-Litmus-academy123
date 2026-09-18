import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { BookOpen, ClipboardList, ShieldCheck, Camera, Volume2, Zap, GraduationCap, ArrowRight, BadgeCheck, Banknote, BellRing } from 'lucide-react';
import { apiFetch, formatNGN } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import { useLogoTapSecret } from '../hooks/useLogoTapSecret';
import { useSiteImages } from '../hooks/useSiteImages';

const LOGO_URL = 'https://www.designarena.ai/u/0af0c461-858d-45e6-8a72-5a9585d1cec0';

export default function Home() {
  const [stats, setStats] = useState({ materials: 0, quizzes: 0, students: 0 });
  const [codePrice, setCodePrice] = useState(1500);
  const onLogoTap = useLogoTapSecret();
  const { user } = useAuth();
  const siteImages = useSiteImages();

  useEffect(() => {
    (async () => {
      try {
        const [mats, qz, settings] = await Promise.all([
          apiFetch<any[]>('/api/materials?limit=1'),
          apiFetch<any[]>('/api/quizzes?published_only=1'),
          apiFetch<any[]>('/api/settings'),
        ]);
        setStats({ materials: mats.length ? 25 : 0, quizzes: qz.length, students: 1200 });
        const row = settings.find((s) => s.key === 'quiz_code_price');
        if (row) {
          try {
            setCodePrice(JSON.parse(row.value).amount || 1500);
          } catch {}
        }
      } catch {}
    })();
  }, []);

  const fadeUp = {
    initial: { opacity: 0, y: 24 },
    whileInView: { opacity: 1, y: 0 },
    viewport: { once: true, margin: '-60px' },
    transition: { duration: 0.55 },
  };

  return (
    <div className="bg-white">
      {/* HERO */}
      <section className="relative overflow-hidden bg-navy-950 hero-pattern">
        <div className="absolute inset-0 opacity-25">
          <img src={siteImages.hero_bg} alt="" className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-b from-navy-950/70 via-navy-950/80 to-navy-950"></div>
        </div>
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 py-16 md:py-24 grid md:grid-cols-2 gap-12 items-center">
          <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
            <div className="inline-flex items-center gap-2 bg-gold-400/15 border border-gold-400/40 rounded-full px-4 py-1.5 text-xs font-bold text-gold-300 mb-6">
              <Zap className="w-3.5 h-3.5" /> UNIVERSITY · WAEC · JAMB — CBT & STUDY MATERIALS
            </div>
            <h1 className="font-display font-extrabold text-4xl sm:text-5xl lg:text-6xl leading-tight text-white">
              Learn Boldly.
              <br />
              <span className="gold-text">We Keep Moving.</span>
            </h1>
            <p className="mt-5 text-white/70 text-base md:text-lg leading-relaxed max-w-xl">
              De-Litmus Academy gives you premium study materials, proctored CBT quizzes with live camera
              monitoring, and instant quiz codes — all in one secure student portal.
            </p>
            <div className="mt-8 flex flex-wrap gap-4">
              {user ? (
                <Link to="/portal/start-quiz" className="gold-btn font-bold px-7 py-3.5 rounded-xl text-sm flex items-center gap-2">
                  <ClipboardList className="w-5 h-5" /> CBT Quiz
                </Link>
              ) : (
                <Link to="/register" className="gold-btn font-bold px-7 py-3.5 rounded-xl text-sm flex items-center gap-2">
                  <GraduationCap className="w-5 h-5" /> Join Free
                </Link>
              )}
              <Link
                to="/materials"
                className="px-7 py-3.5 rounded-xl text-sm font-bold text-white border border-white/30 hover:border-gold-400 hover:text-gold-300 transition flex items-center gap-2"
              >
                <BookOpen className="w-5 h-5" /> Browse Materials
              </Link>
            </div>
            <div className="mt-10 grid grid-cols-3 gap-4 max-w-md">
              {[
                { n: `${stats.materials}+`, l: 'Study materials' },
                { n: `${stats.quizzes || '10'}+`, l: 'CBT quizzes' },
                { n: '20', l: 'Warning proctor limit' },
              ].map((s) => (
                <div key={s.l} className="bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-center">
                  <div className="font-display font-extrabold text-2xl text-gold-300">{s.n}</div>
                  <div className="text-[11px] text-white/60 font-semibold mt-1">{s.l}</div>
                </div>
              ))}
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.92 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.7, delay: 0.15 }}
            className="hidden md:flex justify-center"
          >
            <div className="relative">
              <div className="absolute -inset-8 bg-gold-400/10 blur-3xl rounded-full"></div>
              <img
                src={LOGO_URL}
                alt="De-Litmus Academy crest"
                onClick={onLogoTap}
                className="relative w-72 h-72 lg:w-96 lg:h-96 rounded-full object-cover shield-ring cursor-pointer select-none"
              />
              <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 bg-navy-900 border border-gold-400/50 rounded-full px-6 py-2 text-xs font-bold text-gold-300 whitespace-nowrap shadow-xl">
                ★ EST. OF EXCELLENCE ★
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 py-16 md:py-20">
        <motion.div {...fadeUp} className="text-center mb-12">
          <div className="text-xs font-bold tracking-[0.3em] text-gold-600 uppercase mb-3">How it works</div>
          <h2 className="font-display font-extrabold text-3xl md:text-4xl text-navy-900">From Registration to Result in 4 Steps</h2>
        </motion.div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {[
            { icon: GraduationCap, t: '1. Register Free', d: 'Create your student account with email or Google in under a minute.' },
            { icon: Banknote, t: '2. Buy a Quiz Code', d: `Pay ${formatNGN(codePrice)} via bank transfer. Matching payments verify automatically.` },
            { icon: Camera, t: '3. Take Proctored Quiz', d: 'Camera + microphone monitoring keeps every exam fair. 20 warnings allowed.' },
            { icon: BadgeCheck, t: '4. See Your Score', d: 'Instant marking, downloadable materials and a full result history.' },
          ].map((s, i) => (
            <motion.div
              key={s.t}
              {...fadeUp}
              transition={{ duration: 0.5, delay: i * 0.08 }}
              className="bg-navy-50 border border-navy-100 rounded-2xl p-6 hover:border-gold-400 hover:shadow-xl transition group"
            >
              <div className="w-12 h-12 rounded-xl bg-navy-900 text-gold-300 flex items-center justify-center mb-4 group-hover:scale-110 transition">
                <s.icon className="w-6 h-6" />
              </div>
              <h3 className="font-bold text-navy-900 mb-2">{s.t}</h3>
              <p className="text-sm text-gray-600 leading-relaxed">{s.d}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* PROCTORING SPOTLIGHT */}
      <section className="bg-navy-950 hero-pattern py-16 md:py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 grid md:grid-cols-2 gap-12 items-center">
          <motion.div {...fadeUp}>
            <img src={siteImages.cbt_spotlight} alt="Student taking a proctored CBT quiz" className="rounded-2xl shield-ring object-cover h-72 md:h-96 w-full" />
          </motion.div>
          <motion.div {...fadeUp}>
            <div className="text-xs font-bold tracking-[0.3em] text-gold-400 uppercase mb-3">Fair-play proctoring</div>
            <h2 className="font-display font-extrabold text-3xl md:text-4xl text-white leading-tight">
              A Quiz Hall That <span className="gold-text">Watches Fairly</span>
            </h2>
            <p className="mt-4 text-white/70 leading-relaxed">
              Every exam runs in a secure full-screen hall with live camera and noise monitoring — so honest
              students always get the credit they deserve.
            </p>
            <ul className="mt-6 space-y-4">
              {[
                { icon: Camera, t: 'Live camera watch', d: 'Face-visibility checks; leaving the camera frame raises a warning.' },
                { icon: Volume2, t: 'Noise detection + audible alerts', d: 'Loud background noise triggers a spoken warning you can hear.' },
                { icon: BellRing, t: '20-warning auto-submit', d: 'Warnings for tab switches, noise and camera issues. At 20, the quiz auto-submits.' },
                { icon: ShieldCheck, t: 'Server-side marking', d: 'Answers are graded securely on the server. No peeking at answer keys.' },
              ].map((f) => (
                <li key={f.t} className="flex gap-4">
                  <div className="w-10 h-10 shrink-0 rounded-lg bg-gold-400/15 border border-gold-400/40 text-gold-300 flex items-center justify-center">
                    <f.icon className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="font-bold text-white text-sm">{f.t}</div>
                    <div className="text-sm text-white/60">{f.d}</div>
                  </div>
                </li>
              ))}
            </ul>
            <Link to="/quizzes" className="mt-8 inline-flex items-center gap-2 gold-btn font-bold px-6 py-3 rounded-xl text-sm">
              Explore the Quiz Centre <ArrowRight className="w-4 h-4" />
            </Link>
          </motion.div>
        </div>
      </section>

      {/* MATERIALS CTA */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 py-16 md:py-20">
        <div className="grid md:grid-cols-2 gap-8 items-stretch">
          <motion.div {...fadeUp} className="relative overflow-hidden rounded-2xl bg-navy-900 p-8 md:p-10 card-shadow">
            <img src={siteImages.library_card} alt="" className="absolute inset-0 w-full h-full object-cover opacity-25" />
            <div className="relative">
              <BookOpen className="w-10 h-10 text-gold-400 mb-4" />
              <h3 className="font-display font-extrabold text-2xl md:text-3xl text-white">The Academy Library</h3>
              <p className="mt-3 text-white/70 text-sm leading-relaxed">
                PDFs and image notes organised by category — University (100, 200, 300), WAEC and JAMB — plus department. Search, preview and
                download instantly after purchase.
              </p>
              <Link to="/materials" className="mt-6 inline-flex items-center gap-2 text-sm font-bold text-navy-950 bg-gold-400 hover:bg-gold-300 px-5 py-2.5 rounded-lg transition">
                Search materials <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </motion.div>
          <motion.div {...fadeUp} className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-gold-600 via-gold-500 to-gold-700 p-8 md:p-10 card-shadow">
            <div className="relative">
              <ClipboardList className="w-10 h-10 text-navy-950 mb-4" />
              <h3 className="font-display font-extrabold text-2xl md:text-3xl text-navy-950">Quiz Codes from {formatNGN(codePrice)}</h3>
              <p className="mt-3 text-navy-950/80 text-sm leading-relaxed font-medium">
                Pay by bank transfer, get verified automatically, and receive your code instantly in your
                student portal. No waiting, no stories.
              </p>
              <Link to="/portal/buy-code" className="mt-6 inline-flex items-center gap-2 text-sm font-bold text-gold-300 bg-navy-950 hover:bg-navy-800 px-5 py-2.5 rounded-lg transition">
                Buy a quiz code <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </motion.div>
        </div>
      </section>

      {/* CTA BANNER */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 pb-8">
        <motion.div {...fadeUp} className="text-center mb-8">
          <div className="text-xs font-bold tracking-[0.3em] text-gold-600 uppercase mb-3">Who we serve</div>
          <h2 className="font-display font-extrabold text-3xl md:text-4xl text-navy-900">One Academy, Three Paths to Success</h2>
        </motion.div>
        <div className="grid sm:grid-cols-3 gap-5">
          {[
            { icon: GraduationCap, t: 'University', d: '100, 200 & 300 level notes and CBT practice across departments.' },
            { icon: BookOpen, t: 'WAEC', d: 'Objective + theory prep packs and timed practice exams.' },
            { icon: ClipboardList, t: 'JAMB / UTME', d: 'Score-boosting drills, solved past questions and CBT halls.' },
          ].map((s, i) => (
            <motion.div
              key={s.t}
              {...fadeUp}
              transition={{ duration: 0.5, delay: i * 0.08 }}
              className="bg-navy-950 hero-pattern rounded-2xl p-6 text-center card-shadow"
            >
              <div className="w-12 h-12 rounded-xl bg-gold-400 text-navy-950 flex items-center justify-center mx-auto mb-4">
                <s.icon className="w-6 h-6" />
              </div>
              <h3 className="font-display font-bold text-xl text-gold-300">{s.t}</h3>
              <p className="text-sm text-white/65 leading-relaxed mt-2">{s.d}</p>
            </motion.div>
          ))}
        </div>
      </section>

      <section className="max-w-7xl mx-auto px-4 sm:px-6 pb-16 md:pb-20">
        <motion.div {...fadeUp} className="rounded-3xl bg-navy-50 border border-navy-100 px-8 py-12 text-center">
          <img src={LOGO_URL} alt="De-Litmus Academy" onClick={onLogoTap} className="w-20 h-20 rounded-full object-cover mx-auto ring-2 ring-gold-400 mb-5 cursor-pointer select-none" />
          <h2 className="font-display font-extrabold text-2xl md:text-3xl text-navy-900">Ready to Keep Moving?</h2>
          <p className="text-gray-600 mt-2 max-w-lg mx-auto text-sm">
            Join hundreds of students preparing smarter with De-Litmus Academy materials and CBT practice.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            {user ? (
              <Link to="/portal/start-quiz" className="gold-btn font-bold px-7 py-3 rounded-xl text-sm">CBT Quiz</Link>
            ) : (
              <Link to="/register" className="gold-btn font-bold px-7 py-3 rounded-xl text-sm">Join Free</Link>
            )}
            <Link to="/about" className="px-7 py-3 rounded-xl text-sm font-bold text-navy-900 border border-navy-100 bg-white hover:border-gold-400 transition">
              Learn More
            </Link>
          </div>
        </motion.div>
      </section>
    </div>
  );
}
