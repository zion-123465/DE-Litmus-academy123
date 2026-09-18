import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, BookOpen, ClipboardList, Ticket, Receipt, BarChart3,
  Users, Settings, LogOut, Lock, ListChecks, Video, MessagesSquare, BellRing,
} from 'lucide-react';
import { useAdmin } from '../../contexts/AdminContext';
import Spinner from '../../components/Spinner';

const LOGO_URL = 'https://www.designarena.ai/u/0af0c461-858d-45e6-8a72-5a9585d1cec0';

export default function AdminLayout() {
  const { isAdmin, loading, logout } = useAdmin();
  const navigate = useNavigate();
  const [drawer, setDrawer] = useState(false);

  useEffect(() => {
    if (!loading && !isAdmin) navigate('/admin-portal-x7k9/login');
  }, [loading, isAdmin, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen bg-navy-950 flex items-center justify-center">
        <Spinner label="Verifying admin access…" dark />
      </div>
    );
  }
  if (!isAdmin) return null;

  const links = [
    { to: '/admin-portal-x7k9', end: true, label: 'Dashboard', icon: LayoutDashboard },
    { to: '/admin-portal-x7k9/materials', label: 'Materials', icon: BookOpen },
    { to: '/admin-portal-x7k9/quizzes', label: 'Quizzes', icon: ClipboardList },
    { to: '/admin-portal-x7k9/questions', label: 'Questions', icon: ListChecks },
    { to: '/admin-portal-x7k9/codes', label: 'Quiz Codes', icon: Ticket },
    { to: '/admin-portal-x7k9/payments', label: 'Payments', icon: Receipt },
    { to: '/admin-portal-x7k9/scores', label: 'Scores & Attempts', icon: BarChart3 },
    { to: '/admin-portal-x7k9/live', label: 'Live Monitor', icon: Video },
    { to: '/admin-portal-x7k9/students', label: 'Students', icon: Users },
    { to: '/admin-portal-x7k9/chats', label: 'Chats', icon: MessagesSquare },
    { to: '/admin-portal-x7k9/notifications', label: 'Notifications', icon: BellRing },
    { to: '/admin-portal-x7k9/settings', label: 'Settings', icon: Settings },
  ];

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const sidebar = (
    <>
      <div className="px-5 py-5 border-b border-gold-400/20 flex items-center gap-3">
        <img src={LOGO_URL} alt="crest" className="w-10 h-10 rounded-full object-cover ring-2 ring-gold-400" />
        <div>
          <div className="font-display font-bold text-gold-300 text-sm">ADMIN CONTROL</div>
          <div className="text-[10px] text-white/50 uppercase tracking-widest flex items-center gap-1">
            <Lock className="w-3 h-3" /> Restricted Area
          </div>
        </div>
      </div>
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {links.map((l) => (
          <NavLink
            key={l.to}
            to={l.to}
            end={(l as any).end}
            onClick={() => setDrawer(false)}
            className={({ isActive }) =>
              `flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-semibold transition ${
                isActive ? 'bg-gold-400 text-navy-950' : 'text-white/70 hover:bg-white/5 hover:text-gold-300'
              }`
            }
          >
            <l.icon className="w-4 h-4" /> {l.label}
          </NavLink>
        ))}
      </nav>
      <div className="px-3 pb-4 space-y-1">
        <Link to="/" className="flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-semibold text-white/50 hover:text-gold-300">
          ← View Public Site
        </Link>
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-semibold text-white/70 hover:bg-red-500/20 hover:text-red-300"
        >
          <LogOut className="w-4 h-4" /> Lock Admin Area
        </button>
      </div>
    </>
  );

  return (
    <div className="min-h-screen bg-[#efece0] flex">
      <aside className="hidden lg:flex w-60 shrink-0 bg-navy-950 text-white flex-col min-h-screen sticky top-0 h-screen">{sidebar}</aside>
      {drawer && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-navy-950/70" onClick={() => setDrawer(false)}></div>
          <aside className="absolute left-0 top-0 bottom-0 w-64 bg-navy-950 text-white flex flex-col">{sidebar}</aside>
        </div>
      )}
      <div className="flex-1 min-w-0">
        <div className="lg:hidden bg-navy-950 text-white px-4 py-3 flex items-center justify-between sticky top-16 z-40">
          <button onClick={() => setDrawer(true)} className="text-sm font-bold bg-gold-400 text-navy-950 px-4 py-2 rounded-lg">
            ☰ Admin Menu
          </button>
          <span className="text-xs text-gold-300 font-bold flex items-center gap-1"><Lock className="w-3 h-3" /> ADMIN</span>
        </div>
        <div className="p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
