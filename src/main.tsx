import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App.tsx';
import { AuthProvider } from './contexts/AuthContext';
import { ItineraryProvider } from './contexts/ItineraryContext';
import { UserPreferencesProvider } from './contexts/UserPreferencesContext';
import ErrorBoundary from './components/ErrorBoundary';

// Import Supabase setup if needed
// import { supabase } from './services/supabase';

// **MOBILE SAFARI FIX**: Enhanced global error handlers
window.addEventListener('error', (event) => {
  console.error('Global error:', event.error);
  
  // Handle specific mobile Safari reload errors
  if (event.error && event.error.message) {
    const errorMessage = event.error.message.toLowerCase();
    if (errorMessage.includes('not_found') || errorMessage.includes('404')) {
      console.log('Detected 404 error, likely from mobile Safari reload. Redirecting to home.');
      // Small delay to avoid rapid redirects
      setTimeout(() => {
        window.location.href = '/';
      }, 1000);
      return;
    }
  }
  
  // You could send this to an error tracking service
});

// **MOBILE SAFARI FIX**: Handle unhandled promise rejections
window.addEventListener('unhandledrejection', (event) => {
  console.error('Unhandled promise rejection:', event.reason);
  
  // Handle specific routing/loading failures
  if (event.reason && typeof event.reason === 'string') {
    const reason = event.reason.toLowerCase();
    if (reason.includes('not_found') || reason.includes('failed to fetch')) {
      console.log('Detected navigation/fetch failure, likely from mobile Safari. Attempting recovery.');
      event.preventDefault(); // Prevent the default unhandled rejection behavior
    }
  }
});

// **MOBILE SAFARI FIX**: Handle page visibility changes for better state management
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') {
    console.log('Page became visible, checking for potential reload issues');
    // Could add additional recovery logic here if needed
  }
});

// Render the app
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <AuthProvider>
        <UserPreferencesProvider>
          <ItineraryProvider>
            <App />
          </ItineraryProvider>
        </UserPreferencesProvider>
      </AuthProvider>
    </ErrorBoundary>
  </React.StrictMode>,
);
