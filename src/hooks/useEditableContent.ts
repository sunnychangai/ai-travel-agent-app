import { useState, useRef, useEffect, useCallback } from 'react';

/**
 * Custom hook for editable content with keyboard support
 * @param initialValue The initial value to edit
 * @returns Editing state and control functions
 */
export function useEditableContent<T>(initialValue: T) {
  const [value, setValue] = useState<T>(initialValue);
  const [isEditing, setIsEditing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  
  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);
  
  const startEditing = useCallback(() => {
    setIsEditing(true);
  }, []);
  
  const stopEditing = useCallback(() => {
    setIsEditing(false);
  }, []);
  
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      stopEditing();
    } else if (e.key === 'Escape') {
      stopEditing();
    }
  }, [stopEditing]);
  
  return {
    value,
    setValue,
    isEditing,
    startEditing,
    stopEditing,
    handleKeyDown,
    inputRef
  };
}

export default useEditableContent; 