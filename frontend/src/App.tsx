import React, { Suspense, lazy, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { initAnalytics, trackEvent } from './lib/analytics';
import AriaWidget from './components/AriaWidget';
import { SidebarProvider } from './contexts/SidebarContext';

const Landing = lazy(() => import('./pages/Landing'));
const Auth = lazy(() => import('./pages/auth'));
const AuthCallback = lazy(() => import('./pages/AuthCallback'));
const Onboarding = lazy(() => import('./pages/Onboarding'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const CreatePost = lazy(() => import('./pages/CreatePost'));
const CreateTalk = lazy(() => import('./pages/CreateTalk'));
const CreateResource = lazy(() => import('./pages/CreateResource'));
const History = lazy(() => import('./pages/History'));
const Schedule = lazy(() => import('./pages/Schedule'));
const PersonaSetup = lazy(() => import('./pages/PersonaSetup'));
const Settings = lazy(() => import('./pages/Settings'));
const CreateVisual = lazy(() => import('./pages/CreateVisual'));
const Intelligence = lazy(() => import('./pages/Intelligence'));
const Pricing = lazy(() => import('./pages/Pricing'));
const PrivacyPolicy = lazy(() => import('./pages/PrivacyPolicy'));
const TermsOfService = lazy(() => import('./pages/TermsOfService'));
const RefundPolicy = lazy(() => import('./pages/RefundPolicy'));
const Blog = lazy(() => import('./pages/Blog'));
const BlogPost = lazy(() => import('./pages/BlogPost'));
const Unsubscribe = lazy(() => import('./pages/Unsubscribe'));
const ResetPassword = lazy(() => import('./pages/ResetPassword'));
const NotFound = lazy(() => import('./pages/NotFound'));

function PageLoader() {
  return (
    <div className="min-h-screen gradient-bg-page flex items-center justify-center">
      <div className="text-center">
        <div className="w-10 h-10 rounded-full gradient-primary animate-spin mx-auto mb-4" style={{ borderTop: '3px solid transparent' }} />
        <span className="text-sm font-medium text-brand-muted">Loading...</span>
      </div>
    </div>
  );
}

function PageViewTracker() {
  const location = useLocation();
  useEffect(() => {
    trackEvent('page_view', { page_path: location.pathname });
  }, [location]);
  return null;
}

function App() {
  useEffect(() => {
    initAnalytics();

    // Supabase's password-recovery link redirects to the Site URL root with
    // #access_token=...&type=recovery in the hash (or, if the link already
    // expired/was used, #error=access_denied&error_code=otp_expired — with
    // no `type`, since Supabase omits it on the error path). Nothing on the
    // landing page consumes either, so send both straight to the
    // reset-password screen, which renders the right state for each.
    // Root is only ever the redirect target for recovery links (confirmation
    // links point at /auth/callback instead), so an error hash landing here
    // is unambiguously a recovery-link failure.
    const isRecoveryHash = window.location.hash.includes('type=recovery') || window.location.hash.includes('error=');
    if (isRecoveryHash && window.location.pathname === '/') {
      window.location.replace(`/auth/reset-password${window.location.hash}`);
    }
  }, []);

  return (
    <Router>
      <SidebarProvider>
      <PageViewTracker />
      <AriaWidget />
      <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/signup" element={<Auth />} />
          <Route path="/login" element={<Auth defaultIsLogin />} />
          <Route path="/auth/callback" element={<AuthCallback />} />
          <Route path="/onboarding" element={<Onboarding />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/create" element={<CreatePost />} />
          <Route path="/create/talk" element={<CreateTalk />} />
          <Route path="/create/resource" element={<CreateResource />} />
          <Route path="/guided" element={<Navigate to="/create" replace />} />
          <Route path="/history" element={<History />} />
          <Route path="/schedule" element={<Schedule />} />
          <Route path="/persona-setup" element={<PersonaSetup />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/create-visual" element={<CreateVisual />} />
          <Route path="/intelligence" element={<Intelligence />} />
          <Route path="/pricing" element={<Pricing />} />
          <Route path="/privacy" element={<PrivacyPolicy />} />
          <Route path="/terms" element={<TermsOfService />} />
          <Route path="/refund-policy" element={<RefundPolicy />} />
          <Route path="/blog" element={<Blog />} />
          <Route path="/blog/:slug" element={<BlogPost />} />
          <Route path="/unsubscribe" element={<Unsubscribe />} />
          <Route path="/auth/reset-password" element={<ResetPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
      </SidebarProvider>
    </Router>
  );
}

export default App;
