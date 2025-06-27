import React from 'react';
import { motion } from 'framer-motion';
import { Loader2, CheckCircle, XCircle } from 'lucide-react';

export interface ItineraryProgressProps {
  status: 'idle' | 'loading' | 'success' | 'error' | 'starting';
  progress: number;
  step: string;
  onCancel?: () => void;
}

/**
 * A component that displays the progress of itinerary generation
 */
const ItineraryProgress: React.FC<ItineraryProgressProps> = ({
  status,
  progress,
  step,
  onCancel,
}) => {
  if (status === 'idle') {
    return null;
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="bg-white rounded-lg p-8 max-w-md w-full shadow-2xl"
      >
        <div className="text-center mb-6">
          <h3 className="text-2xl font-bold text-slate-800 mb-2">
            {status === 'loading' && 'Creating Your Itinerary'}
            {status === 'starting' && 'Preparing...'}
            {status === 'success' && 'Itinerary Created!'}
            {status === 'error' && 'Oops! Something went wrong'}
          </h3>
          <p className="text-slate-600">{step}</p>
        </div>

        {/* Status Icon */}
        <div className="flex justify-center mb-4">
          {(status === 'loading' || status === 'starting') && (
            <Loader2 className="h-12 w-12 text-blue-500 animate-spin" />
          )}
          {status === 'success' && (
            <CheckCircle className="h-12 w-12 text-green-500" />
          )}
          {status === 'error' && (
            <XCircle className="h-12 w-12 text-red-500" />
          )}
        </div>

        {/* Progress Bar - show during loading and starting */}
        {(status === 'loading' || status === 'starting') && (
          <div className="w-full bg-slate-200 rounded-full h-3 mb-6">
            <motion.div
              className="bg-blue-500 h-3 rounded-full"
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              transition={{ 
                duration: 0.5,
                ease: "easeOut",
                type: "tween"
              }}
              style={{ 
                willChange: "width", 
                backfaceVisibility: "hidden"
              }}
            />
          </div>
        )}

        {/* Progress Steps */}
        {(status === 'loading' || status === 'starting') && (
          <div className="grid grid-cols-4 gap-2 mb-6">
            {[
              { label: 'Planning', threshold: 10 },
              { label: 'Generating', threshold: 40 },
              { label: 'Organizing', threshold: 70 },
              { label: 'Finalizing', threshold: 95 },
            ].map((step, index) => (
              <div key={index} className="flex flex-col items-center">
                <motion.div
                  className={`w-6 h-6 rounded-full flex items-center justify-center mb-1 ${
                    progress >= step.threshold
                      ? 'bg-blue-500 text-white'
                      : 'bg-slate-200 text-slate-400'
                  }`}
                  animate={{
                    scale: progress >= step.threshold ? 1.1 : 1,
                  }}
                  transition={{ duration: 0.3 }}
                >
                  {progress >= step.threshold ? (
                    <CheckCircle className="h-4 w-4" />
                  ) : (
                    index + 1
                  )}
                </motion.div>
                <span
                  className={`text-xs transition-colors duration-300 ${
                    progress >= step.threshold
                      ? 'text-blue-600 font-medium'
                      : 'text-slate-400'
                  }`}
                >
                  {step.label}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Buttons */}
        <div className="flex justify-center">
          {(status === 'loading' || status === 'starting') && onCancel && (
            <button
              onClick={onCancel}
              className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-md transition-colors"
            >
              Cancel
            </button>
          )}
          
          {status === 'success' && (
            <button
              onClick={onCancel}
              className="px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-md transition-colors"
            >
              View Itinerary
            </button>
          )}
          
          {status === 'error' && (
            <button
              onClick={onCancel}
              className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-md transition-colors"
            >
              Try Again
            </button>
          )}
        </div>
      </motion.div>
    </div>
  );
};

export default ItineraryProgress; 