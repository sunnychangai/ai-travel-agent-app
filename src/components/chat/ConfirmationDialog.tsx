import React from 'react';
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogFooter, 
  DialogHeader, 
  DialogTitle 
} from '../ui/dialog';
import { Button } from '../ui/button';

type ConfirmationDialogProps = {
  open: boolean;
  title: string;
  description: string;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  onSaveCurrent?: () => void; // Optional save current action
  confirmText?: string; // Optional custom text for confirm button
  saveCurrentText?: string; // Optional custom text for save current button
  cancelText?: string; // Optional custom text for cancel button
};

/**
 * A reusable confirmation dialog component with optional "Save Current" action
 */
const ConfirmationDialog = React.memo(({
  open,
  title,
  description,
  onOpenChange,
  onConfirm,
  onSaveCurrent,
  confirmText = "Continue",
  saveCurrentText = "Save Current",
  cancelText = "Cancel"
}: ConfirmationDialogProps) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <DialogFooter className="flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {cancelText}
          </Button>
          {onSaveCurrent && (
            <Button 
              variant="secondary" 
              onClick={() => {
                onSaveCurrent();
                onOpenChange(false);
              }}
              className="bg-blue-500 hover:bg-blue-600 text-white border-blue-500"
            >
              {saveCurrentText}
            </Button>
          )}
          <Button onClick={onConfirm}>
            {confirmText}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
});

ConfirmationDialog.displayName = 'ConfirmationDialog';

export default ConfirmationDialog; 