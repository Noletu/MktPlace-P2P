'use client';

import { useEffect, useState, useMemo } from 'react';
import { useRouter, useParams, useSearchParams } from 'next/navigation';
import ChatWindow from '@/components/chat/ChatWindow';
import ChatHistoryViewer from '@/components/chat/ChatHistoryViewer';
import Tabs from '@/components/Tabs';
import CountdownTimer from '@/components/CountdownTimer';
import { formatBRL } from '@/utils/formatters';
import ThemeToggle from '@/components/ThemeToggle';
import AppHeader from '@/components/AppHeader';
import ReviewModal, { ReviewData } from '@/components/modals/ReviewModal';
import CancellationModal from '@/components/CancellationModal';
import EditOrderModal from '@/components/EditOrderModal';
import { CancellationReason } from '@/types/cancellation';

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
    id: string;
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
  const searchParams = useSearchParams();
  const orderId = params.orderId as string;

  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [uploadingProof, setUploadingProof] = useState(false);
  const [proofImage, setProofImage] = useState<string>('');
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [confirmingReceived, setConfirmingReceived] = useState(false);
  const [showPaymentConfirmModal, setShowPaymentConfirmModal] = useState(false);
  const [confirmingPayment, setConfirmingPayment] = useState(false);
  const [modalProofImage, setModalProofImage] = useState<string>('');
  const [chatUnreadCount, setChatUnreadCount] = useState<number>(0);
  const [showPayerCancelModal, setShowPayerCancelModal] = useState(false);
  const [cancellingAsPayer, setCancellingAsPayer] = useState(false);
  const [showDisputeModal, setShowDisputeModal] = useState(false);
  const [disputeId, setDisputeId] = useState<string | null>(null);

  // Sistema de Abas - Detecta tab da URL
  const initialTab = searchParams.get('tab') || 'details';
  const validTabs = ['details', 'payment', 'timeline', 'chat', 'history'];
  const [activeTab, setActiveTab] = useState<string>(
    validTabs.includes(initialTab) ? initialTab : 'details'
  );
  const [chatId, setChatId] = useState<string | null>(null);

  // Review system states
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [canReviewOrder, setCanReviewOrder] = useState(false);
  const [reviewedUserId, setReviewedUserId] = useState<string | null>(null);
  const [reviewedUserName, setReviewedUserName] = useState<string>('');
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  // Edit order state
  const [showEditModal, setShowEditModal] = useState(false);

  // Parse orderData - useMemo to recalculate when order changes
  const orderData = useMemo(() => {
    if (!order) return null;
    return JSON.parse(order.orderData);
  }, [order]);

  useEffect(() => {
    fetchOrder();
    fetchChatUnreadCount();
    const interval = setInterval(() => {
      fetchOrder();
      fetchChatUnreadCount();
    }, 5000); // Atualizar a cada 5s
    return () => clearInterval(interval);
  }, [orderId]);

  // Load current user ID from localStorage
  useEffect(() => {
    const userStr = localStorage.getItem('user');
    if (userStr) {
      try {
        const user = JSON.parse(userStr);
        setCurrentUserId(user.id);
      } catch (error) {
        console.error('Error parsing user from localStorage:', error);
      }
    }
  }, []);

  // Detectar mudanças no parâmetro 'tab' da URL
  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab && validTabs.includes(tab)) {
      setActiveTab(tab);
    }
  }, [searchParams]);

  // Garantir que activeTab sempre corresponde a uma aba existente (fallback defensivo)
  useEffect(() => {
    if (!order) return;

    const tabs = buildTabs();
    const tabExists = tabs.some(t => t.id === activeTab);

    if (!tabExists && activeTab !== 'details') {
      console.warn(`Tab '${activeTab}' não existe, voltando para 'details'`);
      setActiveTab('details');
    }
  }, [order, chatId, activeTab]);

  const fetchOrder = async () => {
    try {
      const token = localStorage.getItem('accessToken');
      if (!token) {
        router.push('/login');
        return;
      }

      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001/api/v1"}/orders/${orderId}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Erro ao buscar pedido');
      }

      const data = await response.json();
      setOrder(data.data);

      // Se pedido está em disputa, buscar ID da disputa
      if (data.data.status === 'DISPUTED') {
        fetchDisputeId();
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchChatUnreadCount = async () => {
    try {
      const token = localStorage.getItem('accessToken');
      if (!token) return;

      // Chat só disponível após MATCHED - não fazer polling para PENDING ou se order não existe
      if (!order || order.status === 'PENDING') {
        return;
      }

      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001/api/v1"}/chat/order/${orderId}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setChatUnreadCount(data.data.unreadCount || 0);
        setChatId(data.data.id || null); // Armazena chatId para histórico
      }
    } catch (err: any) {
      // Silently fail - chat might not exist yet
      console.log('Chat não encontrado ou erro:', err.message);
    }
  };

  const fetchDisputeId = async () => {
    try {
      const token = localStorage.getItem('accessToken');
      if (!token) return;

      const response = await fetch('http://localhost:3001/api/v1/disputes/my-disputes', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) return;

      const data = await response.json();
      if (data.success && data.data) {
        // Encontrar disputa deste pedido
        const dispute = data.data.find((d: any) => d.orderId === orderId);
        if (dispute) {
          setDisputeId(dispute.id);
        }
      }
    } catch (error) {
      console.error('Erro ao buscar disputa:', error);
    }
  };

  // Check if user can review when order is completed
  useEffect(() => {
    const checkCanReview = async () => {
      if (order?.status !== 'COMPLETED' || !currentUserId) return;

      // Check localStorage to avoid showing modal repeatedly (SPECIFIC PER USER)
      const hasReviewed = localStorage.getItem(`order-${orderId}-reviewed-${currentUserId}`);
      const hasDeclined = localStorage.getItem(`order-${orderId}-declined-review-${currentUserId}`);
      if (hasReviewed === 'true' || hasDeclined === 'true') return;

      try {
        const token = localStorage.getItem('accessToken');
        if (!token) return;

        const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001/api/v1"}/reviews/can-review/${orderId}`, {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });

        if (!response.ok) return;

        const data = await response.json();
        if (data.success && data.data.canReview) {
          setCanReviewOrder(true);
          setReviewedUserId(data.data.reviewedId);

          // Get reviewed user name from order data
          const reviewedUser = order.user.id === data.data.reviewedId
            ? order.user
            : order.transactions[0]?.payer;

          if (reviewedUser) {
            setReviewedUserName(reviewedUser.name || reviewedUser.email);
            // Show modal automatically
            setShowReviewModal(true);
          }
        }
      } catch (error) {
        console.error('Erro ao verificar se pode avaliar:', error);
      }
    };

    checkCanReview();
  }, [order, orderId, currentUserId]);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      setProofImage(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleModalImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      setModalProofImage(reader.result as string);
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

  const canOpenDispute = () => {
    // Não permitir se já completado, cancelado ou em disputa
    if (order?.status === 'COMPLETED' || order?.status === 'CANCELLED' || order?.status === 'DISPUTED') {
      return false;
    }

    // Comprador/Pagador pode abrir disputa quando enviar pagamento (PAYMENT_SENT ou VALIDATING)
    if (isPayer && (order?.status === 'PAYMENT_SENT' || order?.status === 'VALIDATING')) {
      return true; // Removida restrição de 24h para facilitar testes
    }

    // Vendedor/Criador pode abrir após receber comprovante (PAYMENT_SENT ou VALIDATING)
    if (isCreator && (order?.status === 'PAYMENT_SENT' || order?.status === 'VALIDATING')) {
      return true;
    }

    return false;
  };

  const handleOpenDispute = () => {
    setShowDisputeModal(true);
  };

  const confirmOpenDispute = () => {
    setShowDisputeModal(false);
    router.push(`/orders/${orderId}/dispute/new`);
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

      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001/api/v1"}/transactions/${transaction.id}/confirm-received`, {
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
    // Validar se há comprovante
    if (!modalProofImage) {
      alert('⚠️ Por favor, anexe o comprovante de pagamento antes de confirmar.');
      return;
    }

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

      // 1. Confirmar que o pagamento foi feito
      const confirmResponse = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001/api/v1"}/transactions/${transaction.id}/confirm-payment-made`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      const confirmData = await confirmResponse.json();

      if (!confirmResponse.ok) {
        throw new Error(confirmData.error || 'Erro ao confirmar pagamento');
      }

      // 2. Enviar o comprovante
      const proofResponse = await fetch('http://localhost:3001/api/v1/transactions/submit-proof', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          transactionId: transaction.id,
          comprovanteData: modalProofImage,
        }),
      });

      const proofData = await proofResponse.json();

      if (!proofResponse.ok) {
        throw new Error(proofData.error || 'Erro ao enviar comprovante');
      }

      alert('✅ Pagamento confirmado e comprovante enviado com sucesso!');
      setModalProofImage(''); // Limpar imagem do modal
      await fetchOrder();
    } catch (err: any) {
      setError(err.message);
      alert(err.message);
    } finally {
      setConfirmingPayment(false);
    }
  };

  const handleEditOrder = async (updates: {
    customExpirationHours?: number;
    orderData?: any;
  }) => {
    setError('');

    try {
      const token = localStorage.getItem('accessToken');
      if (!token) {
        throw new Error('Você precisa estar logado');
      }

      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001/api/v1"}/orders/${orderId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(updates),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Erro ao atualizar pedido');
      }

      alert('✅ Pedido atualizado com sucesso!');
      setShowEditModal(false);
      await fetchOrder(); // Recarregar dados
    } catch (err: any) {
      setError(err.message);
      throw err; // Re-throw para o modal tratar
    }
  };

  const handleCancelOrder = async (reason: CancellationReason, note: string) => {
    setCancelling(true);
    setError('');

    try {
      const token = localStorage.getItem('accessToken');
      if (!token) {
        throw new Error('Você precisa estar logado');
      }

      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001/api/v1"}/orders/${orderId}/cancel`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ reason, note }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Erro ao cancelar pedido');
      }

      // Mostrar mensagem com informação de penalidade
      const message = data.penaltyApplied
        ? `Pedido cancelado! Penalidade: -${data.penaltyPoints} pontos de reputação.`
        : 'Pedido cancelado com sucesso!';

      alert(message);
      setShowCancelModal(false);
      await fetchOrder();
      router.push('/orders/my-orders');
    } catch (err: any) {
      setError(err.message);
      alert(err.message);
      throw err; // Re-throw para o modal saber que houve erro
    } finally {
      setCancelling(false);
    }
  };

  const handlePayerCancelOrder = async (reason: CancellationReason, note: string) => {
    setCancellingAsPayer(true);
    setError('');

    try {
      const token = localStorage.getItem('accessToken');
      if (!token) {
        throw new Error('Você precisa estar logado');
      }

      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001/api/v1"}/orders/${orderId}/cancel-by-payer`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ reason, note }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Erro ao cancelar pedido');
      }

      // Mostrar mensagem com informação de penalidade
      const message = data.penaltyApplied
        ? `✅ Cancelamento confirmado! O pedido voltou ao marketplace.\n⚠️ Penalidade: -${data.penaltyPoints} pontos de reputação.`
        : '✅ Cancelamento confirmado! O pedido voltou ao marketplace.';

      alert(message);
      setShowPayerCancelModal(false);
      await fetchOrder();
      router.push('/marketplace');
    } catch (err: any) {
      setError(err.message);
      alert(err.message);
      throw err; // Re-throw para o modal saber que houve erro
    } finally {
      setCancellingAsPayer(false);
    }
  };

  const handleSubmitReview = async (reviewData: ReviewData) => {
    try {
      const token = localStorage.getItem('accessToken');
      if (!token) throw new Error('Não autorizado');

      // Calculate overall rating as average of 3 categories
      const rating = Math.round(
        (reviewData.reliabilityRating + reviewData.communicationRating + reviewData.speedRating) / 3
      );

      // Ensure all ratings are integers (Zod validation requires .int())
      const payload = {
        reviewedId: reviewedUserId,
        orderId: orderId,
        rating: Math.round(rating),
        reliabilityRating: Math.round(reviewData.reliabilityRating),
        communicationRating: Math.round(reviewData.communicationRating),
        speedRating: Math.round(reviewData.speedRating),
        comment: reviewData.comment,
      };

      const response = await fetch('http://localhost:3001/api/v1/reviews', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Erro ao enviar avaliação');
      }

      // Mark as reviewed in localStorage (SPECIFIC PER USER for bilateral reviews)
      if (currentUserId) {
        localStorage.setItem(`order-${orderId}-reviewed-${currentUserId}`, 'true');
      }

      // Close modal
      setShowReviewModal(false);

      // Show success message
      alert('✨ Avaliação enviada com sucesso! Obrigado pelo feedback.');
    } catch (error: any) {
      throw error; // Let modal handle error display
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-xl text-gray-900 dark:text-white">Carregando...</div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-xl text-gray-900 dark:text-white">Pedido não encontrado</div>
      </div>
    );
  }

  const transaction = order.transactions[0];

  // Detectar método de pagamento a partir do orderData
  const paymentMethod = orderData.pixKey ? 'PIX' : 'BOLETO';

  // currentUserId now comes from useState (loaded in useEffect)
  const isCreator = order.user.id === currentUserId;
  const isPayer = transaction?.payer?.id === currentUserId;

  // Debug: mostrar informações detalhadas no console
  console.log('🔍 Debug Order Details:', {
    orderId: order.id,
    orderStatus: order.status,
    orderUserId: order.user.id,
    orderUserIdType: typeof order.user.id,
    currentUserId,
    currentUserIdType: typeof currentUserId,
    isCreator,
    isPayer,
    transaction: transaction ? {
      id: transaction.id,
      status: transaction.status,
      payerId: transaction.payer?.id,
      hasComprovante: !!transaction.comprovanteData,
    } : null,
    canCancel: isCreator && (order.status === 'PENDING' || order.status === 'MATCHED'),
    shouldShowConfirmButton: isCreator && (order.status === 'PAYMENT_SENT' || order.status === 'VALIDATING'),
  });

  // Funções auxiliares para o sistema de abas
  const shouldShowChat = () => {
    if (!order) return false;

    // Se chat existe, SEMPRE mostrar (prioridade máxima)
    if (chatId !== null) return true;

    // Chat só disponível após MATCHED (após aceitar o pedido)
    return (
      order.status === 'MATCHED' ||
      order.status === 'PAYMENT_SENT' ||
      order.status === 'VALIDATING' ||
      order.status === 'COMPLETED'
    );
  };

  const shouldShowHistory = () => {
    if (!order) return false;
    return (
      order.status === 'COMPLETED' ||
      order.status === 'CANCELLED' ||
      order.status === 'EXPIRED'
    );
  };

  const translateStatus = (status: string): string => {
    const translations: Record<string, string> = {
      PENDING: 'Pendente',
      MATCHED: 'Aceito',
      PAYMENT_SENT: 'Pagamento Enviado',
      VALIDATING: 'Validando',
      COMPLETED: 'Concluído',
      DISPUTED: 'Em Disputa',
      CANCELLED: 'Cancelado',
    };
    return translations[status] || status;
  };

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

  const buildTabs = () => {
    const tabs = [
      {
        id: 'details',
        label: 'Detalhes do Pedido',
        content: (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Informações do Pedido */}
            <div className="lg:col-span-2 space-y-6">
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
                <div className="flex justify-between items-start mb-6">
                  <div>
                    <h2 className="text-2xl font-bold mb-1 text-gray-900 dark:text-white">
                      {paymentMethod === 'PIX' ? 'Pagamento PIX' : 'Pagamento de Boleto'}
                    </h2>
                    <div className="flex items-center gap-2 mb-3">
                      <p className="text-sm text-gray-600 dark:text-gray-400 font-mono">
                        Pedido #{order.id.substring(0, 8).toUpperCase()}
                      </p>
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(order.id);
                          alert('ID completo copiado para área de transferência!');
                        }}
                        className="text-xs text-blue-600 hover:text-blue-800 dark:text-blue-400 hover:underline"
                        title="Copiar ID completo"
                      >
                        📋 Copiar
                      </button>
                    </div>
                    <div className="flex flex-col gap-3">
                      <span className={`inline-block px-3 py-1 rounded-full text-sm font-semibold ${getStatusColor(order.status)}`}>
                        {translateStatus(order.status)}
                      </span>
                      {/* Countdown Timer - Mostrar para PENDING e MATCHED */}
                      {(order.status === 'PENDING' || order.status === 'MATCHED') && order.timeoutAt && (
                        <CountdownTimer
                          timeoutAt={order.timeoutAt}
                          onExpire={() => {
                            console.log('Timer expirado, recarregando página...');
                            fetchOrder();
                          }}
                        />
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-3xl font-bold text-gray-900 dark:text-white">{formatBRL(order.brlAmount)}</p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {parseFloat(order.cryptoAmount).toFixed(8)} {order.cryptoType}
                    </p>
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <h3 className="font-bold mb-2 text-gray-900 dark:text-white">Dados do Pagamento</h3>
                    {paymentMethod === 'PIX' ? (
                      <>
                        <p className="text-gray-800 dark:text-gray-300"><strong>Tipo de Chave:</strong> {orderData.pixKeyType}</p>
                        <p className="text-gray-800 dark:text-gray-300"><strong>Chave PIX:</strong> {orderData.pixKey}</p>
                        <p className="text-gray-800 dark:text-gray-300"><strong>Beneficiário:</strong> {orderData.recipientName}</p>
                      </>
                    ) : (
                      <>
                        <p className="text-gray-800 dark:text-gray-300"><strong>Código de Barras:</strong></p>
                        <p className="font-mono text-sm bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white p-2 rounded break-all">
                          {orderData.barcode}
                        </p>
                        <p className="text-gray-800 dark:text-gray-300"><strong>Vencimento:</strong> {new Date(orderData.dueDate).toLocaleDateString()}</p>
                        <p className="text-gray-800 dark:text-gray-300"><strong>Beneficiário:</strong> {orderData.recipientName}</p>
                      </>
                    )}
                  </div>

                  <div>
                    <h3 className="font-bold mb-2 text-gray-900 dark:text-white">Vendedor</h3>
                    <p className="text-gray-800 dark:text-gray-300"><strong>Nome:</strong> {order.user.name}</p>
                    <p className="text-gray-800 dark:text-gray-300"><strong>Reputação:</strong> {order.user.reputationScore}/100</p>
                  </div>

                  {transaction && (
                    <div>
                      <h3 className="font-bold mb-2 text-gray-900 dark:text-white">Pagador</h3>
                      <p className="text-gray-800 dark:text-gray-300"><strong>Nome:</strong> {transaction.payer.name}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Mensagem de Aguardando Confirmação */}
              {(order.status === 'PAYMENT_SENT' || order.status === 'VALIDATING') && (
                <div className={`border-2 rounded-lg shadow-md p-6 ${
                  isPayer
                    ? 'bg-blue-50 dark:bg-blue-900/30 border-blue-300 dark:border-blue-700'
                    : 'bg-orange-50 dark:bg-orange-900/30 border-orange-300 dark:border-orange-700'
                }`}>
                  <div className="flex items-center gap-4">
                    <div className="text-5xl animate-pulse">{isPayer ? '⏳' : '👀'}</div>
                    <div>
                      <h3 className={`text-2xl font-bold mb-2 ${
                        isPayer
                          ? 'text-blue-800 dark:text-blue-200'
                          : 'text-orange-800 dark:text-orange-200'
                      }`}>
                        {isPayer
                          ? 'Aguardando confirmação do vendedor'
                          : '⚠️ Aguardando SUA confirmação de recebimento'}
                      </h3>
                      <p className={isPayer
                          ? 'text-blue-700 dark:text-blue-300'
                          : 'text-orange-700 dark:text-orange-300'
                      }>
                        {isPayer
                          ? 'O vendedor está verificando seu comprovante de pagamento. Você será notificado quando ele confirmar.'
                          : 'O comprador enviou o comprovante de pagamento. Verifique se recebeu o valor e confirme abaixo para liberar a criptomoeda.'}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Upload de Comprovante */}
              {isPayer && order.status === 'MATCHED' && (
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
                  <h3 className="text-xl font-bold mb-4 text-gray-900 dark:text-white">Enviar Comprovante</h3>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Foto do Comprovante
                      </label>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleImageUpload}
                        className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      />
                    </div>

                    {proofImage && (
                      <div>
                        <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">Preview:</p>
                        <img src={proofImage} alt="Preview" className="max-w-full h-auto rounded-lg" />
                      </div>
                    )}

                    <button
                      onClick={handleSubmitProof}
                      disabled={uploadingProof || !proofImage}
                      className="w-full py-3 px-4 bg-blue-600 dark:bg-blue-700 hover:bg-blue-700 dark:hover:bg-blue-800 text-white font-semibold rounded-lg disabled:opacity-50"
                    >
                      {uploadingProof ? 'Enviando...' : 'Enviar Comprovante'}
                    </button>
                  </div>
                </div>
              )}

              {/* Comprovante Enviado */}
              {transaction?.comprovanteData && (
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
                  <h3 className="text-xl font-bold mb-4 text-gray-900 dark:text-white">Comprovante</h3>
                  <img
                    src={transaction.comprovanteData}
                    alt="Comprovante"
                    className="max-w-full h-auto rounded-lg"
                  />
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
                    Status: <strong>{translateStatus(transaction.status)}</strong>
                  </p>
                  {transaction.validatedAt && (
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Validado em: {new Date(transaction.validatedAt).toLocaleString()}
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Resumo e Ações */}
            <div className="space-y-6">
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
                <h3 className="font-bold mb-4 text-gray-900 dark:text-white">Resumo Financeiro</h3>
                <div className="space-y-3">
                  {isCreator ? (
                    <>
                      {/* CRIADOR: Pediu BRL, depositou cripto como colateral */}
                      <div className="bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-700 rounded-lg p-3">
                        <p className="text-xs text-blue-700 dark:text-blue-300 font-semibold mb-1">💰 VOCÊ RECEBERÁ EM BRL:</p>
                        <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                          {formatBRL(order.brlAmount)}
                        </p>
                        <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                          Quando alguém pagar seu {paymentMethod}
                        </p>
                      </div>

                      <div className="bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg p-3 mt-3">
                        <p className="text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase mb-2">Sobre o Colateral:</p>
                        <div className="space-y-2">
                          <div className="flex justify-between items-center">
                            <p className="text-sm text-gray-600 dark:text-gray-400">Valor depositado</p>
                            <p className="font-semibold text-gray-900 dark:text-white">{parseFloat(order.cryptoAmount).toFixed(8)} {order.cryptoType}</p>
                          </div>
                          <div className="flex justify-between items-center">
                            <p className="text-sm text-gray-600 dark:text-gray-400">Taxa total (2.5%)</p>
                            <p className="text-red-600 dark:text-red-400 text-sm">-{parseFloat(order.totalFee).toFixed(8)} {order.cryptoType}</p>
                          </div>
                          <div className="text-xs text-gray-600 dark:text-gray-400 bg-white dark:bg-gray-800 p-2 rounded mt-2 space-y-1">
                            <p>• 1.5% vai para a plataforma</p>
                            <p>• 1% vai como cashback para quem pagar</p>
                          </div>
                        </div>

                        <div className="bg-yellow-50 dark:bg-yellow-900/30 border border-yellow-300 dark:border-yellow-700 rounded p-2 mt-3">
                          <p className="text-xs text-yellow-900 dark:text-yellow-200 font-semibold">
                            ⚠️ O colateral NÃO será devolvido
                          </p>
                          <p className="text-xs text-yellow-800 dark:text-yellow-300 mt-1">
                            Ele será transferido para quem pagar seu {paymentMethod}. Você receberá os {formatBRL(order.brlAmount)} em BRL.
                          </p>
                        </div>
                      </div>
                    </>
                  ) : (
                    <>
                      {/* PAGADOR: Pagará BRL, receberá cripto */}
                      <div className="bg-orange-50 dark:bg-orange-900/30 border border-orange-200 dark:border-orange-700 rounded-lg p-3">
                        <p className="text-xs text-orange-700 dark:text-orange-300 font-semibold mb-1">💸 VOCÊ PAGARÁ EM BRL:</p>
                        <p className="text-2xl font-bold text-orange-600 dark:text-orange-400">
                          {formatBRL(order.brlAmount)}
                        </p>
                        <p className="text-xs text-orange-600 dark:text-orange-400 mt-1">
                          Via {paymentMethod}
                        </p>
                      </div>

                      <div className="bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-700 rounded-lg p-3 mt-3">
                        <p className="text-xs text-green-700 dark:text-green-300 font-semibold mb-1">💰 VOCÊ RECEBERÁ EM CRIPTO:</p>
                        <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                          {(parseFloat(order.cryptoAmount) + parseFloat(order.payerReward)).toFixed(8)} {order.cryptoType}
                        </p>
                        <p className="text-xs text-green-600 dark:text-green-400 mt-1">
                          ✨ Inclui +{parseFloat(order.payerReward).toFixed(8)} de cashback (1%)
                        </p>
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Ações */}
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
                <h3 className="font-bold mb-4 text-gray-900 dark:text-white">Ações</h3>
                <div className="space-y-2">
                  {/* Confirmar Pagamento Feito - Pagador no status MATCHED */}
                  {!isCreator && order.status === 'MATCHED' && (
                    <button
                      onClick={() => setShowPaymentConfirmModal(true)}
                      disabled={confirmingPayment}
                      className="w-full px-4 py-2 bg-green-600 dark:bg-green-700 hover:bg-green-700 dark:hover:bg-green-800 text-white font-semibold rounded-lg disabled:opacity-50"
                    >
                      {confirmingPayment ? 'Confirmando...' : '✅ Confirmo Pagamento Feito'}
                    </button>
                  )}

                  {/* Cancelar Aceite - Pagador no status MATCHED (antes do pagamento) */}
                  {isPayer && order.status === 'MATCHED' && (
                    <div>
                      <button
                        onClick={() => setShowPayerCancelModal(true)}
                        className="w-full px-4 py-2 bg-red-600 dark:bg-red-700 hover:bg-red-700 dark:hover:bg-red-800 text-white font-semibold rounded-lg"
                      >
                        ❌ Cancelar Aceite
                      </button>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 text-center">
                        Desistir deste pedido (sem penalidade)
                      </p>
                    </div>
                  )}

                  {/* Confirmar Pagamento Recebido - Vendedor após comprovante enviado */}
                  {isCreator && (order.status === 'PAYMENT_SENT' || order.status === 'VALIDATING') && (
                    <button
                      onClick={handleConfirmPaymentReceived}
                      disabled={confirmingReceived}
                      className="w-full px-4 py-2 bg-green-600 dark:bg-green-700 hover:bg-green-700 dark:hover:bg-green-800 text-white font-semibold rounded-lg disabled:opacity-50"
                    >
                      {confirmingReceived ? 'Confirmando...' : '✅ Confirmar Pagamento Recebido'}
                    </button>
                  )}

                  {/* Editar Pedido - Disponível para criador em status PENDING */}
                  {isCreator && order.status === 'PENDING' && (
                    <button
                      onClick={() => setShowEditModal(true)}
                      className="w-full px-4 py-2 bg-blue-600 dark:bg-blue-700 hover:bg-blue-700 dark:hover:bg-blue-800 text-white font-semibold rounded-lg"
                    >
                      ✏️ Editar Pedido
                    </button>
                  )}

                  {/* Cancelar Pedido - Disponível para criador em status PENDING ou MATCHED (antes do pagamento) */}
                  {isCreator && (order.status === 'PENDING' || order.status === 'MATCHED') && (
                    <div>
                      <button
                        onClick={() => setShowCancelModal(true)}
                        className="w-full px-4 py-2 bg-orange-600 dark:bg-orange-700 hover:bg-orange-700 dark:hover:bg-orange-800 text-white font-semibold rounded-lg"
                      >
                        ⚠️ Cancelar Pedido
                      </button>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 text-center">
                        Taxa de rede será cobrada para devolver colateral
                      </p>
                    </div>
                  )}

                  {/* Abrir Disputa */}
                  {canOpenDispute() && (
                    <div>
                      <button
                        onClick={handleOpenDispute}
                        className="w-full px-4 py-2 bg-red-600 dark:bg-red-700 hover:bg-red-700 dark:hover:bg-red-800 text-white font-semibold rounded-lg"
                      >
                        ⚠️ Abrir Disputa
                      </button>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 text-center">
                        {isPayer
                          ? 'Se o vendedor não confirmar o recebimento'
                          : 'Se houver problemas com o pagamento'}
                      </p>
                    </div>
                  )}

                  {/* Ver Disputa - Quando pedido está em disputa */}
                  {order.status === 'DISPUTED' && disputeId && (
                    <button
                      onClick={() => router.push(`/disputes/${disputeId}`)}
                      className="w-full px-4 py-2 bg-red-600 dark:bg-red-700 hover:bg-red-700 dark:hover:bg-red-800 text-white font-semibold rounded-lg"
                    >
                      🔍 Ver Disputa
                    </button>
                  )}

                  {/* Avaliar Transação - Disponível para pedidos concluídos */}
                  {order.status === 'COMPLETED' && canReviewOrder && currentUserId && !localStorage.getItem(`order-${orderId}-reviewed-${currentUserId}`) && (
                    <button
                      onClick={() => setShowReviewModal(true)}
                      className="w-full px-4 py-2 bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-600 hover:to-orange-600 text-white font-semibold rounded-lg shadow-md hover:shadow-lg transition-all"
                    >
                      ⭐ Avaliar Transação
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        ),
      },
    ];

    // Aba Chat (condicional)
    if (shouldShowChat()) {
      // Chat em modo somente leitura para pedidos finalizados
      const isChatReadOnly = order?.status === 'COMPLETED' ||
                             order?.status === 'CANCELLED' ||
                             order?.status === 'DISPUTED';

      tabs.push({
        id: 'chat',
        label: 'Chat',
        content: (
          <div className="h-[600px]">
            <ChatWindow
              orderId={orderId}
              readOnly={isChatReadOnly}
              onNewMessage={(isMine) => {
                // Apenas incrementar contador se NAO for minha mensagem e chat NAO estiver ativo
                if (!isMine && activeTab !== 'chat') {
                  setChatUnreadCount((prev) => prev + 1);
                }
              }}
            />
          </div>
        ),
        badge: chatUnreadCount,
      });
    }

    // Aba Histórico (condicional)
    if (shouldShowHistory()) {
      tabs.push({
        id: 'history',
        label: 'Histórico Arquivado',
        content: chatId ? <ChatHistoryViewer chatId={chatId} /> : (
          <div className="text-center py-8 text-gray-500">
            Nenhum histórico disponível
          </div>
        ),
      });
    }

    return tabs;
  };

  return (
    <>
      <AppHeader />
      <div className="max-w-5xl mx-auto">
        {/* Header da Página */}
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
              Pedido #{orderId.substring(0, 8)}
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1">
              Status: {order && translateStatus(order.status)}
            </p>
          </div>
          <div className="flex gap-4">
            <ThemeToggle />
            <button
              onClick={() => router.push('/orders/my-orders')}
              className="px-4 py-2 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200 font-semibold rounded-lg"
            >
              Voltar
            </button>
          </div>
        </div>

        {error && (
          <div className="mb-4 p-4 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700 rounded-lg text-red-700 dark:text-red-300">
            {error}
          </div>
        )}

        {/* Banner de Identificacao de Papel */}
        {order && currentUserId && (isCreator || isPayer) && (
          <div className={`mb-6 p-4 rounded-lg border-2 ${
            isPayer
              ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-300 dark:border-blue-700'
              : 'bg-green-50 dark:bg-green-900/20 border-green-300 dark:border-green-700'
          }`}>
            <div className="flex items-center gap-3">
              <span className="text-3xl">{isPayer ? '🛒' : '💰'}</span>
              <div>
                <h2 className={`text-xl font-bold ${
                  isPayer
                    ? 'text-blue-800 dark:text-blue-200'
                    : 'text-green-800 dark:text-green-200'
                }`}>
                  {isPayer ? 'VOCE E O COMPRADOR' : 'VOCE E O VENDEDOR'}
                </h2>
                <p className={`text-sm ${
                  isPayer
                    ? 'text-blue-700 dark:text-blue-300'
                    : 'text-green-700 dark:text-green-300'
                }`}>
                  {isPayer
                    ? `Voce paga ${formatBRL(order.brlAmount)} no ${paymentMethod} e recebe ${(parseFloat(order.cryptoAmount) + parseFloat(order.payerReward)).toFixed(8)} ${order.cryptoType} (inclui 1% cashback)`
                    : `Voce recebera ${formatBRL(order.brlAmount)} via ${paymentMethod}. Seu colateral de ${(parseFloat(order.cryptoAmount) + parseFloat(order.totalFee)).toFixed(8)} ${order.cryptoType} sera liberado (inclui 2.5% fee: 1.5% plataforma + 1% cashback)`
                  }
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Sistema de Abas */}
        <Tabs
          tabs={buildTabs()}
          activeTab={activeTab}
          onTabChange={(tabId) => {
            setActiveTab(tabId);
            // Se abriu aba chat, resetar contador
            if (tabId === 'chat') {
              setChatUnreadCount(0);
            }
          }}
        />
      </div>

      {/* Botao Flutuante de Chat */}
      {shouldShowChat() && activeTab !== 'chat' && (
        <button
          onClick={() => {
            setActiveTab('chat');
            setChatUnreadCount(0); // Resetar contador ao abrir chat
          }}
          className="fixed bottom-6 right-6 bg-blue-600 hover:bg-blue-700 text-white rounded-full p-4 shadow-lg z-50 flex items-center gap-2 transition-all hover:scale-105"
          title="Abrir Chat"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
          <span className="font-semibold">Chat</span>
          {chatUnreadCount > 0 && (
            <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold animate-pulse">
              {chatUnreadCount > 9 ? '9+' : chatUnreadCount}
            </span>
          )}
        </button>
      )}

      {/* Todos os modais ficam aqui (fora das abas) */}

      {/* Modal de Cancelamento Unificado */}
      <CancellationModal
        isOpen={showCancelModal}
        onClose={() => setShowCancelModal(false)}
        onConfirm={handleCancelOrder}
        isSeller={true}
        orderId={orderId as string}
      />

      {/* Modal de Cancelamento do Pagador */}
      <CancellationModal
        isOpen={showPayerCancelModal}
        onClose={() => setShowPayerCancelModal(false)}
        onConfirm={handlePayerCancelOrder}
        isSeller={false}
        orderId={orderId as string}
      />

      {/* Modal de Confirmação de Pagamento */}
      {showPaymentConfirmModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full">
              <h3 className="text-xl font-bold mb-4 text-gray-900 dark:text-white">⚠️ Confirmar Pagamento</h3>
              <p className="text-gray-700 dark:text-gray-300 mb-4">
                Tem certeza que o pagamento já foi feito? Essa operação não poderá ser desfeita.
              </p>

              {/* Campo de Upload de Comprovante */}
              <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/30 border-2 border-blue-300 dark:border-blue-700 rounded-lg">
                <label className="block text-sm font-bold text-blue-800 dark:text-blue-200 mb-2">
                  📎 Anexar Comprovante (Obrigatório)
                </label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleModalImageUpload}
                  className="w-full px-3 py-2 border border-blue-300 dark:border-blue-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
                {modalProofImage && (
                  <div className="mt-3">
                    <p className="text-xs text-blue-700 dark:text-blue-300 font-semibold mb-2">Preview:</p>
                    <img
                      src={modalProofImage}
                      alt="Preview do comprovante"
                      className="max-w-full h-auto rounded-lg border-2 border-blue-300 dark:border-blue-600"
                    />
                  </div>
                )}
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowPaymentConfirmModal(false);
                    setModalProofImage(''); // Limpar ao cancelar
                  }}
                  className="flex-1 px-4 py-2 bg-gray-300 dark:bg-gray-700 hover:bg-gray-400 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200 font-semibold rounded-lg"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleConfirmPaymentMade}
                  disabled={confirmingPayment || !modalProofImage}
                  className="flex-1 px-4 py-2 bg-green-600 dark:bg-green-700 hover:bg-green-700 dark:hover:bg-green-800 text-white font-semibold rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {confirmingPayment ? 'Enviando...' : 'Sim, Confirmar'}
                </button>
              </div>
            </div>
          </div>
        )}

      {/* Modal de Confirmação de Disputa */}
      {showDisputeModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full">
            <h3 className="text-xl font-bold mb-4 text-gray-900 dark:text-white">
              ⚠️ Você tem certeza que quer abrir uma disputa?
            </h3>

            <div className="bg-yellow-50 dark:bg-yellow-900/30 border border-yellow-200 dark:border-yellow-700 rounded-lg p-4 mb-6">
              <h4 className="text-sm font-semibold text-yellow-800 dark:text-yellow-200 mb-3">
                Antes de abrir uma disputa:
              </h4>
              <ul className="text-sm text-yellow-700 dark:text-yellow-300 space-y-2">
                <li className="flex items-start gap-2">
                  <span className="mt-0.5">•</span>
                  <span>Certifique-se de ter tentado contato com a outra parte</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-0.5">•</span>
                  <span>Tenha em mãos todos os comprovantes e evidências</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-0.5">•</span>
                  <span>A descrição deve ser clara e detalhada (mínimo 50 caracteres)</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-0.5">•</span>
                  <span>Você terá 24h para responder caso a outra parte conteste</span>
                </li>
              </ul>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowDisputeModal(false)}
                className="flex-1 px-4 py-3 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 font-semibold"
              >
                Cancelar
              </button>
              <button
                onClick={confirmOpenDispute}
                className="flex-1 px-4 py-3 bg-red-600 hover:bg-red-700 text-white rounded-lg font-semibold"
              >
                Sim, Continuar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Review Modal */}
      <ReviewModal
        isOpen={showReviewModal}
        onClose={() => {
          // Salvar que o usuário recusou avaliar (não mostrar novamente)
          if (currentUserId) {
            localStorage.setItem(`order-${orderId}-declined-review-${currentUserId}`, 'true');
          }
          setShowReviewModal(false);
        }}
        onSubmit={handleSubmitReview}
        reviewedUserName={reviewedUserName}
        orderId={orderId}
      />

      {/* Edit Order Modal */}
      <EditOrderModal
        isOpen={showEditModal}
        onClose={() => setShowEditModal(false)}
        onConfirm={handleEditOrder}
        orderType={paymentMethod as 'PIX' | 'BOLETO'}
        currentData={{
          customExpirationHours: order.customExpirationHours,
          ...(paymentMethod === 'PIX' ? {
            pixKey: orderData.pixKey,
            pixKeyType: orderData.pixKeyType,
            recipientName: orderData.recipientName,
          } : {
            barcode: orderData.barcode,
            dueDate: orderData.dueDate,
            recipientName: orderData.recipientName,
            recipientDocument: orderData.recipientDocument,
          }),
        }}
      />
    </>
  );
}
