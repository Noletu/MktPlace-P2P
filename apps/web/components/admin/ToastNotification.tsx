'use client';

import { useEffect } from 'react';

export interface Toast {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  message: string;
  duration?: number;
}

interface ToastNotificationProps {
  toast: Toast;
  onRemove: (id: string) => void;
}

export default function ToastNotification({ toast, onRemove }: ToastNotificationProps) {
  useEffect(() => {
    const timer = setTimeout(() => {
      onRemove(toast.id);
    }, toast.duration || 5000);

    return () => clearTimeout(timer);
  }, [toast.id, toast.duration, onRemove]);

  const icons = {
    success: '✅',
    error: '❌',
    warning: '⚠️',
    info: 'ℹ️',
  };

  const colors = {
    success: 'bg-green-900/90 border-green-500',
    error: 'bg-red-900/90 border-red-500',
    warning: 'bg-yellow-900/90 border-yellow-500',
    info: 'bg-blue-900/90 border-blue-500',
  };

  return (
    <div
      className={`${colors[toast.type]} border rounded-lg p-4 shadow-lg backdrop-blur-sm animate-slide-in-right min-w-[320px] max-w-md`}
    >
      <div className="flex items-start gap-3">
        <span className="text-2xl">{icons[toast.type]}</span>
        <div className="flex-1">
          <p className="text-white font-medium">{toast.message}</p>
        </div>
        <button
          onClick={() => onRemove(toast.id)}
          className="text-gray-400 hover:text-white transition ml-2"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
