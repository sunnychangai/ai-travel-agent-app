import React from 'react';
import { AlertCircle } from 'lucide-react';
import { Alert, AlertTitle, AlertDescription } from '../ui/alert';

type ErrorAlertProps = {
  message: string | null;
};

/**
 * Displays an error alert message when errors occur
 */
const ErrorAlert = React.memo(({ message }: ErrorAlertProps) => {
  if (!message) return null;
  
  return (
    <Alert variant="destructive" className="mt-4">
      <AlertCircle className="h-4 w-4" />
      <AlertTitle>Error</AlertTitle>
      <AlertDescription>{message}</AlertDescription>
    </Alert>
  );
});

ErrorAlert.displayName = 'ErrorAlert';

export default ErrorAlert; 