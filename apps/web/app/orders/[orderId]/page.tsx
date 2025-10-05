'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';

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

  useEffect(() => {
    fetchOrder();
    const interval = setInterval(fetchOrder, 5000); // Atualizar a cada 5s
    return () => clearInterval(interval);
  }, [orderId]);

  const fetchOrder = async () => {
    try {
      const response = await fetch(`http://localhost:3001/api/v1/orders/${orderId}`, {
        credentials: 'include', // SECURITY: Envia cookies HttpOnly
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

      const response = await fetch('http://localhost:3001/api/v1/transactions/submit-proof', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include', // SECURITY: Envia cookies HttpOnly
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
      const token = localStorage.getItem('token');
      const transaction = order?.transactions[0];

      const response = await fetch(
        `http://localhost:3001/api/v1/transactions/${transaction?.id}/dispute`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
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
  const currentUserId = localStorage.getItem('userId'); // Simplificado

  const isCreator = order.user.id === currentUserId;
  const isPayer = transaction?.payer?.id === currentUserId;

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
                    {order.type === 'PIX' ? 'Pagamento PIX' : 'Pagamento de Boleto'}
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
                  {order.type === 'PIX' ? (
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
              <div className="space-y-2">
                {isCreator ? (
                  <>
                    <div>
                      <p className="text-sm text-gray-600">Valor Bruto</p>
                      <p className="font-semibold">{parseFloat(order.cryptoAmount).toFixed(8)} {order.cryptoType}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Taxa Total (2.5%)</p>
                      <p className="text-red-600">-{parseFloat(order.totalFee).toFixed(8)} {order.cryptoType}</p>
                    </div>
                    <hr />
                    <div>
                      <p className="text-sm text-gray-600">Você Receberá</p>
                      <p className="text-xl font-bold text-green-600">
                        {(parseFloat(order.cryptoAmount) - parseFloat(order.totalFee)).toFixed(8)} {order.cryptoType}
                      </p>
                    </div>
                  </>
                ) : (
                  <>
                    <div>
                      <p className="text-sm text-gray-600">Você Pagará</p>
                      <p className="font-semibold">R$ {parseFloat(order.brlAmount).toFixed(2)}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Você Receberá (1% cashback)</p>
                      <p className="text-xl font-bold text-green-600">
                        {parseFloat(order.payerReward).toFixed(8)} {order.cryptoType}
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
      </div>
    </div>
  );
}
