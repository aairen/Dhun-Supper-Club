import React from "react";
import { Modal } from "./Modal";
import { AlertTriangle, Info, CheckCircle2 } from "lucide-react";
import { cn } from "../lib/utils";

interface ConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (message?: string) => void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: "danger" | "info" | "success";
  isLoading?: boolean;
  showAdminMessage?: boolean;
}

export const ConfirmationModal: React.FC<ConfirmationModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = "Confirm",
  cancelText = "Cancel",
  variant = "info",
  isLoading = false,
  showAdminMessage = false,
}) => {
  const [adminMessage, setAdminMessage] = React.useState("");
  const variantStyles = {
    danger: {
      icon: <AlertTriangle className="h-5 w-5 text-red-600" />,
      bg: "bg-red-50",
      button: "bg-red-600 hover:bg-red-700",
    },
    info: {
      icon: <Info className="h-5 w-5 text-neutral-600" />,
      bg: "bg-neutral-50",
      button: "bg-neutral-900 hover:bg-neutral-800",
    },
    success: {
      icon: <CheckCircle2 className="h-5 w-5 text-green-600" />,
      bg: "bg-green-50",
      button: "bg-green-600 hover:bg-green-700",
    },
  };

  const currentVariant = variantStyles[variant];

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title}>
      <div className="space-y-6">
        <div className={cn("p-4 border flex items-start gap-3", 
          variant === "danger" ? "bg-red-50 border-red-100" : "bg-neutral-50 border-neutral-100"
        )}>
          {variant === "danger" ? (
            <AlertTriangle className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
          ) : (
            <Info className="h-5 w-5 text-neutral-600 shrink-0 mt-0.5" />
          )}
          <p className={cn("text-[10px] uppercase tracking-widest leading-relaxed",
            variant === "danger" ? "text-red-700" : "text-neutral-500"
          )}>
            Please review this action carefully. Actions taken here are final and may affect user credits.
          </p>
        </div>
        
        <p className="text-sm text-neutral-500 font-light leading-relaxed">
          {message}
        </p>
        
        {showAdminMessage && (
          <div className="space-y-2">
            <label className="text-[10px] font-bold uppercase tracking-widest text-neutral-400">Admin Message (Optional)</label>
            <textarea 
              value={adminMessage}
              onChange={e => setAdminMessage(e.target.value)}
              className="w-full bg-neutral-50 border border-neutral-200 px-4 py-3 text-sm focus:outline-none focus:border-neutral-900 transition-colors"
              placeholder="Add a message for the user..."
            />
          </div>
        )}
        
        <div className="pt-4 space-y-3">
          <button
            onClick={() => onConfirm(adminMessage)}
            disabled={isLoading}
            className={cn(
              "w-full text-white py-4 text-xs font-bold uppercase tracking-widest transition-all disabled:opacity-50",
              currentVariant.button
            )}
          >
            {isLoading ? "Processing..." : confirmText}
          </button>
          <button
            onClick={onClose}
            disabled={isLoading}
            className="w-full bg-white text-neutral-400 py-4 text-xs font-bold uppercase tracking-widest hover:text-neutral-600 transition-all border border-neutral-100"
          >
            {cancelText}
          </button>
        </div>
      </div>
    </Modal>
  );
};
