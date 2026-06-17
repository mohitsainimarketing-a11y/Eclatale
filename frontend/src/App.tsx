import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Landing from './pages/Landing';
import Auth from './pages/auth';
import Onboarding from './pages/Onboarding';
import Dashboard from './pages/Dashboard';
import CreatePost from './pages/CreatePost';
import GuidedCreate from './pages/GuidedCreate';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/signup" element={<Auth />} />
        <Route path="/onboarding" element={<Onboarding />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/create" element={<CreatePost />} />
        <Route path="/guided" element={<GuidedCreate />} />
      </Routes>
    </Router>
  );
}

export default App;
