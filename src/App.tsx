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

// **MOBILE SAFARI FIX**: Error component for route loading failures
function RouteErrorFallback() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-md p-6 max-w-md w-full text-center">
        <h2 className="text-xl font-semibold text-gray-900 mb-2">
          Loading Error
        </h2>
        <p className="text-gray-600 mb-4">
          There was an issue loading the page. This sometimes happens on mobile browsers.
        </p>
        <button
          onClick={() => window.location.href = '/'}
          className="bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 transition-colors"
        >
          Return to Home
        </button>
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
