import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.tsx';
import './index.css';

import { ErrorBoundary } from './components/ui/ErrorBoundary.tsx';
import { initMonitoring } from './lib/monitoring';
import { initAnalytics } from './lib/analytics';

initMonitoring();
void initAnalytics();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);
