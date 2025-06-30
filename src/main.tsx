import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App.tsx';
import { AuthProvider } from './contexts/AuthContext';
import { ItineraryProvider } from './contexts/ItineraryContext';
import { UserPreferencesProvider } from './contexts/UserPreferencesContext';
import ErrorBoundary from './components/ErrorBoundary';
import { setupMobileSafariHandlers, monitorAppHealth, isMobileSafari } from './utils/mobileSafariUtils';

// Import Supabase setup if needed
// import { supabase } from './services/supabase';

// **MOBILE SAFARI FIX**: Enhanced global error handlers
window.addEventListener('error', (event) => {
  console.error('Global error:', event.error);
  
  // Handle specific mobile Safari reload errors
  if (event.error && event.error.message) {
    const errorMessage = event.error.message.toLowerCase();
    if (errorMessage.includes('not_found') || errorMessage.includes('404') || 
        errorMessage.includes('failed to fetch') || errorMessage.includes('network error')) {
      console.log('Detected navigation error, likely from mobile Safari. Attempting recovery.');
      
      // Clear potentially corrupted cache data
      try {
        localStorage.removeItem('react-router-dom');
        sessionStorage.clear();
        console.log('Cleared routing cache data');
      } catch (e) {
        console.warn('Failed to clear cache:', e);
      }
      
      // Redirect to home with a small delay
      setTimeout(() => {
        window.location.replace('/');
      }, 500);
      return;
    }
  }
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
    
    // Check if we're in an error state and recover
    const currentPath = window.location.pathname;
    if (currentPath === '/' && window.location.search.includes('error')) {
      console.log('Detected error state in URL, cleaning up');
      window.history.replaceState({}, '', '/');
    }
    
    // Validate current route exists
    const validRoutes = ['/', '/app', '/auth'];
    if (!validRoutes.includes(currentPath) && !currentPath.startsWith('/app')) {
      console.log('Invalid route detected, redirecting to home');
      window.location.replace('/');
    }
  }
});

// **MOBILE SAFARI FIX**: Handle browser back/forward navigation
window.addEventListener('popstate', (event) => {
  console.log('Popstate event detected:', event.state);
  
  // If we don't have proper state, redirect to home
  if (!event.state && window.location.pathname !== '/') {
    console.log('No state found in popstate, redirecting to home');
    window.location.replace('/');
  }
});

// **MOBILE SAFARI FIX**: Handle page focus/blur for cache management
window.addEventListener('focus', () => {
  console.log('Window focused, validating app state');
  
  // Check if root element is properly mounted
  const root = document.getElementById('root');
  if (!root || !root.firstChild) {
    console.log('Root element missing or empty, reloading app');
    window.location.reload();
  }
});

// **MOBILE SAFARI FIX**: Add service worker for better caching control
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js').catch(error => {
    console.log('ServiceWorker registration failed (expected if no sw.js):', error);
  });
}

// **MOBILE SAFARI FIX**: Setup mobile Safari specific handlers
setupMobileSafariHandlers();

// **MOBILE SAFARI FIX**: Start app health monitoring
monitorAppHealth();

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
