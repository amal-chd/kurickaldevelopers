import React from 'react';
import { Link } from 'react-router-dom';
import { useSeo } from '../../lib/seo';

const NotFoundPage: React.FC = () => {
  useSeo({ title: 'Page not found', description: 'The page you were looking for does not exist.' });
  return (
    <main className="min-h-screen flex items-center justify-center bg-slate-50 px-6">
      <div className="text-center max-w-md">
        <p className="text-sm font-bold text-amber-600 tracking-widest">404</p>
        <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-slate-900">Page not found</h1>
        <p className="mt-3 text-slate-600">The link may be broken or the page may have moved.</p>
        <div className="mt-6 flex justify-center gap-3">
          <Link to="/" className="h-10 px-5 inline-flex items-center rounded-lg bg-slate-900 text-white text-sm font-semibold">Go home</Link>
          <Link to="/app/dashboard" className="h-10 px-5 inline-flex items-center rounded-lg border border-slate-300 text-sm font-medium">Open the app</Link>
        </div>
      </div>
    </main>
  );
};

export default NotFoundPage;
