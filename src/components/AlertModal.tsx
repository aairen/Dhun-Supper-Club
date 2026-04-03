import React from "react";
import { Modal } from "./Modal";
import { AlertCircle, CheckCircle2, Info } from "lucide-react";
import { cn } from "../lib/utils";

interface AlertModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  message: string;
  variant?: "error" | "info" | "success";
}

export const AlertModal: React.FC<AlertModalProps> = ({
  isOpen,
  onClose,
  title,
  message,
  variant = "info",
}) => {
  const variantStyles = {
    error: {
      icon: <AlertCircle className="h-5 w-5 text-red-600" />,
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
          variant === "error" ? "bg-red-50 border-red-100" : "bg-neutral-50 border-neutral-100"
        )}>
          {variant === "error" ? (
            <AlertCircle className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
          ) : (
            <Info className="h-5 w-5 text-neutral-600 shrink-0 mt-0.5" />
          )}
          <p className={cn("text-[10px] uppercase tracking-widest leading-relaxed",
            variant === "error" ? "text-red-700" : "text-neutral-500"
          )}>
            {variant === "error" ? "System Error Notification" : "Information Update"}
          </p>
        </div>
        
        <p className="text-sm text-neutral-500 font-light leading-relaxed">
          {message}
        </p>
        
        <div className="pt-4">
          <button
            onClick={onClose}
            className={cn(
              "w-full text-white py-4 text-xs font-bold uppercase tracking-widest transition-all",
              currentVariant.button
            )}
          >
            Close
          </button>
        </div>
      </div>
    </Modal>
  );
};
