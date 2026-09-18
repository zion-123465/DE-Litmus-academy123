import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { GraduationCap, BookOpen, ClipboardList, Menu, X, LogOut, LayoutDashboard, LogIn, Users } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useLogoTapSecret } from '../hooks/useLogoTapSecret';
import NotificationBell from './NotificationBell';

const LOGO_URL = 'https://www.designarena.ai/u/0af0c461-858d-45e6-8a72-5a9585d1cec0';

export default function Navbar() {
  const { user, student, signOut } = useAuth();
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const onLogoTap = useLogoTapSecret();

  const links = [
    { to: '/', label: 'Home' },
    { to: '/about', label: 'About' },
    { to: '/materials', label: 'Materials', icon: BookOpen },
    { to: '/quizzes', label: 'Quizzes', icon: ClipboardList },
    { to: '/group-chat', label: 'Group Chat', icon: Users },
  ];

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
    setOpen(false);
  };

  return (
    <header className="sticky top-0 z-50 bg-navy-950/95 backdrop-blur border-b border-gold-400/25">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between h-16 md:h-[72px]">
          <Link to="/" className="flex items-center gap-3 group">
            <img
              src={LOGO_URL}
              alt="De-Litmus Academy logo"
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); onLogoTap(); }}
              title="De-Litmus Academy"
              className="w-11 h-11 md:w-12 md:h-12 rounded-full object-cover ring-2 ring-gold-400 group-hover:ring-gold-300 transition cursor-pointer select-none"
            />
            <div className="leading-tight">
              <div className="font-display font-bold text-gold-300 text-base md:text-lg tracking-wide">DE-LITMUS ACADEMY</div>
              <div className="text-[10px] md:text-[11px] uppercase tracking-[0.28em] text-white/60">We Keep Moving</div>
            </div>
          </Link>

          <nav className="hidden md:flex items-center gap-1">
            {links.map((l) => (
              <NavLink
                key={l.to}
                to={l.to}
                className={({ isActive }) =>
                  `px-4 py-2 rounded-lg text-sm font-semibold transition ${
                    isActive ? 'text-navy-950 bg-gold-400' : 'text-white/80 hover:text-gold-300 hover:bg-white/5'
                  }`
                }
              >
                {l.label}
              </NavLink>
            ))}
          </nav>

          <div className="hidden md:flex items-center gap-3">
            {user ? (
              <>
                <NotificationBell />
                <Link
                  to="/portal/start-quiz"
                  className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold text-navy-950 gold-btn"
                >
                  <ClipboardList className="w-4 h-4" /> CBT Quiz
                </Link>
                <Link
                  to="/portal"
                  className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white/80 hover:text-white border border-white/20 hover:border-gold-400/60 transition"
                >
                  <LayoutDashboard className="w-4 h-4" /> Portal
                </Link>
                <button
                  onClick={handleSignOut}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white/80 hover:text-white border border-white/20 hover:border-gold-400/60 transition"
                >
                  <LogOut className="w-4 h-4" /> Sign out
                </button>
                {student?.avatar_url ? (
                  <img src={student.avatar_url} alt="Profile" className="w-9 h-9 rounded-full object-cover ring-2 ring-gold-400" />
                ) : (
                  <div className="w-9 h-9 rounded-full bg-gold-400/20 border border-gold-400/60 flex items-center justify-center text-gold-300 font-bold text-sm">
                    {(student?.full_name || user.email || 'S').charAt(0).toUpperCase()}
                  </div>
                )}
              </>
            ) : (
              <>
                <Link
                  to="/login"
                  className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white/85 hover:text-gold-300 border border-white/20 hover:border-gold-400/60 transition"
                >
                  <LogIn className="w-4 h-4" /> Login
                </Link>
                <Link to="/register" className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold text-navy-950 gold-btn">
                  <GraduationCap className="w-4 h-4" /> Join Free
                </Link>
              </>
            )}
          </div>

          <div className="flex md:hidden items-center gap-1">
            {user && <NotificationBell />}
            <button className="text-white p-2" onClick={() => setOpen(!open)} aria-label="Menu">
              {open ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>
      </div>

      {open && (
        <div className="md:hidden bg-navy-950 border-t border-gold-400/20 px-4 py-4 space-y-2">
          {links.map((l) => (
            <NavLink
              key={l.to}
              to={l.to}
              onClick={() => setOpen(false)}
              className={({ isActive }) =>
                `block px-4 py-3 rounded-lg text-sm font-semibold ${isActive ? 'bg-gold-400 text-navy-950' : 'text-white/85 bg-white/5'}`
              }
            >
              {l.label}
            </NavLink>
          ))}
          {user ? (
            <>
              <Link to="/portal/start-quiz" onClick={() => setOpen(false)} className="flex items-center gap-2 px-4 py-3 rounded-lg text-sm font-bold text-navy-950 gold-btn">
                <ClipboardList className="w-4 h-4" /> CBT Quiz
              </Link>
              <Link to="/portal" onClick={() => setOpen(false)} className="flex items-center gap-2 px-4 py-3 rounded-lg text-sm font-semibold text-white border border-white/20">
                <LayoutDashboard className="w-4 h-4" /> Student Portal
              </Link>
              <button onClick={handleSignOut} className="w-full flex items-center gap-2 px-4 py-3 rounded-lg text-sm font-semibold text-white border border-white/20">
                <LogOut className="w-4 h-4" /> Sign out ({student?.full_name || user.email})
              </button>
            </>
          ) : (
            <>
              <Link to="/login" onClick={() => setOpen(false)} className="block px-4 py-3 rounded-lg text-sm font-semibold text-white border border-white/20 text-center">
                Login
              </Link>
              <Link to="/register" onClick={() => setOpen(false)} className="block px-4 py-3 rounded-lg text-sm font-bold text-navy-950 gold-btn text-center">
                Join Free
              </Link>
            </>
          )}
        </div>
      )}
    </header>
  );
}
