import React, { useEffect } from "react";
import { X } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { cn } from "../lib/utils";

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  className?: string;
}

export const Modal: React.FC<ModalProps> = ({ isOpen, onClose, title, children, className }) => {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }
    return () => {
      document.body.style.overflow = "unset";
    };
  }, [isOpen]);

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className={cn(
                "relative w-full max-w-md overflow-hidden bg-white shadow-2xl border border-neutral-200 p-6 md:p-8",
                className
              )}
            >
              <div className="flex items-center justify-between mb-6">
                {title && (
                  <h3 className="text-xl font-serif text-neutral-900 uppercase tracking-widest">
                    {title}
                  </h3>
                )}
                <button
                  onClick={onClose}
                  className="ml-auto p-1 text-neutral-400 hover:text-neutral-600 transition-colors"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="relative">{children}</div>
            </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
