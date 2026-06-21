import { X } from "lucide-react";
import React, { useEffect } from "react";

export interface ModalProps {
  isOpen?: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  size?: "sm" | "md" | "lg" | "xl" | "max";
  children: React.ReactNode;
  showCloseButton?: boolean;
  className?: string;
}

export const Modal: React.FC<ModalProps> = ({
  isOpen = true,
  onClose,
  title,
  size = "md",
  children,
  showCloseButton = false,
  className = "",
}) => {
  // ESCキーで閉じる処理
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    if (isOpen) {
      window.addEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "hidden";
    }
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const sizeStyles: Record<string, string> = {
    sm: "max-w-sm",
    md: "max-w-md",
    lg: "max-w-2xl",
    xl: "max-w-4xl",
    max: "max-w-full",
  };

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4 cursor-pointer"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={`bg-slate-900 border border-slate-800 rounded-xl w-full p-6 cursor-default relative shadow-2xl ${sizeStyles[size]} ${className} transition-all duration-200`}
      >
        {showCloseButton && (
          <button
            onClick={onClose}
            className="absolute top-2.5 right-2.5 z-10 p-2 text-slate-500 hover:text-slate-300 hover:bg-slate-800/40 rounded-lg transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        )}

        {title && (
          <div className="border-b border-slate-850 pb-3 mb-4">
            {typeof title === "string" ? (
              <h3 className="text-lg font-bold text-slate-100">{title}</h3>
            ) : (
              title
            )}
          </div>
        )}

        {children}
      </div>
    </div>
  );
};
