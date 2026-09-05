import React, { useState, useEffect } from 'react';
import { CheckCircle2, AlertTriangle, AlertCircle, Info, X } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface ToastMessage {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
  duration?: number;
}

type ToastListener = (toasts: ToastMessage[]) => void;

class ToastManager {
  private toasts: ToastMessage[] = [];
  private listeners: Set<ToastListener> = new Set();

  public subscribe(listener: ToastListener): () => void {
    this.listeners.add(listener);
    listener(this.toasts);
    return () => {
      this.listeners.delete(listener);
    };
  }

  public notify(): void {
    this.listeners.forEach((l) => l([...this.toasts]));
  }

  public show(type: ToastType, title: string, message?: string, duration = 4000): void {
    const id = `TOAST-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const toast: ToastMessage = { id, type, title, message, duration };
    this.toasts = [...this.toasts, toast];
    this.notify();

    if (duration > 0) {
      setTimeout(() => {
        this.dismiss(id);
      }, duration);
    }
  }

  public dismiss(id: string): void {
    this.toasts = this.toasts.filter((t) => t.id !== id);
    this.notify();
  }
}

export const toastManager = new ToastManager();

export const toast = {
  success: (title: string, message?: string) => toastManager.show('success', title, message),
  error: (title: string, message?: string) => toastManager.show('error', title, message),
  warning: (title: string, message?: string) => toastManager.show('warning', title, message),
  info: (title: string, message?: string) => toastManager.show('info', title, message),
};

export const ToastContainer: React.FC = () => {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  useEffect(() => {
    return toastManager.subscribe(setToasts);
  }, []);

  if (toasts.length === 0) return null;

  const icons = {
    success: <CheckCircle2 className="w-4 h-4 text-[#059669] shrink-0" />,
    error: <AlertCircle className="w-4 h-4 text-[#DC2626] shrink-0" />,
    warning: <AlertTriangle className="w-4 h-4 text-[#D97706] shrink-0" />,
    info: <Info className="w-4 h-4 text-[#2563EB] shrink-0" />,
  };

  const borderStyles = {
    success: 'border-[#A7F3D0] bg-white',
    error: 'border-[#FECACA] bg-white',
    warning: 'border-[#FDE68A] bg-white',
    info: 'border-[#BFDBFE] bg-white',
  };

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`pointer-events-auto flex items-start gap-2.5 p-3 rounded-md shadow-lg border ${borderStyles[t.type]} animate-in slide-in-from-bottom-2 duration-150`}
        >
          <div className="mt-0.5">{icons[t.type]}</div>
          <div className="flex-1 min-w-0">
            <h4 className="text-xs font-semibold text-[#1F2937]">{t.title}</h4>
            {t.message && <p className="text-xs text-[#4B5563] mt-0.5 leading-snug">{t.message}</p>}
          </div>
          <button
            onClick={() => toastManager.dismiss(t.id)}
            className="text-[#9CA3AF] hover:text-[#1F2937] p-0.5 rounded transition-colors shrink-0 cursor-pointer"
            aria-label="Close notification"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
};
