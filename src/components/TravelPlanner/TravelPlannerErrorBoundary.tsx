import React, { useState } from 'react';
import ErrorBoundary from '../ErrorBoundary';
import { Button } from '../ui/button';
import { AlertTriangle, Home, RefreshCw, Settings, TestTube, CheckCircle, XCircle, ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';
import { enhancedOpenAIService } from '../../services/enhancedOpenAIService';

interface TravelPlannerErrorBoundaryProps {
  children: React.ReactNode;
}

const TravelPlannerFallback = ({ error }: { error?: Error }) => {
  const [diagnosticResults, setDiagnosticResults] = useState<any>(null);
  const [isRunningDiagnostic, setIsRunningDiagnostic] = useState(false);

  // Check if this is an API key related error
  const isApiKeyError = error?.message?.includes('API key') || 
                       error?.message?.includes('not configured') ||
                       error?.message?.includes('missing') ||
                       error?.message?.includes('VITE_OPENAI_API_KEY');
  
  // Check if this is a network error
  const isNetworkError = error?.message?.includes('network') ||
                        error?.message?.includes('timeout') ||
                        error?.message?.includes('fetch') ||
                        error?.message?.includes('Failed to fetch');
  
  // Development mode - show more details
  const isDevelopment = import.meta.env.DEV;

  // Check current environment variables
  const currentApiKey = import.meta.env.VITE_OPENAI_API_KEY;
  const hasApiKey = Boolean(currentApiKey);
  const isPlaceholderKey = currentApiKey === 'your_openai_api_key' || currentApiKey === 'sk-your-key-here';

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
          hasApiKey: hasApiKey,
          apiKeyFormat: isPlaceholderKey ? 'placeholder' : (currentApiKey?.startsWith('sk-') ? 'valid' : 'unknown'),
          networkConnectivity: false,
          apiResponse: false,
        }
      });
    }
    setIsRunningDiagnostic(false);
  };
  
  return (
    <div className="flex flex-col items-center justify-center p-8 bg-white border rounded-lg shadow-sm min-h-[300px] text-center">
      <AlertTriangle className="h-14 w-14 text-amber-500 mb-4" />
      <h2 className="text-2xl font-semibold text-slate-800 mb-2">Oops! There was a problem</h2>
      
      {!hasApiKey ? (
        <div className="text-slate-600 mb-6 max-w-md">
          <p className="mb-2">
            <strong>Missing API Key:</strong> The OpenAI API key is not configured.
          </p>
          <p className="text-sm">
            The VITE_OPENAI_API_KEY environment variable is missing from your deployment settings.
          </p>
        </div>
      ) : isPlaceholderKey ? (
        <div className="text-slate-600 mb-6 max-w-md">
          <p className="mb-2">
            <strong>Placeholder API Key:</strong> The OpenAI API key appears to be a placeholder value.
          </p>
          <p className="text-sm">
            Please replace the placeholder with your actual OpenAI API key in your deployment settings.
          </p>
        </div>
      ) : isApiKeyError ? (
        <div className="text-slate-600 mb-6 max-w-md">
          <p className="mb-2">
            <strong>API Configuration Issue:</strong> The OpenAI API key appears to be invalid or unauthorized.
          </p>
          <p className="text-sm">
            Please check that your OpenAI API key is correct and has sufficient credits.
          </p>
        </div>
      ) : isNetworkError ? (
        <div className="text-slate-600 mb-6 max-w-md">
          <p className="mb-2">
            <strong>Network Issue:</strong> Unable to connect to the OpenAI service.
          </p>
          <p className="text-sm">
            Please check your internet connection and try again. If the problem persists, OpenAI's service may be temporarily unavailable.
          </p>
        </div>
      ) : (
        <div className="text-slate-600 mb-6 max-w-md">
          <p className="mb-2">
            We encountered an issue with the travel planner.
          </p>
          <p className="text-sm">
            This could be due to a temporary service issue or configuration problem. Please try reloading the page.
          </p>
        </div>
      )}

      {/* Environment Status */}
      <div className="bg-slate-50 border rounded-md p-4 mb-6 max-w-2xl">
        <h3 className="text-sm font-medium text-slate-800 mb-3">Configuration Status</h3>
        <div className="space-y-2 text-sm">
          <div className="flex items-center gap-2">
            {hasApiKey ? 
              <CheckCircle className="h-4 w-4 text-green-500" /> : 
              <XCircle className="h-4 w-4 text-red-500" />
            }
            <span>OpenAI API Key: {hasApiKey ? 'Present' : 'Missing'}</span>
          </div>
          {hasApiKey && (
            <div className="flex items-center gap-2">
              {!isPlaceholderKey ? 
                <CheckCircle className="h-4 w-4 text-green-500" /> : 
                <XCircle className="h-4 w-4 text-red-500" />
              }
              <span>API Key Format: {isPlaceholderKey ? 'Placeholder' : 'Configured'}</span>
            </div>
          )}
        </div>
      </div>

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
      
      <div className="flex gap-4 flex-wrap justify-center">
        <Button 
          onClick={() => window.location.reload()}
          variant="outline"
          className="flex items-center gap-2"
        >
          <RefreshCw className="h-4 w-4" />
          Reload Page
        </Button>
        <Link to="/">
          <Button className="flex items-center gap-2">
            <Home className="h-4 w-4" />
            Go to Home
          </Button>
        </Link>
        {(isApiKeyError || !hasApiKey || isPlaceholderKey) && (
          <>
            <Button 
              onClick={runDiagnostic}
              disabled={isRunningDiagnostic}
              variant="secondary"
              className="flex items-center gap-2"
            >
              <TestTube className="h-4 w-4" />
              {isRunningDiagnostic ? 'Testing...' : 'Run Diagnostic'}
            </Button>
            <Button 
              onClick={() => window.open('https://vercel.com/docs/projects/environment-variables', '_blank')}
              variant="secondary"
              className="flex items-center gap-2"
            >
              <Settings className="h-4 w-4" />
              Vercel Setup Guide
            </Button>
            <Button 
              onClick={() => window.open('https://platform.openai.com/api-keys', '_blank')}
              variant="secondary"
              className="flex items-center gap-2"
            >
              <ExternalLink className="h-4 w-4" />
              Get OpenAI API Key
            </Button>
          </>
        )}
      </div>
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