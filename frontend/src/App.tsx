import React, { Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';

const Landing = lazy(() => import('./pages/Landing'));
const Auth = lazy(() => import('./pages/auth'));
const Onboarding = lazy(() => import('./pages/Onboarding'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const CreatePost = lazy(() => import('./pages/CreatePost'));
const History = lazy(() => import('./pages/History'));
const PersonaSetup = lazy(() => import('./pages/PersonaSetup'));
const Settings = lazy(() => import('./pages/Settings'));
const CreateVisual = lazy(() => import('./pages/CreateVisual'));
const Intelligence = lazy(() => import('./pages/Intelligence'));

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

function App() {
  return (
    <Router>
      <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/signup" element={<Auth />} />
          <Route path="/login" element={<Auth defaultIsLogin />} />
          <Route path="/onboarding" element={<Onboarding />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/create" element={<CreatePost />} />
          <Route path="/guided" element={<Navigate to="/create" replace />} />
          <Route path="/history" element={<History />} />
          <Route path="/persona-setup" element={<PersonaSetup />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/create-visual" element={<CreateVisual />} />
          <Route path="/intelligence" element={<Intelligence />} />
        </Routes>
      </Suspense>
    </Router>
  );
}

export default App;
