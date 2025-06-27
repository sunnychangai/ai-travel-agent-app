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

// Define router using the new API with future flags to remove v7 warnings
const router = createBrowserRouter([
  {
    element: <RootLayout />,
    children: [
      {
        element: <RootErrorBoundary />,
        children: [
          {
            path: "/",
            element: <Landing />,
          },
          {
            path: "/app",
            element: <AppWithOnboarding />,
          },
          {
            path: "/auth",
            element: <Auth />,
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
