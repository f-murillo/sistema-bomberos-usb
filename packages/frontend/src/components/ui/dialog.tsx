import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { Button } from './button';

interface DialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: React.ReactNode;
}

const Dialog = ({ open, onOpenChange, title, description, children }: DialogProps) => {
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onOpenChange(false);
    };
    if (open) {
      document.body.style.overflow = 'hidden';
      window.addEventListener('keydown', handleEscape);
    }
    return () => {
      document.body.style.overflow = 'unset';
      window.removeEventListener('keydown', handleEscape);
    };
  }, [open, onOpenChange]);

  if (!open) return null;

  const modalRoot = document.body;

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        ref={dialogRef}
        className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200"
      >
        <div className="p-6 border-b flex justify-between items-center">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">{title}</h2>
            {description && <p className="text-sm text-slate-500 mt-1">{description}</p>}
          </div>
          <Button variant="ghost" size="icon" onClick={() => onOpenChange(false)} className="rounded-full">
            <X size={20} />
          </Button>
        </div>
        <div className="p-6">
          {children}
        </div>
      </div>
    </div>,
    modalRoot
  );
};

export { Dialog };