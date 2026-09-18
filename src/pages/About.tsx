import { motion } from 'framer-motion';
import { Target, Eye, Award, Users, BookOpen, ShieldCheck } from 'lucide-react';
import { useSiteImages } from '../hooks/useSiteImages';

const LOGO_URL = 'https://www.designarena.ai/u/0af0c461-858d-45e6-8a72-5a9585d1cec0';

export default function About() {
  const siteImages = useSiteImages();
  return (
    <div className="bg-white">
      <section className="bg-navy-950 hero-pattern py-16 md:py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 text-center">
          <motion.img
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            src={LOGO_URL}
            alt="De-Litmus Academy crest"
            className="w-28 h-28 md:w-36 md:h-36 rounded-full object-cover mx-auto shield-ring mb-6"
          />
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="font-display font-extrabold text-3xl md:text-5xl text-white"
          >
            About <span className="gold-text">De-Litmus Academy</span>
          </motion.h1>
          <p className="mt-4 text-white/65 max-w-2xl mx-auto">"We Keep Moving" — our motto and our method.</p>
        </div>
      </section>

      <section className="max-w-7xl mx-auto px-4 sm:px-6 py-14 md:py-18 grid md:grid-cols-3 gap-6">
        {[
          { icon: Target, t: 'Our Mission', d: 'To make quality study materials and fair CBT practice accessible to every Nigerian learner — university students (100–300 level), WAEC and JAMB candidates alike.' },
          { icon: Eye, t: 'Our Vision', d: 'A generation of confident learners who earn every grade honestly, backed by technology that rewards discipline and hard work.' },
          { icon: Award, t: 'Our Standard', d: 'Proctored exams, verified payments, and carefully curated materials. If it carries the De-Litmus crest, it meets the standard.' },
        ].map((c, i) => (
          <motion.div
            key={c.t}
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: i * 0.1 }}
            className="bg-navy-50 border border-navy-100 rounded-2xl p-7"
          >
            <div className="w-12 h-12 rounded-xl bg-navy-900 text-gold-300 flex items-center justify-center mb-4">
              <c.icon className="w-6 h-6" />
            </div>
            <h3 className="font-display font-bold text-xl text-navy-900 mb-2">{c.t}</h3>
            <p className="text-sm text-gray-600 leading-relaxed">{c.d}</p>
          </motion.div>
        ))}
      </section>

      <section className="max-w-7xl mx-auto px-4 sm:px-6 pb-16 grid md:grid-cols-2 gap-10 items-center">
        <div>
          <img src={siteImages.about_library} alt="Academy library" className="rounded-2xl card-shadow object-cover h-80 w-full" />
        </div>
        <div>
          <h2 className="font-display font-extrabold text-2xl md:text-3xl text-navy-900">Why Students Choose De-Litmus</h2>
          <ul className="mt-6 space-y-5">
            {[
              { icon: BookOpen, t: 'Category-organised library', d: 'Find exactly what you need by category (100/200/300, WAEC, JAMB) and department in seconds.' },
              { icon: ShieldCheck, t: 'Payments you can trust', d: 'Bank-transfer payments with automatic verification and full receipts in your portal.' },
              { icon: Users, t: 'Fair exams for all', d: 'Camera + noise proctoring means your honest score is never undermined by cheaters.' },
            ].map((f) => (
              <li key={f.t} className="flex gap-4">
                <div className="w-11 h-11 shrink-0 rounded-xl bg-gold-100 text-gold-700 flex items-center justify-center">
                  <f.icon className="w-5 h-5" />
                </div>
                <div>
                  <div className="font-bold text-navy-900">{f.t}</div>
                  <div className="text-sm text-gray-600">{f.d}</div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </div>
  );
}
