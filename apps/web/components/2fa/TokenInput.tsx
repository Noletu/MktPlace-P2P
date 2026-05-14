'use client';

import { forwardRef } from 'react';

interface TokenInputProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit?: () => void;
  disabled?: boolean;
  error?: boolean;
  placeholder?: string;
  autoFocus?: boolean;
  className?: string;
}

/**
 * Input especializado para códigos 2FA de 6 dígitos
 * - Auto-formata (apenas números)
 * - Limite de 6 caracteres
 * - Enter para submeter
 * - Estilo monoespaçado
 */
const TokenInput = forwardRef<HTMLInputElement, TokenInputProps>(
  (
    {
      value,
      onChange,
      onSubmit,
      disabled = false,
      error = false,
      placeholder = '000000',
      autoFocus = false,
      className = '',
    },
    ref
  ) => {
    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      // Apenas números, máximo 6 dígitos
      const newValue = e.target.value.replace(/\D/g, '').slice(0, 6);
      onChange(newValue);
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter' && onSubmit && value.length === 6) {
        e.preventDefault();
        onSubmit();
      }
    };

    const baseClasses =
      'w-full px-4 py-3 text-center text-2xl tracking-widest border rounded-lg font-mono transition-colors';
    const stateClasses = error
      ? 'border-red-500 dark:border-red-600 focus:ring-red-500 dark:focus:ring-red-600'
      : 'border-gray-300 dark:border-gray-600 focus:ring-blue-500 dark:focus:ring-blue-600';
    const themeClasses =
      'bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500';
    const disabledClasses = disabled ? 'opacity-50 cursor-not-allowed' : '';

    return (
      <input
        ref={ref}
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        maxLength={6}
        disabled={disabled}
        autoFocus={autoFocus}
        autoComplete="off"
        className={`${baseClasses} ${stateClasses} ${themeClasses} ${disabledClasses} focus:outline-none focus:ring-2 ${className}`}
      />
    );
  }
);

TokenInput.displayName = 'TokenInput';

export default TokenInput;
