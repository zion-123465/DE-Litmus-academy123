import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { AdminProvider } from './contexts/AdminContext';
import { handleGoogleRedirect } from './lib/googleAuth';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import ChatWidget from './components/ChatWidget';
import ProtectedRoute from './components/ProtectedRoute';

import Home from './pages/Home';
import About from './pages/About';
import Materials from './pages/Materials';
import Quizzes from './pages/Quizzes';
import Register from './pages/Register';
import Login from './pages/Login';
import ShareLanding from './pages/ShareLanding';
import GroupChat from './pages/GroupChat';

import PortalLayout from './pages/portal/PortalLayout';
import PortalDashboard from './pages/portal/PortalDashboard';
import MyCodes from './pages/portal/MyCodes';
import MyPayments from './pages/portal/MyPayments';
import MyScores from './pages/portal/MyScores';
import Profile from './pages/portal/Profile';
import PrivateChat from './pages/portal/PrivateChat';
import AiTutor from './pages/portal/AiTutor';
import BuyFlow from './pages/portal/BuyFlow';
import StartQuiz from './pages/portal/StartQuiz';
import TakeQuiz from './pages/portal/TakeQuiz';

import AdminLogin from './pages/admin/AdminLogin';
import AdminLayout from './pages/admin/AdminLayout';
import AdminDashboard from './pages/admin/AdminDashboard';
import AdminMaterials from './pages/admin/AdminMaterials';
import AdminQuizzes from './pages/admin/AdminQuizzes';
import AdminQuestions from './pages/admin/AdminQuestions';
import AdminCodes from './pages/admin/AdminCodes';
import AdminPayments from './pages/admin/AdminPayments';
import AdminScores from './pages/admin/AdminScores';
import AdminLiveMonitor from './pages/admin/AdminLiveMonitor';
import AdminStudents from './pages/admin/AdminStudents';
import AdminChats from './pages/admin/AdminChats';
import AdminNotifications from './pages/admin/AdminNotifications';
import AdminSettings from './pages/admin/AdminSettings';

handleGoogleRedirect();

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

function PublicShell({ children, noFooter = false }: { children: React.ReactNode; noFooter?: boolean }) {
  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-1 flex flex-col min-h-0">{children}</main>
      {!noFooter && <Footer />}
      <ChatWidget />
    </div>
  );
}

function PortalShell() {
  // TakeQuiz renders its own immersive full-screen exam UI (still under navbar/footer shell is hidden there)
  const { pathname } = useLocation();
  const isExam = /\/portal\/take-quiz\//.test(pathname);
  if (isExam) {
    return (
      <div className="min-h-screen bg-navy-950">
        <TakeQuiz />
      </div>
    );
  }
  // Chat routes render full-screen: fill viewport height, no footer.
  const isImmersiveChat = /\/portal\/(messages|ai-tutor)/.test(pathname);
  if (isImmersiveChat) {
    return (
      <div className="h-dvh flex flex-col overflow-hidden">
        <Navbar />
        <main className="flex-1 flex flex-col min-h-0">
          <PortalLayout />
        </main>
      </div>
    );
  }
  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-1">
        <PortalLayout />
      </main>
      <Footer />
      <ChatWidget />
    </div>
  );
}

function NotFound() {
  return (
    <PublicShell>
      <div className="min-h-[60vh] flex flex-col items-center justify-center px-4 text-center">
        <div className="font-display font-extrabold text-7xl text-navy-900">404</div>
        <p className="text-gray-500 mt-2">This page wandered off the academy grounds.</p>
        <a href="/" className="mt-5 gold-btn font-bold text-sm px-6 py-3 rounded-xl">Back to Home</a>
      </div>
    </PublicShell>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AdminProvider>
          <ScrollToTop />
          <Routes>
            {/* Public */}
            <Route path="/" element={<PublicShell><Home /></PublicShell>} />
            <Route path="/about" element={<PublicShell><About /></PublicShell>} />
            <Route path="/materials" element={<PublicShell><Materials /></PublicShell>} />
            <Route path="/quizzes" element={<PublicShell><Quizzes /></PublicShell>} />
            <Route path="/register" element={<Register />} />
            <Route path="/login" element={<Login />} />
            <Route path="/s/:kind/:id" element={<ShareLanding />} />
            <Route path="/share/:kind/:id" element={<ShareLanding />} />
            <Route path="/group-chat" element={<PublicShell noFooter><GroupChat /></PublicShell>} />

            {/* Student portal */}
            <Route path="/portal" element={<ProtectedRoute><PortalShell /></ProtectedRoute>}>
              <Route index element={<PortalDashboard />} />
              <Route path="codes" element={<MyCodes />} />
              <Route path="buy-code" element={<BuyFlow mode="quiz_code" />} />
              <Route path="buy-book/:id" element={<BuyFlow mode="book" />} />
              <Route path="start-quiz" element={<StartQuiz />} />
              <Route path="take-quiz/:quizId" element={<TakeQuiz />} />
              <Route path="payments" element={<MyPayments />} />
              <Route path="scores" element={<MyScores />} />
              <Route path="messages" element={<PrivateChat />} />
              <Route path="ai-tutor" element={<AiTutor />} />
              <Route path="profile" element={<Profile />} />
            </Route>

            {/* Secret admin area */}
            <Route path="/admin-portal-x7k9/login" element={<AdminLogin />} />
            <Route path="/admin-portal-x7k9" element={<AdminLayout />}>
              <Route index element={<AdminDashboard />} />
              <Route path="materials" element={<AdminMaterials />} />
              <Route path="quizzes" element={<AdminQuizzes />} />
              <Route path="questions" element={<AdminQuestions />} />
              <Route path="codes" element={<AdminCodes />} />
              <Route path="payments" element={<AdminPayments />} />
              <Route path="scores" element={<AdminScores />} />
              <Route path="live" element={<AdminLiveMonitor />} />
              <Route path="students" element={<AdminStudents />} />
              <Route path="chats" element={<AdminChats />} />
              <Route path="notifications" element={<AdminNotifications />} />
              <Route path="settings" element={<AdminSettings />} />
            </Route>

            <Route path="/admin" element={<Navigate to="/admin-portal-x7k9/login" replace />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AdminProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
