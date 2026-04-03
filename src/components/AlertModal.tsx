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
      <div className="flex flex-col">
        <div className={cn("mb-6 p-4 border border-neutral-100 flex items-center gap-3", currentVariant.bg)}>
          {currentVariant.icon}
          <p className="text-[10px] text-neutral-500 uppercase tracking-widest leading-relaxed">
            {variant === "error" ? "An error has occurred." : "Information update."}
          </p>
        </div>
        <p className="mb-10 text-sm md:text-base text-neutral-500 font-light leading-relaxed">
          {message}
        </p>
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
    </Modal>
  );
};
