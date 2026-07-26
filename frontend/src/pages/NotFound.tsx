import React from 'react';
import { Home, LayoutDashboard } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="min-h-screen gradient-hero dot-grid flex items-center justify-center px-5 text-center">
      <div className="max-w-md">
        <div className="text-7xl font-extrabold gradient-text mb-4">404</div>
        <h1 className="h2 text-brand-dark mb-3">Page not found</h1>
        <p className="body-text mb-8">
          The page you're looking for doesn't exist or may have moved.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <a href="/" className="btn-primary text-sm">
            <Home size={16} /> Back to home
          </a>
          <a href="/dashboard" className="btn-secondary text-sm">
            <LayoutDashboard size={16} /> Go to dashboard
          </a>
        </div>
      </div>
    </div>
  );
}
