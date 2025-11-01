'use client';

import { useRouter } from 'next/navigation';

export default function FloatingActionButton() {
  const router = useRouter();

  const handleCreateOrder = () => {
    router.push('/orders/create');
  };

  return (
    <button
      onClick={handleCreateOrder}
      className="fixed bottom-6 right-6 z-50 w-16 h-16 bg-blue-600 hover:bg-blue-700 text-white rounded-full shadow-lg hover:shadow-xl transition-all duration-200 flex items-center justify-center group"
      title="Criar Novo Pedido"
    >
      <span className="text-3xl group-hover:scale-110 transition-transform">+</span>

      {/* Tooltip */}
      <div className="absolute bottom-20 right-0 bg-gray-900 text-white text-sm px-3 py-2 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
        Criar Novo Pedido
        <div className="absolute -bottom-1 right-6 w-2 h-2 bg-gray-900 transform rotate-45"></div>
      </div>
    </button>
  );
}
