'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function FloatingActionButton() {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);

  const actions = [
    {
      label: 'Criar Pedido',
      icon: '🛒',
      onClick: () => router.push('/orders/create'),
      color: 'bg-green-600 hover:bg-green-700',
    },
    {
      label: 'Ver Marketplace',
      icon: '🏪',
      onClick: () => router.push('/marketplace'),
      color: 'bg-blue-600 hover:bg-blue-700',
    },
    {
      label: 'Adicionar Colateral',
      icon: '💰',
      onClick: () => router.push('/collateral-balance'),
      color: 'bg-yellow-600 hover:bg-yellow-700',
    },
  ];

  return (
    <>
      {/* Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40 transition-opacity"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* FAB Container */}
      <div className="fixed bottom-6 right-6 z-50">
        {/* Action Menu */}
        <div
          className={`absolute bottom-20 right-0 flex flex-col gap-3 transition-all duration-300 ${
            isOpen ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 pointer-events-none'
          }`}
        >
          {actions.map((action, index) => (
            <button
              key={index}
              onClick={() => {
                action.onClick();
                setIsOpen(false);
              }}
              className={`${action.color} text-white px-4 py-3 rounded-full shadow-lg flex items-center gap-2 font-semibold whitespace-nowrap transition-all transform hover:scale-105`}
              style={{
                transitionDelay: isOpen ? `${index * 50}ms` : '0ms',
              }}
            >
              <span className="text-xl">{action.icon}</span>
              <span>{action.label}</span>
            </button>
          ))}
        </div>

        {/* Main FAB */}
        <button
          onClick={() => setIsOpen(!isOpen)}
          className={`w-16 h-16 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-full shadow-2xl flex items-center justify-center transition-all transform hover:scale-110 ${
            isOpen ? 'rotate-45' : 'rotate-0'
          }`}
        >
          <span className="text-3xl font-bold">+</span>
        </button>
      </div>
    </>
  );
}
