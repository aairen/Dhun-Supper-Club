import React from "react";
import { Modal } from "./Modal";
import { AlertTriangle, Info, CheckCircle2 } from "lucide-react";
import { cn } from "../lib/utils";

interface ConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: "danger" | "info" | "success";
  isLoading?: boolean;
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
}) => {
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
      <div className="flex flex-col">
        <div className={cn("mb-6 p-4 border border-neutral-100 flex items-center gap-3", currentVariant.bg)}>
          {currentVariant.icon}
          <p className="text-[10px] text-neutral-500 uppercase tracking-widest leading-relaxed">
            Please review this action carefully before proceeding.
          </p>
        </div>
        <p className="mb-10 text-sm md:text-base text-neutral-500 font-light leading-relaxed">
          {message}
        </p>
        <div className="flex flex-col gap-3">
          <button
            onClick={onConfirm}
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
