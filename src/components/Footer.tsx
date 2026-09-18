import { Link } from 'react-router-dom';
import { ShieldCheck, Mail, MapPin, Phone, Users } from 'lucide-react';
import { useLogoTapSecret } from '../hooks/useLogoTapSecret';

const LOGO_URL = 'https://www.designarena.ai/u/0af0c461-858d-45e6-8a72-5a9585d1cec0';
const ADMIN_PHONE_DISPLAY = '0810 685 2839';
const ADMIN_PHONE_LINK = 'tel:+2348106852839';
const ADMIN_WHATSAPP = 'https://wa.me/2348106852839';
const GROUP_LINK = 'https://chat.whatsapp.com/It1JrM2epz0CKjghB9FbaU?s=cl&p=a&mlu=4&ilr=4';
const ADDRESS = 'Beside Noble Hostel, before Chemistry Lab, Presco Campus';

export default function Footer() {
  const onLogoTap = useLogoTapSecret();
  return (
    <footer className="bg-navy-950 text-white border-t border-gold-400/25">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-12 grid gap-10 md:grid-cols-4">
        <div className="md:col-span-2">
          <div className="flex items-center gap-3 mb-4">
            <img src={LOGO_URL} alt="De-Litmus Academy logo" onClick={onLogoTap} className="w-14 h-14 rounded-full object-cover ring-2 ring-gold-400 cursor-pointer select-none" />
            <div>
              <div className="font-display font-bold text-gold-300 text-lg">DE-LITMUS ACADEMY</div>
              <div className="text-xs uppercase tracking-[0.28em] text-white/60">We Keep Moving</div>
            </div>
          </div>
          <p className="text-sm text-white/70 max-w-md leading-relaxed">
            A modern academy platform for study materials, proctored CBT quizzes and secure student payments —
            built for university, WAEC and JAMB learners.
          </p>
          <div className="mt-4 flex items-center gap-2 text-xs text-white/60">
            <ShieldCheck className="w-4 h-4 text-gold-400" /> Secure student data · Verified payments · Fair proctored exams
          </div>
        </div>
        <div>
          <div className="font-bold text-gold-300 mb-4 text-sm uppercase tracking-wider">Quick Links</div>
          <ul className="space-y-2 text-sm text-white/75">
            <li><Link to="/" className="hover:text-gold-300">Home</Link></li>
            <li><Link to="/about" className="hover:text-gold-300">About the Academy</Link></li>
            <li><Link to="/materials" className="hover:text-gold-300">Study Materials</Link></li>
            <li><Link to="/quizzes" className="hover:text-gold-300">Quiz Centre</Link></li>
            <li><Link to="/register" className="hover:text-gold-300">Join Free</Link></li>
            <li><Link to="/portal" className="hover:text-gold-300">Student Portal</Link></li>
          </ul>
        </div>
        <div>
          <div className="font-bold text-gold-300 mb-4 text-sm uppercase tracking-wider">Contact</div>
          <ul className="space-y-3 text-sm text-white/75">
            <li className="flex items-center gap-2"><Mail className="w-4 h-4 text-gold-400 shrink-0" /> info@delitmusacademy.com</li>
            <li>
              <a href={ADMIN_PHONE_LINK} className="flex items-center gap-2 hover:text-gold-300">
                <Phone className="w-4 h-4 text-gold-400 shrink-0" /> {ADMIN_PHONE_DISPLAY}
              </a>
            </li>
            <li className="flex items-start gap-2"><MapPin className="w-4 h-4 text-gold-400 shrink-0 mt-0.5" /> <span>{ADDRESS}</span></li>
            <li>
              <a href={GROUP_LINK} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 bg-emerald-600/20 border border-emerald-500/40 hover:border-emerald-400 text-emerald-300 font-bold text-xs rounded-xl px-3 py-2 transition">
                <Users className="w-4 h-4" /> Join WhatsApp Group
              </a>
            </li>
            <li>
              <a href={ADMIN_WHATSAPP} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 text-gold-300 hover:text-gold-200 font-bold text-xs">
                <Phone className="w-3.5 h-3.5" /> Chat with Admin on WhatsApp
              </a>
            </li>
          </ul>
        </div>
      </div>
      <div className="border-t border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-white/50">
          <span>© {new Date().getFullYear()} De-Litmus Academy. All rights reserved.</span>
          <span>University · WAEC · JAMB Excellence</span>
        </div>
      </div>
    </footer>
  );
}
