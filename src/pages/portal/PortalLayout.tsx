import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { LayoutDashboard, Ticket, Receipt, BarChart3, User, LogOut, ShoppingCart, PlayCircle, Headset, Users, Sparkles } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { formatCategory } from '../../lib/api';

export default function PortalLayout() {
  const { user, student, signOut, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Full-screen immersive routes: hide portal sidebar chrome so the
  // experience fills the whole phone screen like WhatsApp.
  const immersive = /^\/portal\/(messages|ai-tutor)/.test(location.pathname);

  useEffect(() => {
    if (!loading && !user) navigate('/login');
  }, [loading, user, navigate]);

  const links = [
    { to: '/portal', end: true, label: 'Dashboard', icon: LayoutDashboard },
    { to: '/portal/codes', label: 'My Quiz Codes', icon: Ticket },
    { to: '/portal/buy-code', label: 'Buy Quiz Code', icon: ShoppingCart },
    { to: '/portal/start-quiz', label: 'Take a Quiz', icon: PlayCircle },
    { to: '/portal/payments', label: 'My Payments', icon: Receipt },
    { to: '/portal/scores', label: 'My Scores', icon: BarChart3 },
    { to: '/portal/messages', label: 'Chat with Admin', icon: Headset },
    { to: '/portal/ai-tutor', label: 'AI Tutor', icon: Sparkles },
    { to: '/portal/profile', label: 'Profile', icon: User },
  ];

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  return (
    <div className="bg-navy-50/60 flex min-h-0 flex-1">
      {/* Sidebar (desktop) — hidden on immersive chat routes */}
      {!immersive && (
      <aside className="hidden lg:flex w-64 shrink-0 bg-navy-950 text-white flex-col">
        <div className="px-6 py-6 border-b border-white/10">
          <div className="flex items-center gap-3">
            {student?.avatar_url ? (
              <img src={student.avatar_url} alt="Profile" className="w-11 h-11 rounded-full object-cover ring-2 ring-gold-400" />
            ) : (
              <div className="w-11 h-11 rounded-full bg-gold-400 text-navy-950 font-extrabold flex items-center justify-center text-lg">
                {(student?.full_name || user?.email || 'S').charAt(0).toUpperCase()}
              </div>
            )}
            <div className="min-w-0">
              <div className="font-bold text-sm truncate">{student?.full_name || 'Student'}</div>
              <div className="text-xs text-gold-300 truncate">{student?.level ? formatCategory(student.level) : 'De-Litmus Student'}</div>
            </div>
          </div>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {links.map((l) => (
            <NavLink
              key={l.to}
              to={l.to}
              end={(l as any).end}
              className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition ${
                  isActive ? 'bg-gold-400 text-navy-950' : 'text-white/70 hover:bg-white/5 hover:text-gold-300'
                }`
              }
            >
              <l.icon className="w-4.5 h-4.5" /> {l.label}
            </NavLink>
          ))}
        </nav>
        <div className="px-3 pb-5">
          <button
            onClick={handleSignOut}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold text-white/70 hover:bg-red-500/20 hover:text-red-300 transition"
          >
            <LogOut className="w-4.5 h-4.5" /> Sign out
          </button>
        </div>
      </aside>
      )}

      {/* Mobile sidebar drawer */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-navy-950/70" onClick={() => setSidebarOpen(false)}></div>
          <aside className="absolute left-0 top-0 bottom-0 w-64 bg-navy-950 text-white flex flex-col">
            <div className="px-6 py-6 border-b border-white/10">
              <div className="font-bold text-sm">{student?.full_name || 'Student'}</div>
              <div className="text-xs text-gold-300">De-Litmus Student</div>
            </div>
            <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
              {links.map((l) => (
                <NavLink
                  key={l.to}
                  to={l.to}
                  end={(l as any).end}
                  onClick={() => setSidebarOpen(false)}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold ${
                      isActive ? 'bg-gold-400 text-navy-950' : 'text-white/70'
                    }`
                  }
                >
                  <l.icon className="w-4.5 h-4.5" /> {l.label}
                </NavLink>
              ))}
              <button
                onClick={handleSignOut}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold text-white/70"
              >
                <LogOut className="w-4.5 h-4.5" /> Sign out
              </button>
            </nav>
          </aside>
        </div>
      )}

      {/* Main */}
      <div className="flex-1 min-w-0 flex flex-col">
        {!immersive && (
          <div className="lg:hidden bg-navy-950 text-white px-4 py-3 flex items-center justify-between sticky top-16 z-40">
            <button onClick={() => setSidebarOpen(true)} className="text-sm font-bold bg-white/10 px-4 py-2 rounded-lg">
              ☰ Portal Menu
            </button>
            <Link to="/" className="text-xs text-gold-300 font-bold">← Back to site</Link>
          </div>
        )}
        {immersive ? (
          <div className="flex-1 flex flex-col min-h-0">
            <Outlet />
          </div>
        ) : (
          <div className="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto w-full">
            <Outlet />
          </div>
        )}
      </div>
    </div>
  );
}
