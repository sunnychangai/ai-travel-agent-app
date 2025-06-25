import React from 'react';
import ErrorBoundary from '../ErrorBoundary';
import { Button } from '../ui/button';
import { AlertTriangle, Home } from 'lucide-react';
import { Link } from 'react-router-dom';

interface TravelPlannerErrorBoundaryProps {
  children: React.ReactNode;
}

const TravelPlannerFallback = () => (
  <div className="flex flex-col items-center justify-center p-8 bg-white border rounded-lg shadow-sm min-h-[300px] text-center">
    <AlertTriangle className="h-14 w-14 text-amber-500 mb-4" />
    <h2 className="text-2xl font-semibold text-slate-800 mb-2">Oops! There was a problem</h2>
    <p className="text-slate-600 mb-6 max-w-md">
      We encountered an issue with the travel planner. This could be due to missing data or a configuration problem.
    </p>
    <div className="flex gap-4">
      <Button 
        onClick={() => window.location.reload()}
        variant="outline"
      >
        Reload Page
      </Button>
      <Link to="/">
        <Button className="flex items-center gap-2">
          <Home className="h-4 w-4" />
          Go to Home
        </Button>
      </Link>
    </div>
  </div>
);

const TravelPlannerErrorBoundary: React.FC<TravelPlannerErrorBoundaryProps> = ({ children }) => {
  return (
    <ErrorBoundary fallback={<TravelPlannerFallback />}>
      {children}
    </ErrorBoundary>
  );
};

export default TravelPlannerErrorBoundary; 