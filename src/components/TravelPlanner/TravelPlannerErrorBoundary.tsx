import React, { useState } from 'react';
import ErrorBoundary from '../ErrorBoundary';
import { Button } from '../ui/button';
import { AlertTriangle, Home, RefreshCw, Settings, TestTube, CheckCircle, XCircle, Smartphone, Wifi, WifiOff } from 'lucide-react';
import { Link } from 'react-router-dom';
import { enhancedOpenAIService } from '../../services/enhancedOpenAIService';

interface TravelPlannerErrorBoundaryProps {
  children: React.ReactNode;
}

const TravelPlannerFallback = ({ error }: { error?: Error }) => {
  const [diagnosticResults, setDiagnosticResults] = useState<any>(null);
  const [isRunningDiagnostic, setIsRunningDiagnostic] = useState(false);

  // Detect if we're on a mobile device
  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
  const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);

  // Check if this is an API key related error
  const isApiKeyError = error?.message?.includes('API key') || 
                       error?.message?.includes('not configured') ||
                       error?.message?.includes('missing');
  
  // Check if this is a network error
  const isNetworkError = error?.message?.includes('network') ||
                        error?.message?.includes('timeout') ||
                        error?.message?.includes('fetch') ||
                        error?.message?.includes('Failed to fetch');
  
  // Check if this is a mobile-specific error
  const isMobileCompatibilityError = error?.message?.includes('dangerouslyAllowBrowser') ||
                                   error?.message?.includes('browser-like environment') ||
                                   error?.message?.includes('CORS') ||
                                   (isMobile && (isNetworkError || error?.message?.includes('TypeError')));

  // Check if this is an iOS/Safari specific error
  const isIOSError = isIOS && (
    error?.message?.includes('SecurityError') ||
    error?.message?.includes('NotAllowedError') ||
    error?.message?.includes('AbortError') ||
    error?.stack?.includes('webkit')
  );
  
  // Development mode - show more details
  const isDevelopment = import.meta.env.DEV;

  const runDiagnostic = async () => {
    setIsRunningDiagnostic(true);
    try {
      const results = await enhancedOpenAIService.testApiConfiguration();
      setDiagnosticResults(results);
    } catch (error) {
      setDiagnosticResults({
        success: false,
        message: 'Failed to run diagnostic',
        details: {
          hasApiKey: false,
          apiKeyFormat: 'unknown',
          networkConnectivity: false,
          apiResponse: false,
        }
      });
    }
    setIsRunningDiagnostic(false);
  };

  // Mobile-specific retry function
  const handleMobileRetry = () => {
    // Clear any cached data that might be causing issues
    if ('caches' in window) {
      caches.keys().then(names => {
        names.forEach(name => {
          caches.delete(name);
        });
      });
    }
    
    // Clear localStorage items that might be corrupted
    try {
      const keysToRemove = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && (key.includes('OpenAI') || key.includes('API') || key.includes('cache'))) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach(key => localStorage.removeItem(key));
    } catch (e) {
      console.log('Could not clear localStorage:', e);
    }
    
    // Reload the page
    window.location.reload();
  };
  
  return (
    <div className="flex flex-col items-center justify-center p-4 md:p-8 bg-white border rounded-lg shadow-sm min-h-[300px] text-center">
      <AlertTriangle className="h-12 w-12 md:h-14 md:w-14 text-amber-500 mb-4" />
      <h2 className="text-xl md:text-2xl font-semibold text-slate-800 mb-2">Oops! There was a problem</h2>
      
      {/* Mobile-specific error messages */}
      {isMobileCompatibilityError ? (
        <div className="text-slate-600 mb-6 max-w-md">
          <div className="flex items-center justify-center mb-2">
            <Smartphone className="h-5 w-5 mr-2 text-blue-500" />
            <strong>Mobile Device Detected</strong>
          </div>
          <p className="mb-2">
            We're having trouble connecting to our AI service on your mobile device.
          </p>
          <p className="text-sm">
            This can happen due to network restrictions or browser compatibility issues on mobile devices.
          </p>
          {isIOS && (
            <p className="text-sm mt-2 text-blue-600">
              <strong>iOS/Safari users:</strong> Try switching to a different network or using cellular data instead of WiFi.
            </p>
          )}
        </div>
      ) : isApiKeyError ? (
        <div className="text-slate-600 mb-6 max-w-md">
          <p className="mb-2">
            <strong>API Configuration Issue:</strong> The OpenAI API key appears to be missing or invalid.
          </p>
          <p className="text-sm">
            Please check your environment variables in the Vercel deployment settings and ensure 
            VITE_OPENAI_API_KEY is properly configured.
          </p>
        </div>
      ) : isNetworkError ? (
        <div className="text-slate-600 mb-6 max-w-md">
          <div className="flex items-center justify-center mb-2">
            <WifiOff className="h-5 w-5 mr-2 text-red-500" />
            <strong>Network Issue</strong>
          </div>
          <p className="mb-2">
            Unable to connect to the travel planning service.
          </p>
          <p className="text-sm">
            Please check your internet connection and try again.
          </p>
          {isMobile && (
            <p className="text-sm mt-2 text-blue-600">
              <strong>Mobile users:</strong> Try switching between WiFi and cellular data, or move to a location with better signal.
            </p>
          )}
        </div>
      ) : isIOSError ? (
        <div className="text-slate-600 mb-6 max-w-md">
          <div className="flex items-center justify-center mb-2">
            <Smartphone className="h-5 w-5 mr-2 text-blue-500" />
            <strong>iOS/Safari Compatibility Issue</strong>
          </div>
          <p className="mb-2">
            We detected a compatibility issue with your iOS device or Safari browser.
          </p>
          <p className="text-sm">
            Try refreshing the page, clearing your browser cache, or using a different browser like Chrome or Firefox.
          </p>
        </div>
      ) : (
        <p className="text-slate-600 mb-6 max-w-md">
          We encountered an issue with the travel planner. This could be due to missing data or a configuration problem.
          {isMobile && (
            <span className="block mt-2 text-sm text-blue-600">
              <strong>Mobile users:</strong> Try the mobile-specific troubleshooting steps below.
            </span>
          )}
        </p>
      )}

      {/* Diagnostic Results */}
      {diagnosticResults && (
        <div className="bg-slate-50 border rounded-md p-4 mb-6 max-w-2xl">
          <h3 className="text-sm font-medium text-slate-800 mb-3 flex items-center gap-2">
            <TestTube className="h-4 w-4" />
            Diagnostic Results
          </h3>
          <div className="space-y-2 text-sm">
            <div className="flex items-center gap-2">
              {diagnosticResults.details.hasApiKey ? 
                <CheckCircle className="h-4 w-4 text-green-500" /> : 
                <XCircle className="h-4 w-4 text-red-500" />
              }
              <span>API Key Present: {diagnosticResults.details.hasApiKey ? 'Yes' : 'No'}</span>
            </div>
            <div className="flex items-center gap-2">
              {diagnosticResults.details.apiKeyFormat === 'valid' ? 
                <CheckCircle className="h-4 w-4 text-green-500" /> : 
                <XCircle className="h-4 w-4 text-red-500" />
              }
              <span>API Key Format: {diagnosticResults.details.apiKeyFormat}</span>
            </div>
            <div className="flex items-center gap-2">
              {diagnosticResults.details.networkConnectivity ? 
                <CheckCircle className="h-4 w-4 text-green-500" /> : 
                <XCircle className="h-4 w-4 text-red-500" />
              }
              <span>Network Connection: {diagnosticResults.details.networkConnectivity ? 'OK' : 'Failed'}</span>
            </div>
            <div className="flex items-center gap-2">
              {diagnosticResults.details.apiResponse ? 
                <CheckCircle className="h-4 w-4 text-green-500" /> : 
                <XCircle className="h-4 w-4 text-red-500" />
              }
              <span>API Response: {diagnosticResults.details.apiResponse ? 'OK' : 'Failed'}</span>
            </div>
          </div>
          <p className={`mt-3 text-sm ${diagnosticResults.success ? 'text-green-700' : 'text-red-700'}`}>
            {diagnosticResults.message}
          </p>
        </div>
      )}
      
      {isDevelopment && error && (
        <div className="bg-red-50 border border-red-200 rounded-md p-4 mb-6 max-w-2xl">
          <h3 className="text-sm font-medium text-red-800 mb-2">Development Error Details:</h3>
          <div className="text-xs text-red-700 mb-2">
            <strong>Device Info:</strong> {isMobile ? 'Mobile' : 'Desktop'} 
            {isIOS && ' (iOS)'} 
            {isSafari && ' (Safari)'}
          </div>
          <pre className="text-xs text-red-700 whitespace-pre-wrap break-all">
            {error.message}
          </pre>
          {error.stack && (
            <details className="mt-2">
              <summary className="text-xs text-red-600 cursor-pointer">Stack Trace</summary>
              <pre className="text-xs text-red-600 mt-1 whitespace-pre-wrap break-all">
                {error.stack}
              </pre>
            </details>
          )}
        </div>
      )}
      
      <div className="flex gap-2 md:gap-4 flex-wrap justify-center">
        {/* Mobile-specific retry button */}
        {isMobile ? (
          <Button 
            onClick={handleMobileRetry}
            variant="outline"
            className="flex items-center gap-2"
          >
            <RefreshCw className="h-4 w-4" />
            Mobile Retry
          </Button>
        ) : (
          <Button 
            onClick={() => window.location.reload()}
            variant="outline"
            className="flex items-center gap-2"
          >
            <RefreshCw className="h-4 w-4" />
            Reload Page
          </Button>
        )}
        
        <Link to="/">
          <Button className="flex items-center gap-2">
            <Home className="h-4 w-4" />
            Go to Home
          </Button>
        </Link>
        
        {(isApiKeyError || isMobileCompatibilityError) && (
          <Button 
            onClick={runDiagnostic}
            disabled={isRunningDiagnostic}
            variant="secondary"
            className="flex items-center gap-2"
          >
            <TestTube className="h-4 w-4" />
            {isRunningDiagnostic ? 'Testing...' : 'Run Diagnostic'}
          </Button>
        )}
        
        {isApiKeyError && !isMobile && (
          <Button 
            onClick={() => window.open('https://vercel.com/docs/projects/environment-variables', '_blank')}
            variant="secondary"
            className="flex items-center gap-2"
          >
            <Settings className="h-4 w-4" />
            Vercel Config Help
          </Button>
        )}
      </div>
      
      {/* Mobile-specific troubleshooting tips */}
      {isMobile && (
        <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-md max-w-md">
          <h4 className="text-sm font-medium text-blue-800 mb-2">Mobile Troubleshooting Tips:</h4>
          <ul className="text-xs text-blue-700 space-y-1">
            <li>• Try switching between WiFi and cellular data</li>
            <li>• Close and reopen your browser app</li>
            <li>• Clear your browser cache and cookies</li>
            {isIOS && <li>• Try using Chrome or Firefox instead of Safari</li>}
            <li>• Ensure you have a stable internet connection</li>
            <li>• Try again in a few minutes</li>
          </ul>
        </div>
      )}
    </div>
  );
};

const TravelPlannerErrorBoundary: React.FC<TravelPlannerErrorBoundaryProps> = ({ children }) => {
  return (
    <ErrorBoundary fallback={(error) => <TravelPlannerFallback error={error} />}>
      {children}
    </ErrorBoundary>
  );
};

export default TravelPlannerErrorBoundary; 