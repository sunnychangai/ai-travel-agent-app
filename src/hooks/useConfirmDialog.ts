import { useReducer, useCallback } from 'react';

// Dialog state interface
type ConfirmDialogState = {
  open: boolean;
  title: string;
  description: string;
  onConfirm: () => void;
  onSaveCurrent?: () => void;
  confirmText?: string;
  saveCurrentText?: string;
  cancelText?: string;
};

// Initial state
const initialState: ConfirmDialogState = {
  open: false,
  title: '',
  description: '',
  onConfirm: () => {},
  onSaveCurrent: undefined,
  confirmText: undefined,
  saveCurrentText: undefined,
  cancelText: undefined,
};

// Action types
type DialogAction =
  | { 
      type: 'SHOW_DIALOG'; 
      title: string; 
      description: string; 
      onConfirm: () => void;
      onSaveCurrent?: () => void;
      confirmText?: string;
      saveCurrentText?: string;
      cancelText?: string;
    }
  | { type: 'HIDE_DIALOG' }
  | { type: 'SET_DIALOG_STATE'; state: Partial<ConfirmDialogState> };

// Reducer function
function dialogReducer(state: ConfirmDialogState, action: DialogAction): ConfirmDialogState {
  switch (action.type) {
    case 'SHOW_DIALOG':
      return {
        open: true,
        title: action.title,
        description: action.description,
        onConfirm: action.onConfirm,
        onSaveCurrent: action.onSaveCurrent,
        confirmText: action.confirmText,
        saveCurrentText: action.saveCurrentText,
        cancelText: action.cancelText,
      };
      
    case 'HIDE_DIALOG':
      return {
        ...state,
        open: false
      };
      
    case 'SET_DIALOG_STATE':
      return {
        ...state,
        ...action.state
      };
      
    default:
      return state;
  }
}

/**
 * Hook for managing confirmation dialogs
 */
export function useConfirmDialog() {
  const [dialog, dispatch] = useReducer(dialogReducer, initialState);
  
  // Show a confirmation dialog with optional save current action
  const showConfirmation = useCallback((
    title: string,
    description: string,
    onConfirm: () => void,
    options?: {
      onSaveCurrent?: () => void;
      confirmText?: string;
      saveCurrentText?: string;
      cancelText?: string;
    }
  ) => {
    // First update state directly
    dispatch({ 
      type: 'SHOW_DIALOG', 
      title, 
      description, 
      onConfirm,
      onSaveCurrent: options?.onSaveCurrent,
      confirmText: options?.confirmText,
      saveCurrentText: options?.saveCurrentText,
      cancelText: options?.cancelText,
    });
    
    // Return a promise that resolves when confirmed
    return new Promise<void>((resolve) => {
      const originalOnConfirm = onConfirm;
      
      // Update again with the promise-aware onConfirm handler
      dispatch({ 
        type: 'SHOW_DIALOG', 
        title, 
        description,
        onConfirm: () => {
          originalOnConfirm();
          dispatch({ type: 'HIDE_DIALOG' });
          resolve();
        },
        onSaveCurrent: options?.onSaveCurrent,
        confirmText: options?.confirmText,
        saveCurrentText: options?.saveCurrentText,
        cancelText: options?.cancelText,
      });
    });
  }, []);
  
  // Show a three-option dialog (Cancel, Save Current, Continue)
  const showSaveOrReplaceDialog = useCallback((
    title: string,
    description: string,
    onContinue: () => void,
    onSaveCurrent: () => void,
    options?: {
      continueText?: string;
      saveCurrentText?: string;
      cancelText?: string;
    }
  ) => {
    return showConfirmation(
      title,
      description,
      onContinue,
      {
        onSaveCurrent,
        confirmText: options?.continueText || "Continue",
        saveCurrentText: options?.saveCurrentText || "Save Current",
        cancelText: options?.cancelText || "Cancel"
      }
    );
  }, [showConfirmation]);
  
  // Hide the confirmation dialog
  const hideConfirmation = useCallback(() => {
    dispatch({ type: 'HIDE_DIALOG' });
  }, []);
  
  // Set the dialog state directly
  const setDialogState = useCallback((newState: Partial<ConfirmDialogState>) => {
    dispatch({ type: 'SET_DIALOG_STATE', state: newState });
  }, []);
  
  return {
    dialog,
    showConfirmation,
    showSaveOrReplaceDialog,
    hideConfirmation,
    setDialogState
  };
}

export default useConfirmDialog; 