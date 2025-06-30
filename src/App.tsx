import React from 'react';
import { 
  createBrowserRouter, 
  RouterProvider,
  Navigate, 
  Outlet 
} from 'react-router-dom';
import Home from './components/home';
import Landing from './pages/Landing';
import Auth from './pages/Auth';
import AppWithOnboarding from './pages/AppWithOnboarding';
import { Toaster } from './components/ui/toaster';
import { ItineraryProvider } from './contexts/ItineraryContext';
import ErrorBoundary from './components/ErrorBoundary';
import { clearAllCache, isMobileSafari } from './utils/mobileSafariUtils';

// Layout component for global elements like Toaster
function RootLayout() {
  return (
    <>
      <Outlet />
      <Toaster />
    </>
  );
}

// Wrap with global error boundary
function RootErrorBoundary() {
  return (
    <ErrorBoundary>
      <Outlet />
    </ErrorBoundary>
  );
}

// **MOBILE SAFARI FIX**: Enhanced error component for route loading failures
function RouteErrorFallback() {
  const handleReturnHome = async () => {
    console.log('User requested return to home from error state');
    
    // Clear all cache data for a fresh start
    await clearAllCache();
    
    // Use replace to avoid adding to history stack
    window.location.replace('/');
  };

  const handleReload = async () => {
    console.log('User requested app reload from error state');
    
    // Clear all cache data for a fresh start
    await clearAllCache();
    
    // Force a hard reload
    window.location.reload();
  };

  const handleClearCacheOnly = async () => {
    console.log('User requested cache clear only');
    
    await clearAllCache();
    
    // Show success message briefly then reload
    alert('Cache cleared! The app will reload now.');
    window.location.reload();
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-md p-6 max-w-md w-full text-center">
        <h2 className="text-xl font-semibold text-gray-900 mb-2">
          Oops! Something went wrong
        </h2>
        <p className="text-gray-600 mb-4">
          This sometimes happens on mobile browsers when switching between apps. 
          Let's get you back on track.
        </p>
                 <div className="space-y-2">
           <button
             onClick={handleReturnHome}
             className="w-full bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 transition-colors"
           >
             Return to Home
           </button>
           <button
             onClick={handleReload}
             className="w-full bg-gray-500 text-white px-4 py-2 rounded-lg hover:bg-gray-600 transition-colors"
           >
             Reload App
           </button>
           {isMobileSafari() && (
             <button
               onClick={handleClearCacheOnly}
               className="w-full bg-orange-500 text-white px-4 py-2 rounded-lg hover:bg-orange-600 transition-colors text-sm"
             >
               Clear Cache & Reload
             </button>
           )}
         </div>
        <p className="text-xs text-gray-500 mt-4">
          Error ID: {Date.now().toString(36)}
        </p>
      </div>
    </div>
  );
}

// Define router using the new API with future flags to remove v7 warnings
const router = createBrowserRouter([
  {
    element: <RootLayout />,
    errorElement: <RouteErrorFallback />,
    children: [
      {
        element: <RootErrorBoundary />,
        children: [
          {
            path: "/",
            element: <Landing />,
            errorElement: <RouteErrorFallback />,
          },
          {
            path: "/app",
            element: <AppWithOnboarding />,
            errorElement: <RouteErrorFallback />,
          },
          {
            path: "/auth",
            element: <Auth />,
            errorElement: <RouteErrorFallback />,
          },
          {
            path: "*",
            element: <Navigate to="/" replace />,
          }
        ]
      }
    ]
  }
], {
  future: {
    v7_relativeSplatPath: true,
    v7_fetcherPersist: true,
    v7_normalizeFormMethod: true,
    v7_partialHydration: true,
    v7_skipActionErrorRevalidation: true,
  },
});

function App() {
  return <RouterProvider router={router} />;
}

export default App;
