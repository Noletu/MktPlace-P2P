'use client';

import { useState } from 'react';

export type TransactionType = 'ALL' | 'DEPOSIT' | 'WITHDRAWAL' | 'LOCK' | 'UNLOCK' | 'DEDUCT' | 'CREDIT' | 'REFUND' | 'ADMIN_CREDIT' | 'ADMIN_DEBIT' | 'ADMIN_LOCK' | 'ADMIN_UNLOCK' | 'ADMIN_ADJUSTMENT' | 'PLATFORM_FEE';

interface TransactionTypeFilterProps {
  selectedType: TransactionType;
  onTypeChange: (type: TransactionType) => void;
}

const TYPE_OPTIONS: Array<{ value: TransactionType; label: string; icon: string }> = [
  { value: 'ALL', label: 'Todos os Tipos', icon: '💰' },
  { value: 'DEPOSIT', label: 'Depósitos', icon: '📥' },
  { value: 'WITHDRAWAL', label: 'Saques', icon: '📤' },
  { value: 'LOCK', label: 'Bloqueios', icon: '🔒' },
  { value: 'UNLOCK', label: 'Desbloqueios', icon: '🔓' },
  { value: 'DEDUCT', label: 'Deduções', icon: '💸' },
  { value: 'CREDIT', label: 'Créditos', icon: '💳' },
  { value: 'REFUND', label: 'Reembolsos', icon: '↩️' },
  { value: 'ADMIN_CREDIT', label: 'Créditos Admin', icon: '🏦' },
  { value: 'ADMIN_DEBIT', label: 'Débitos Admin', icon: '🏦' },
  { value: 'ADMIN_LOCK', label: 'Bloqueios Admin', icon: '🔐' },
  { value: 'ADMIN_UNLOCK', label: 'Desbloqueios Admin', icon: '🔑' },
  { value: 'ADMIN_ADJUSTMENT', label: 'Ajustes Admin', icon: '⚙️' },
  { value: 'PLATFORM_FEE', label: 'Taxas da Plataforma', icon: '🏷️' },
];

export default function TransactionTypeFilter({
  selectedType,
  onTypeChange,
}: TransactionTypeFilterProps) {
  const [isOpen, setIsOpen] = useState(false);

  const selectedOption = TYPE_OPTIONS.find(opt => opt.value === selectedType) || TYPE_OPTIONS[0];

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="px-4 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors flex items-center gap-2 min-w-[180px]"
      >
        <span className="text-lg">{selectedOption.icon}</span>
        <span className="flex-1 text-left text-sm">{selectedOption.label}</span>
        <svg
          className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-10"
            onClick={() => setIsOpen(false)}
          />

          {/* Dropdown Menu */}
          <div className="absolute left-0 mt-2 w-full bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 z-20 overflow-hidden">
            {TYPE_OPTIONS.map((option) => (
              <button
                key={option.value}
                onClick={() => {
                  onTypeChange(option.value);
                  setIsOpen(false);
                }}
                className={`w-full px-4 py-3 text-left hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors flex items-center gap-3 ${
                  selectedType === option.value
                    ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 font-semibold'
                    : ''
                }`}
              >
                <span className="text-lg">{option.icon}</span>
                <span className="flex-1 text-sm">{option.label}</span>
                {selectedType === option.value && <span className="text-blue-600">✓</span>}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
