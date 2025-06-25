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
import MyTripsPage from './pages/MyTrips';
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

// Define router using the new API
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
            path: "/my-trips",
            element: <MyTripsPage />,
          },
          {
            path: "*",
            element: <Navigate to="/" replace />,
          }
        ]
      }
    ]
  }
]);

function App() {
  return <RouterProvider router={router} />;
}

export default App;
