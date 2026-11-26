import React, { createContext, useContext, useState, useCallback } from 'react';

export type ToastType = 'success' | 'error' | 'info';

export interface ToastOptions {
  message: string;
  type?: ToastType;
  duration?: number;
  position?: 'top' | 'bottom';
}

interface ToastContextData {
  showToast: (options: ToastOptions) => void;
  hideToast: () => void;
  toastConfig: ToastOptions | null;
  isVisible: boolean;
}

const ToastContext = createContext<ToastContextData>({} as ToastContextData);

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isVisible, setIsVisible] = useState(false);
  const [toastConfig, setToastConfig] = useState<ToastOptions | null>(null);

  const hideToast = useCallback(() => {
    setIsVisible(false);
  }, []);

  const showToast = useCallback(({ message, type = 'info', duration = 3000, position = 'top' }: ToastOptions) => {
    setToastConfig({ message, type, duration, position });
    setIsVisible(true);
    
    if (duration > 0) {
      setTimeout(() => {
        setIsVisible(false);
      }, duration);
    }
  }, []);

  return (
    <ToastContext.Provider value={{ showToast, hideToast, toastConfig, isVisible }}>
      {children}
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};
