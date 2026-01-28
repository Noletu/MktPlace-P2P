'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { DisputeCategory, CATEGORY_LABELS } from '@/types/dispute';

interface Order {
  id: string;
  orderType: string; // 'SELL' or 'BUY'
  type: string; // Payment method: 'PIX' or 'BOLETO'
  status: string;
  brlAmount: string;
  cryptoAmount: string;
  cryptoType: string;
  userId: string;
  paymentMethod?: string;
  user?: {
    id: string;
    name: string;
  };
  transactions?: Array<{
    payerId: string;
    payer?: {
      id: string;
      name: string;
    };
  }>;
}

export default function NewDisputePage() {
  const params = useParams();
  const router = useRouter();
  const orderId = params.orderId as string;

  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [currentUserId, setCurrentUserId] = useState('');

  // Form fields
  const [category, setCategory] = useState<DisputeCategory | ''>('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [attachments, setAttachments] = useState<File[]>([]);

  useEffect(() => {
    fetchOrder();
    fetchCurrentUser();
  }, [orderId]);

  const fetchOrder = async () => {
    try {
      const token = localStorage.getItem('accessToken');
      if (!token) {
        router.push('/login');
        return;
      }

      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001/api/v1"}/orders/${orderId}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      const data = await res.json();
      if (data.success) {
        setOrder(data.data);
      } else {
        alert('Pedido não encontrado');
        router.push('/orders');
      }
    } catch (error) {
      console.error('Erro ao carregar pedido:', error);
      alert('Erro ao carregar pedido');
    } finally {
      setLoading(false);
    }
  };

  const fetchCurrentUser = async () => {
    try {
      const token = localStorage.getItem('accessToken');
      if (!token) return;

      const res = await fetch('http://localhost:3001/api/v1/auth/me', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      const data = await res.json();
      if (data.success) {
        setCurrentUserId(data.data.id);
      }
    } catch (error) {
      console.error('Erro ao buscar usuário:', error);
    }
  };

  const getBuyerCategories = (): DisputeCategory[] => {
    return [
      DisputeCategory.PAYMENT_SENT_NOT_CONFIRMED,
      DisputeCategory.CRYPTO_NOT_RELEASED,
      DisputeCategory.WRONG_AMOUNT,
      DisputeCategory.OTHER,
    ];
  };

  const getSellerCategories = (): DisputeCategory[] => {
    return [
      DisputeCategory.PAYMENT_NOT_RECEIVED,
      DisputeCategory.FAKE_RECEIPT,
      DisputeCategory.WRONG_AMOUNT,
      DisputeCategory.WRONG_RECIPIENT,
      DisputeCategory.OTHER,
    ];
  };

  const getAvailableCategories = (): DisputeCategory[] => {
    if (!order || !currentUserId) return [];

    // If user is the order owner (buyer for BUY orders, seller for SELL orders)
    const isOrderOwner = order.userId === currentUserId;

    if (order.orderType === 'BUY') {
      return isOrderOwner ? getBuyerCategories() : getSellerCategories();
    } else {
      return isOrderOwner ? getSellerCategories() : getBuyerCategories();
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files);
      setAttachments([...attachments, ...newFiles]);
    }
  };

  const removeFile = (index: number) => {
    setAttachments(attachments.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!category) {
      alert('Selecione uma categoria');
      return;
    }

    if (!title.trim()) {
      alert('Digite um título para a disputa');
      return;
    }

    if (title.trim().length < 10) {
      alert('O título deve ter pelo menos 10 caracteres');
      return;
    }

    if (description.length < 50) {
      alert('A descrição deve ter pelo menos 50 caracteres');
      return;
    }

    setSubmitting(true);

    try {
      const token = localStorage.getItem('accessToken');
      if (!token) {
        alert('Você precisa estar logado');
        router.push('/login');
        return;
      }

      // Convert files to base64
      const attachmentPromises = attachments.map((file) => {
        return new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });
      });

      const attachmentData = await Promise.all(attachmentPromises);

      const res = await fetch('http://localhost:3001/api/v1/disputes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          orderId,
          category,
          title,
          description,
          attachments: attachmentData,
        }),
      });

      const data = await res.json();

      if (data.success) {
        alert('Disputa aberta com sucesso!');
        router.push(`/disputes/${data.data.id}`);
      } else {
        alert(data.message || 'Erro ao abrir disputa');
      }
    } catch (error) {
      console.error('Erro ao abrir disputa:', error);
      alert('Erro ao abrir disputa');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">Carregando...</div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">Pedido não encontrado</div>
      </div>
    );
  }

  const availableCategories = getAvailableCategories();

  return (
    <div className="container mx-auto px-4 py-8 max-w-3xl">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
          Abrir Disputa
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          Descreva o problema que você está enfrentando com esta transação
        </p>
      </div>

      {/* Order Info */}
      <div className="bg-blue-50 dark:bg-blue-900 border border-blue-200 dark:border-blue-700 rounded-lg p-4 mb-6">
        <h3 className="text-sm font-semibold text-blue-800 dark:text-blue-200 mb-3">
          📦 Informações do Pedido
        </h3>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <span className="text-blue-700 dark:text-blue-300">ID:</span>
            <span className="ml-2 font-mono text-blue-900 dark:text-blue-100">
              #{order.id.substring(0, 8)}
            </span>
          </div>
          <div>
            <span className="text-blue-700 dark:text-blue-300">Tipo:</span>
            <span className="ml-2 font-semibold text-blue-900 dark:text-blue-100">
              {order.orderType === 'BUY' ? 'Compra' : 'Venda'}
            </span>
          </div>
          <div>
            <span className="text-blue-700 dark:text-blue-300">Valor:</span>
            <span className="ml-2 font-semibold text-blue-900 dark:text-blue-100">
              R$ {parseFloat(order.brlAmount).toFixed(2)}
            </span>
          </div>
          <div>
            <span className="text-blue-700 dark:text-blue-300">Cripto:</span>
            <span className="ml-2 font-semibold text-blue-900 dark:text-blue-100">
              {order.cryptoAmount} {order.cryptoType}
            </span>
          </div>
          <div>
            <span className="text-blue-700 dark:text-blue-300">Método:</span>
            <span className="ml-2 font-semibold text-blue-900 dark:text-blue-100">
              {order.paymentMethod || 'PIX'}
            </span>
          </div>
          <div>
            <span className="text-blue-700 dark:text-blue-300">Criador:</span>
            <span className="ml-2 font-semibold text-blue-900 dark:text-blue-100">
              {order.user?.name || 'Carregando...'}
            </span>
          </div>
          {order.transactions && order.transactions.length > 0 && order.transactions[0].payer && (
            <div className="col-span-2">
              <span className="text-blue-700 dark:text-blue-300">Comprador:</span>
              <span className="ml-2 font-semibold text-blue-900 dark:text-blue-100">
                {order.transactions[0].payer.name}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Warning */}
      <div className="bg-yellow-50 dark:bg-yellow-900 border border-yellow-200 dark:border-yellow-700 rounded-lg p-4 mb-6">
        <h3 className="text-sm font-semibold text-yellow-800 dark:text-yellow-200 mb-2">
          ⚠️ Antes de abrir uma disputa
        </h3>
        <ul className="text-sm text-yellow-700 dark:text-yellow-300 space-y-1">
          <li>• Certifique-se de ter tentado contato com a outra parte</li>
          <li>• Tenha em mãos todos os comprovantes e evidências</li>
          <li>• A descrição deve ser clara e detalhada (mínimo 50 caracteres)</li>
          <li>• Você terá 24h para responder caso a outra parte conteste</li>
        </ul>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        {/* Category */}
        <div className="mb-6">
          <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
            Categoria da Disputa *
          </label>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value as DisputeCategory)}
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
            required
          >
            <option value="">Selecione uma categoria</option>
            {availableCategories.map((cat) => (
              <option key={cat} value={cat}>
                {CATEGORY_LABELS[cat]}
              </option>
            ))}
          </select>
        </div>

        {/* Title */}
        <div className="mb-6">
          <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
            Título da Disputa *
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Ex: Vendedor não confirmou recebimento do PIX"
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
            required
          />
          <div className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {title.length} / 10 caracteres mínimos
          </div>
        </div>

        {/* Description */}
        <div className="mb-6">
          <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
            Descrição Detalhada * (mínimo 50 caracteres)
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Descreva em detalhes o que aconteceu, incluindo datas, horários e todas as informações relevantes..."
            className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white resize-none"
            rows={8}
            required
          />
          <div className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {description.length} / 50 caracteres mínimos
          </div>
        </div>

        {/* File Upload */}
        <div className="mb-6">
          <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
            Anexos (Comprovantes, Prints, etc.)
          </label>
          <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-6">
            <input
              type="file"
              id="file-upload"
              multiple
              accept="image/*,.pdf"
              onChange={handleFileChange}
              className="hidden"
            />
            <label
              htmlFor="file-upload"
              className="flex flex-col items-center justify-center cursor-pointer"
            >
              <div className="text-4xl mb-2">📎</div>
              <p className="text-sm text-gray-600 dark:text-gray-400 text-center">
                Clique para adicionar arquivos
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                Imagens ou PDFs (máx. 5MB cada)
              </p>
            </label>

            {/* Lista de arquivos selecionados */}
            {attachments.length > 0 && (
              <div className="mt-4 space-y-2">
                {attachments.map((file, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between bg-gray-100 dark:bg-gray-700 rounded px-3 py-2"
                  >
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <span className="text-lg">
                        {file.type.startsWith('image/') ? '🖼️' : '📄'}
                      </span>
                      <span className="text-sm text-gray-700 dark:text-gray-300 truncate">
                        {file.name}
                      </span>
                      <span className="text-xs text-gray-500">
                        ({(file.size / 1024).toFixed(1)} KB)
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeFile(index)}
                      className="text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300 ml-2"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-4">
          <button
            type="button"
            onClick={() => router.back()}
            className="flex-1 px-6 py-3 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
            disabled={submitting}
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={submitting || description.length < 50 || title.trim().length < 10}
            className="flex-1 px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? 'Abrindo...' : 'Abrir Disputa'}
          </button>
        </div>
      </form>

      {/* Help Text */}
      <div className="mt-6 text-sm text-gray-600 dark:text-gray-400 text-center">
        Ao abrir uma disputa, a outra parte será notificada e terá 24h para responder.
        Nossa equipe analisará o caso e tomará uma decisão justa.
      </div>
    </div>
  );
}
