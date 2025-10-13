'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import ChatWindow from '@/components/chat/ChatWindow';

interface Order {
  id: string;
  type: string;
  status: string;
  cryptoType: string;
  cryptoNetwork: string;
  cryptoAmount: string;
  brlAmount: string;
  platformFee: string;
  payerReward: string;
  totalFee: string;
  orderData: string;
  createdAt: string;
  timeoutAt: string;
  user: {
    id: true;
    name: string;
    email: string;
    reputationScore: number;
  };
  transactions: Transaction[];
}

interface Transaction {
  id: string;
  status: string;
  comprovanteUrl?: string;
  comprovanteData?: string;
  validationScore?: number;
  validatedAt?: string;
  payer: {
    id: string;
    name: string;
    email: string;
  };
}

export default function OrderDetailsPage() {
  const router = useRouter();
  const params = useParams();
  const orderId = params.orderId as string;

  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [uploadingProof, setUploadingProof] = useState(false);
  const [proofImage, setProofImage] = useState<string>('');
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [confirmingReceived, setConfirmingReceived] = useState(false);
  const [showPaymentConfirmModal, setShowPaymentConfirmModal] = useState(false);
  const [confirmingPayment, setConfirmingPayment] = useState(false);

  useEffect(() => {
    fetchOrder();
    const interval = setInterval(fetchOrder, 5000); // Atualizar a cada 5s
    return () => clearInterval(interval);
  }, [orderId]);

  const fetchOrder = async () => {
    try {
      const token = localStorage.getItem('accessToken');
      if (!token) {
        router.push('/login');
        return;
      }

      const response = await fetch(`http://localhost:3001/api/v1/orders/${orderId}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Erro ao buscar pedido');
      }

      const data = await response.json();
      setOrder(data.data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      setProofImage(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleSubmitProof = async () => {
    if (!proofImage) {
      alert('Por favor, selecione uma imagem do comprovante');
      return;
    }

    setUploadingProof(true);
    setError('');

    try {
      const transaction = order?.transactions[0];

      if (!transaction) {
        throw new Error('Transação não encontrada');
      }

      const token = localStorage.getItem('accessToken');
      if (!token) {
        throw new Error('Você precisa estar logado');
      }

      const response = await fetch('http://localhost:3001/api/v1/transactions/submit-proof', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          transactionId: transaction.id,
          comprovanteData: proofImage,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Erro ao enviar comprovante');
      }

      alert('Comprovante enviado com sucesso! Aguardando validação...');
      setProofImage('');
      await fetchOrder();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setUploadingProof(false);
    }
  };

  const handleDispute = async () => {
    const reason = prompt('Digite o motivo da disputa:');
    if (!reason) return;

    try {
      const token = localStorage.getItem('accessToken');
      if (!token) {
        alert('Você precisa estar logado');
        return;
      }

      const transaction = order?.transactions[0];

      const response = await fetch(
        `http://localhost:3001/api/v1/transactions/${transaction?.id}/dispute`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify({ reason }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Erro ao criar disputa');
      }

      alert('Disputa criada! Nossa equipe irá analisar o caso.');
      await fetchOrder();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleConfirmPaymentReceived = async () => {
    if (!confirm('Você confirma que recebeu o pagamento? Esta ação liberará a criptomoeda para o comprador.')) {
      return;
    }

    setConfirmingReceived(true);
    setError('');

    try {
      const token = localStorage.getItem('accessToken');
      if (!token) {
        throw new Error('Você precisa estar logado');
      }

      const transaction = order?.transactions[0];
      if (!transaction) {
        throw new Error('Transação não encontrada');
      }

      const response = await fetch(`http://localhost:3001/api/v1/transactions/${transaction.id}/confirm-received`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Erro ao confirmar recebimento');
      }

      alert('✅ Pagamento confirmado! A criptomoeda foi liberada.');
      await fetchOrder();
    } catch (err: any) {
      setError(err.message);
      alert(err.message);
    } finally {
      setConfirmingReceived(false);
    }
  };

  const handleConfirmPaymentMade = async () => {
    setConfirmingPayment(true);
    setError('');
    setShowPaymentConfirmModal(false);

    try {
      const token = localStorage.getItem('accessToken');
      if (!token) {
        throw new Error('Você precisa estar logado');
      }

      const transaction = order?.transactions[0];
      if (!transaction) {
        throw new Error('Transação não encontrada');
      }

      const response = await fetch(`http://localhost:3001/api/v1/transactions/${transaction.id}/confirm-payment-made`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Erro ao confirmar pagamento');
      }

      alert('✅ Pagamento confirmado! Agora você pode enviar o comprovante.');
      await fetchOrder();
    } catch (err: any) {
      setError(err.message);
      alert(err.message);
    } finally {
      setConfirmingPayment(false);
    }
  };

  const handleCancelOrder = async () => {
    setCancelling(true);
    setError('');

    try {
      const token = localStorage.getItem('accessToken');
      if (!token) {
        throw new Error('Você precisa estar logado');
      }

      const response = await fetch(`http://localhost:3001/api/v1/orders/${orderId}/cancel`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Erro ao cancelar pedido');
      }

      alert('Pedido cancelado com sucesso!');
      setShowCancelModal(false);
      await fetchOrder();
      router.push('/orders/my-orders');
    } catch (err: any) {
      setError(err.message);
      alert(err.message);
    } finally {
      setCancelling(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-xl">Carregando...</div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-xl">Pedido não encontrado</div>
      </div>
    );
  }

  const orderData = JSON.parse(order.orderData);
  const transaction = order.transactions[0];

  // Detectar método de pagamento a partir do orderData
  const paymentMethod = orderData.pixKey ? 'PIX' : 'BOLETO';

  // Obter userId do objeto user armazenado no localStorage
  const userStr = localStorage.getItem('user');
  const currentUserId = userStr ? JSON.parse(userStr).id : null;

  const isCreator = order.user.id === currentUserId;
  const isPayer = transaction?.payer?.id === currentUserId;

  // Debug: mostrar informações no console
  console.log('🔍 Debug Order Details:', {
    orderId: order.id,
    orderStatus: order.status,
    orderUserId: order.user.id,
    currentUserId,
    isCreator,
    canCancel: isCreator && (order.status === 'PENDING' || order.status === 'MATCHED'),
  });

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      PENDING: 'bg-yellow-100 text-yellow-800',
      MATCHED: 'bg-blue-100 text-blue-800',
      PAYMENT_SENT: 'bg-purple-100 text-purple-800',
      VALIDATING: 'bg-orange-100 text-orange-800',
      COMPLETED: 'bg-green-100 text-green-800',
      DISPUTED: 'bg-red-100 text-red-800',
      CANCELLED: 'bg-gray-100 text-gray-800',
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      {/* Modal de Cancelamento */}
      {showCancelModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-lg w-full p-6">
            <h3 className="text-xl font-bold mb-4 text-red-600">⚠️ Cancelar Pedido</h3>

            <div className="space-y-4 mb-6">
              <p className="text-gray-700 font-semibold">
                Você tem certeza que deseja cancelar este pedido?
              </p>

              <div className="bg-red-50 border-2 border-red-300 rounded-lg p-4">
                <h4 className="font-bold text-red-800 mb-3 flex items-center gap-2">
                  <span className="text-2xl">💰</span>
                  IMPORTANTE - Devolução do Colateral
                </h4>
                <ul className="text-sm text-red-900 space-y-3">
                  <li className="flex gap-2">
                    <span className="font-bold">•</span>
                    <span>
                      <strong>O colateral JÁ FOI DEPOSITADO</strong> na blockchain para garantir este pedido.
                    </span>
                  </li>
                  <li className="flex gap-2">
                    <span className="font-bold">•</span>
                    <span>
                      Para receber o colateral de volta, você <strong>DEVERÁ PAGAR as taxas de rede (gas fees)</strong> da blockchain.
                    </span>
                  </li>
                  <li className="flex gap-2">
                    <span className="font-bold">•</span>
                    <span>
                      A devolução será enviada para o endereço cadastrado em <strong>"Meus Endereços"</strong> (carteiras).
                    </span>
                  </li>
                  <li className="flex gap-2">
                    <span className="font-bold">•</span>
                    <span>
                      O valor do colateral MENOS as taxas de rede chegará em alguns minutos, dependendo da confirmação da blockchain.
                    </span>
                  </li>
                </ul>
              </div>

              <div className="bg-yellow-50 border border-yellow-300 rounded-lg p-3">
                <p className="text-sm text-yellow-900">
                  <strong>⚠️ Atenção:</strong> As taxas de rede podem variar de acordo com a blockchain escolhida.
                  Redes como Base e Arbitrum têm taxas menores (~$0.01-0.10). Bitcoin e Ethereum podem ter taxas maiores ($2-50).
                </p>
              </div>

              <p className="text-sm text-gray-600 font-semibold">
                ❌ Esta ação não pode ser desfeita.
              </p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowCancelModal(false)}
                disabled={cancelling}
                className="flex-1 px-4 py-3 bg-gray-200 hover:bg-gray-300 text-gray-800 font-semibold rounded-lg disabled:opacity-50"
              >
                ← Voltar
              </button>
              <button
                onClick={handleCancelOrder}
                disabled={cancelling}
                className="flex-1 px-4 py-3 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-lg disabled:opacity-50"
              >
                {cancelling ? 'Cancelando...' : 'Confirmar e Pagar Taxas'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold">Detalhes do Pedido</h1>
          <button
            onClick={() => router.push('/orders/my-orders')}
            className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-800 font-semibold rounded-lg"
          >
            Voltar
          </button>
        </div>

        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Informações do Pedido */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white rounded-lg shadow-md p-6">
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h2 className="text-2xl font-bold mb-2">
                    {paymentMethod === 'PIX' ? 'Pagamento PIX' : 'Pagamento de Boleto'}
                  </h2>
                  <span className={`inline-block px-3 py-1 rounded-full text-sm font-semibold ${getStatusColor(order.status)}`}>
                    {order.status}
                  </span>
                </div>
                <div className="text-right">
                  <p className="text-3xl font-bold">R$ {parseFloat(order.brlAmount).toFixed(2)}</p>
                  <p className="text-sm text-gray-600">
                    {parseFloat(order.cryptoAmount).toFixed(8)} {order.cryptoType}
                  </p>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <h3 className="font-bold mb-2">Dados do Pagamento</h3>
                  {paymentMethod === 'PIX' ? (
                    <>
                      <p><strong>Tipo de Chave:</strong> {orderData.pixKeyType}</p>
                      <p><strong>Chave PIX:</strong> {orderData.pixKey}</p>
                      <p><strong>Beneficiário:</strong> {orderData.recipientName}</p>
                    </>
                  ) : (
                    <>
                      <p><strong>Código de Barras:</strong></p>
                      <p className="font-mono text-sm bg-gray-50 p-2 rounded break-all">
                        {orderData.barcode}
                      </p>
                      <p><strong>Vencimento:</strong> {new Date(orderData.dueDate).toLocaleDateString()}</p>
                      <p><strong>Beneficiário:</strong> {orderData.recipientName}</p>
                    </>
                  )}
                </div>

                <div>
                  <h3 className="font-bold mb-2">Vendedor</h3>
                  <p><strong>Nome:</strong> {order.user.name}</p>
                  <p><strong>Reputação:</strong> {order.user.reputationScore}/100</p>
                </div>

                {transaction && (
                  <div>
                    <h3 className="font-bold mb-2">Pagador</h3>
                    <p><strong>Nome:</strong> {transaction.payer.name}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Upload de Comprovante */}
            {isPayer && order.status === 'MATCHED' && (
              <div className="bg-white rounded-lg shadow-md p-6">
                <h3 className="text-xl font-bold mb-4">Enviar Comprovante</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Foto do Comprovante
                    </label>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleImageUpload}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                    />
                  </div>

                  {proofImage && (
                    <div>
                      <p className="text-sm text-gray-600 mb-2">Preview:</p>
                      <img src={proofImage} alt="Preview" className="max-w-full h-auto rounded-lg" />
                    </div>
                  )}

                  <button
                    onClick={handleSubmitProof}
                    disabled={uploadingProof || !proofImage}
                    className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg disabled:opacity-50"
                  >
                    {uploadingProof ? 'Enviando...' : 'Enviar Comprovante'}
                  </button>
                </div>
              </div>
            )}

            {/* Comprovante Enviado */}
            {transaction?.comprovanteData && (
              <div className="bg-white rounded-lg shadow-md p-6">
                <h3 className="text-xl font-bold mb-4">Comprovante</h3>
                <img
                  src={transaction.comprovanteData}
                  alt="Comprovante"
                  className="max-w-full h-auto rounded-lg"
                />
                <p className="text-sm text-gray-600 mt-2">
                  Status: <strong>{transaction.status}</strong>
                </p>
                {transaction.validatedAt && (
                  <p className="text-sm text-gray-600">
                    Validado em: {new Date(transaction.validatedAt).toLocaleString()}
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Resumo e Ações */}
          <div className="space-y-6">
            <div className="bg-white rounded-lg shadow-md p-6">
              <h3 className="font-bold mb-4">Resumo Financeiro</h3>
              <div className="space-y-3">
                {isCreator ? (
                  <>
                    {/* CRIADOR: Pediu BRL, depositou cripto como colateral */}
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                      <p className="text-xs text-blue-700 font-semibold mb-1">💰 VOCÊ RECEBERÁ EM BRL:</p>
                      <p className="text-2xl font-bold text-green-600">
                        R$ {parseFloat(order.brlAmount).toFixed(2)}
                      </p>
                      <p className="text-xs text-blue-600 mt-1">
                        Quando alguém pagar seu {paymentMethod}
                      </p>
                    </div>

                    <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 mt-3">
                      <p className="text-xs font-semibold text-gray-700 uppercase mb-2">Sobre o Colateral:</p>
                      <div className="space-y-2">
                        <div className="flex justify-between items-center">
                          <p className="text-sm text-gray-600">Valor depositado</p>
                          <p className="font-semibold">{parseFloat(order.cryptoAmount).toFixed(8)} {order.cryptoType}</p>
                        </div>
                        <div className="flex justify-between items-center">
                          <p className="text-sm text-gray-600">Taxa total (2.5%)</p>
                          <p className="text-red-600 text-sm">-{parseFloat(order.totalFee).toFixed(8)} {order.cryptoType}</p>
                        </div>
                        <div className="text-xs text-gray-600 bg-white p-2 rounded mt-2 space-y-1">
                          <p>• 1.5% vai para a plataforma</p>
                          <p>• 1% vai como cashback para quem pagar</p>
                        </div>
                      </div>

                      <div className="bg-yellow-50 border border-yellow-300 rounded p-2 mt-3">
                        <p className="text-xs text-yellow-900 font-semibold">
                          ⚠️ O colateral NÃO será devolvido
                        </p>
                        <p className="text-xs text-yellow-800 mt-1">
                          Ele será transferido para quem pagar seu {paymentMethod}. Você receberá os R$ {parseFloat(order.brlAmount).toFixed(2)} em BRL.
                        </p>
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    {/* PAGADOR: Pagará BRL, receberá cripto */}
                    <div className="bg-orange-50 border border-orange-200 rounded-lg p-3">
                      <p className="text-xs text-orange-700 font-semibold mb-1">💸 VOCÊ PAGARÁ EM BRL:</p>
                      <p className="text-2xl font-bold text-orange-600">
                        R$ {parseFloat(order.brlAmount).toFixed(2)}
                      </p>
                      <p className="text-xs text-orange-600 mt-1">
                        Via {paymentMethod}
                      </p>
                    </div>

                    <div className="bg-green-50 border border-green-200 rounded-lg p-3 mt-3">
                      <p className="text-xs text-green-700 font-semibold mb-1">💰 VOCÊ RECEBERÁ EM CRIPTO:</p>
                      <p className="text-2xl font-bold text-green-600">
                        {(parseFloat(order.cryptoAmount) + parseFloat(order.payerReward)).toFixed(8)} {order.cryptoType}
                      </p>
                      <p className="text-xs text-green-600 mt-1">
                        ✨ Inclui +{parseFloat(order.payerReward).toFixed(8)} de cashback (1%)
                      </p>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Ações */}
            <div className="bg-white rounded-lg shadow-md p-6">
              <h3 className="font-bold mb-4">Ações</h3>
              <div className="space-y-2">
                {/* Chat - Disponível após MATCHED */}
                {(order.status === 'MATCHED' || order.status === 'PAYMENT_SENT' || order.status === 'VALIDATING') && (
                  <button
                    onClick={() => setShowChat(true)}
                    className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg"
                  >
                    💬 Abrir Chat
                  </button>
                )}

                {/* Confirmar Pagamento Feito - Pagador no status MATCHED */}
                {!isCreator && order.status === 'MATCHED' && (
                  <button
                    onClick={() => setShowPaymentConfirmModal(true)}
                    disabled={confirmingPayment}
                    className="w-full px-4 py-2 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-lg disabled:opacity-50"
                  >
                    {confirmingPayment ? 'Confirmando...' : '✅ Confirmo Pagamento Feito'}
                  </button>
                )}

                {/* Confirmar Pagamento Recebido - Vendedor após comprovante enviado */}
                {isCreator && (order.status === 'PAYMENT_SENT' || order.status === 'VALIDATING') && (
                  <button
                    onClick={handleConfirmPaymentReceived}
                    disabled={confirmingReceived}
                    className="w-full px-4 py-2 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-lg disabled:opacity-50"
                  >
                    {confirmingReceived ? 'Confirmando...' : '✅ Confirmar Pagamento Recebido'}
                  </button>
                )}

                {/* Cancelar Pedido - Disponível para criador em status PENDING ou MATCHED (antes do pagamento) */}
                {isCreator && (order.status === 'PENDING' || order.status === 'MATCHED') && (
                  <div>
                    <button
                      onClick={() => setShowCancelModal(true)}
                      className="w-full px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white font-semibold rounded-lg"
                    >
                      ⚠️ Cancelar Pedido
                    </button>
                    <p className="text-xs text-gray-500 mt-1 text-center">
                      Taxa de rede será cobrada para devolver colateral
                    </p>
                  </div>
                )}

                {/* Abrir Disputa */}
                {order.status !== 'COMPLETED' && order.status !== 'CANCELLED' && (
                  <button
                    onClick={handleDispute}
                    className="w-full px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-lg"
                  >
                    Abrir Disputa
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Modal de Confirmação de Pagamento */}
        {showPaymentConfirmModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg p-6 max-w-md w-full">
              <h3 className="text-xl font-bold mb-4">⚠️ Confirmar Pagamento</h3>
              <p className="text-gray-700 mb-6">
                Tem certeza que o pagamento já foi feito? Essa operação não poderá ser desfeita.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowPaymentConfirmModal(false)}
                  className="flex-1 px-4 py-2 bg-gray-300 hover:bg-gray-400 text-gray-800 font-semibold rounded-lg"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleConfirmPaymentMade}
                  disabled={confirmingPayment}
                  className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-lg disabled:opacity-50"
                >
                  {confirmingPayment ? 'Confirmando...' : 'Sim, Confirmar'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal de Chat */}
        {showChat && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="w-full max-w-2xl h-[600px]">
              <ChatWindow
                orderId={orderId}
                onClose={() => setShowChat(false)}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
