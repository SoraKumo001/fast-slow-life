import { X } from "lucide-react";
import React, { useState, useEffect, useRef } from "react";

export interface DraggableWindowProps {
  onClose: () => void;
  title: React.ReactNode;
  children: React.ReactNode;
  initialX?: number;
  initialY?: number;
  widthClass?: string;
  maxHeightClass?: string;
}

export const DraggableWindow: React.FC<DraggableWindowProps> = ({
  onClose,
  title,
  children,
  initialX,
  initialY = 120,
  widthClass = "w-[90vw] md:w-[576px]",
  maxHeightClass = "max-h-[75vh]",
}) => {
  const [windowPos, setWindowPos] = useState({ x: 0, y: initialY });
  const [isDragging, setIsDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const defaultX = Math.max(20, window.innerWidth / 2 - 288);
    setWindowPos({ x: initialX !== undefined ? initialX : defaultX, y: initialY });
  }, [initialX, initialY]);

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      setWindowPos({
        x: e.clientX - dragStart.current.x,
        y: e.clientY - dragStart.current.y,
      });
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDragging]);

  const handleHeaderMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (
      (e.target as HTMLElement).closest("button") ||
      (e.target as HTMLElement).closest("select") ||
      (e.target as HTMLElement).closest("input")
    ) {
      return;
    }
    setIsDragging(true);
    dragStart.current = {
      x: e.clientX - windowPos.x,
      y: e.clientY - windowPos.y,
    };
  };

  return (
    <div
      style={{
        left: `${windowPos.x}px`,
        top: `${windowPos.y}px`,
      }}
      className={`fixed z-50 bg-slate-900 border border-slate-800 rounded-xl p-5 flex flex-col shadow-2xl select-none ${widthClass} ${maxHeightClass}`}
    >
      {/* ドラッグ可能なヘッダー */}
      <div
        onMouseDown={handleHeaderMouseDown}
        className="flex justify-between items-center border-b border-slate-800 pb-3 cursor-move active:cursor-grabbing"
      >
        <div className="pointer-events-none select-none">
          {typeof title === "string" ? (
            <h3 className="text-sm font-bold text-slate-200 uppercase tracking-wider">{title}</h3>
          ) : (
            title
          )}
        </div>
        <button
          onClick={onClose}
          className="text-slate-500 hover:text-slate-300 transition cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {children}
    </div>
  );
};
