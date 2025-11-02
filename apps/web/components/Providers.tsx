'use client';

import { ThemeProvider } from '@/contexts/ThemeContext';
import { NotificationProvider } from '@/providers/NotificationProvider';
import { ToastProvider } from '@/hooks/useToast';
import Header from './Header';

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <ToastProvider>
        <NotificationProvider>
          <>
            <Header />
            {children}
          </>
        </NotificationProvider>
      </ToastProvider>
    </ThemeProvider>
  );
}
