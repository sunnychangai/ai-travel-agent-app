import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App.tsx';
import { ItineraryProvider } from './contexts/ItineraryContext';
import { UserPreferencesProvider } from './contexts/UserPreferencesContext';
import ErrorBoundary from './components/ErrorBoundary';

// Import Supabase setup if needed
// import { supabase } from './services/supabase';

// Setup any global error handlers
window.addEventListener('error', (event) => {
  console.error('Global error:', event.error);
  // You could send this to an error tracking service
});

// Render the app
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <UserPreferencesProvider>
        <ItineraryProvider>
          <App />
        </ItineraryProvider>
      </UserPreferencesProvider>
    </ErrorBoundary>
  </React.StrictMode>,
);
