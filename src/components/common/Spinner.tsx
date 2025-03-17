import React from 'react';
import { cn } from '../../utils/cn';

interface SpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export const Spinner: React.FC<SpinnerProps> = ({ 
  size = 'md', 
  className 
}) => {
  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-8 h-8',
    lg: 'w-12 h-12'
  };

  return (
    <div className="flex items-center justify-center">
      <div 
        className={cn(
          'animate-spin rounded-full border-t-transparent border-2',
          sizeClasses[size],
          size === 'sm' ? 'border-2' : size === 'md' ? 'border-3' : 'border-4',
          'border-primary',
          className
        )}
      />
    </div>
  );
}; 