import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { useAuthInit } from './hooks/useAuth';
import Spinner from './components/ui/Spinner';

const LoginPage = React.lazy(() => import('./pages/auth/LoginPage'));
const PrivacyPolicyPage = React.lazy(() => import('./pages/landing/PrivacyPolicyPage'));
const TermsOfUsePage = React.lazy(() => import('./pages/landing/TermsOfUsePage'));

function App() {
  useAuthInit();

  return (
    <>
      <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <React.Suspense
          fallback={
            <div className="flex h-screen items-center justify-center">
              <Spinner size="lg" />
            </div>
          }
        >
          <Routes>
            {/* Root → Login */}
            <Route path="/" element={<Navigate to="/login" replace />} />

            {/* Public Pages */}
            <Route path="/login" element={<LoginPage />} />
            <Route path="/policy" element={<PrivacyPolicyPage />} />
            <Route path="/privacy-policy" element={<Navigate to="/policy" replace />} />
            <Route path="/terms" element={<TermsOfUsePage />} />

            {/* Catch-all */}
            <Route path="*" element={<Navigate to="/login" replace />} />
          </Routes>
        </React.Suspense>
      </BrowserRouter>
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 3500,
          style: { fontSize: '14px' },
        }}
      />
    </>
  );
}

export default App;
