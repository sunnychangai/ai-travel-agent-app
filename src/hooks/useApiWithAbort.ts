import { useEffect, useRef, useState, useCallback } from 'react';
import { RequestManager } from '../services/openaiService';

interface UseApiOptions {
  /**
   * Whether to automatically abort requests when the component unmounts
   */
  abortOnUnmount?: boolean;
  
  /**
   * Automatic timeout in milliseconds for requests
   */
  timeout?: number;
}

/**
 * Custom hook for handling API calls with proper cleanup and abort handling
 * @param options Configuration options
 * @returns Object with request state and control methods
 */
export function useApiWithAbort(options: UseApiOptions = {}) {
  const { abortOnUnmount = true, timeout } = options;
  
  // Create a request manager that will be cleaned up on unmount
  const requestManager = useRef<RequestManager>(new RequestManager());
  
  // Track loading state
  const [isLoading, setIsLoading] = useState(false);
  
  // Track the last error
  const [error, setError] = useState<Error | null>(null);
  
  // Create an abort signal
  const createSignal = useCallback(() => {
    return requestManager.current.createSignal(timeout);
  }, [timeout]);
  
  // Wrap API calls with proper state management
  const callApi = useCallback(async <T>(
    apiFunction: (signal?: AbortSignal) => Promise<T>
  ): Promise<T> => {
    // Reset previous error
    setError(null);
    setIsLoading(true);
    
    try {
      // Create a signal for this call
      const signal = createSignal();
      
      // Call the API function with the signal
      return await apiFunction(signal);
    } catch (err: any) {
      // Don't treat aborts as errors
      if (err.name === 'AbortError') {
        console.log('Request was aborted');
      } else {
        console.error('API error:', err);
        setError(err);
      }
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [createSignal]);
  
  // Abort all pending requests
  const abortAll = useCallback(() => {
    requestManager.current.abortAll();
  }, []);
  
  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (abortOnUnmount) {
        requestManager.current.abortAll();
      }
    };
  }, [abortOnUnmount]);
  
  return {
    isLoading,
    error,
    createSignal,
    callApi,
    abortAll
  };
}

export default useApiWithAbort; 