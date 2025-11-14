'use client';

import { useState, useEffect } from 'react';
import { X } from 'lucide-react';

interface EditOrderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (updates: {
    customExpirationHours?: number;
    orderData?: any;
  }) => Promise<void>;
  orderType: 'PIX' | 'BOLETO';
  currentData: {
    customExpirationHours?: number;
    pixKey?: string;
    pixKeyType?: string;
    recipientName?: string;
    barcode?: string;
    dueDate?: string;
    recipientDocument?: string;
  };
}

export default function EditOrderModal({
  isOpen,
  onClose,
  onConfirm,
  orderType,
  currentData,
}: EditOrderModalProps) {
  // Estado para tempo de expiração
  const [customExpirationHours, setCustomExpirationHours] = useState<number>(
    currentData.customExpirationHours || 24
  );

  // Estados para dados PIX
  const [pixKey, setPixKey] = useState(currentData.pixKey || '');
  const [pixKeyType, setPixKeyType] = useState(currentData.pixKeyType || 'CPF');
  const [recipientName, setRecipientName] = useState(currentData.recipientName || '');

  // Estados para dados BOLETO
  const [barcode, setBarcode] = useState(currentData.barcode || '');
  const [dueDate, setDueDate] = useState(currentData.dueDate || '');
  const [recipientDocument, setRecipientDocument] = useState(currentData.recipientDocument || '');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  // Reset state quando modal abre (apenas quando isOpen muda de false para true)
  useEffect(() => {
    if (isOpen) {
      setCustomExpirationHours(currentData.customExpirationHours || 24);
      setPixKey(currentData.pixKey || '');
      setPixKeyType(currentData.pixKeyType || 'CPF');
      setRecipientName(currentData.recipientName || '');
      setBarcode(currentData.barcode || '');
      setDueDate(currentData.dueDate || '');
      setRecipientDocument(currentData.recipientDocument || '');
      setHasChanges(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  // Detectar mudanças
  useEffect(() => {
    const timeChanged = customExpirationHours !== (currentData.customExpirationHours || 24);
    const dataChanged =
      pixKey !== (currentData.pixKey || '') ||
      pixKeyType !== (currentData.pixKeyType || 'CPF') ||
      recipientName !== (currentData.recipientName || '') ||
      barcode !== (currentData.barcode || '') ||
      dueDate !== (currentData.dueDate || '') ||
      recipientDocument !== (currentData.recipientDocument || '');

    setHasChanges(timeChanged || dataChanged);
  }, [
    customExpirationHours,
    pixKey,
    pixKeyType,
    recipientName,
    barcode,
    dueDate,
    recipientDocument,
    currentData,
  ]);

  const handleSubmit = async () => {
    if (!hasChanges) {
      alert('Nenhuma alteração foi feita');
      return;
    }

    setIsSubmitting(true);

    try {
      const updates: any = {};

      // Incluir tempo de expiração se mudou
      if (customExpirationHours !== (currentData.customExpirationHours || 24)) {
        updates.customExpirationHours = customExpirationHours;
      }

      // Incluir dados de pagamento se mudaram
      const orderDataUpdates: any = {};

      if (orderType === 'PIX') {
        if (pixKey !== (currentData.pixKey || '')) {
          orderDataUpdates.pixKey = pixKey;
        }
        if (pixKeyType !== (currentData.pixKeyType || 'CPF')) {
          orderDataUpdates.pixKeyType = pixKeyType;
        }
        if (recipientName !== (currentData.recipientName || '')) {
          orderDataUpdates.recipientName = recipientName;
        }
      } else {
        // BOLETO
        if (barcode !== (currentData.barcode || '')) {
          orderDataUpdates.barcode = barcode;
        }
        if (dueDate !== (currentData.dueDate || '')) {
          orderDataUpdates.dueDate = dueDate;
        }
        if (recipientName !== (currentData.recipientName || '')) {
          orderDataUpdates.recipientName = recipientName;
        }
        if (recipientDocument !== (currentData.recipientDocument || '')) {
          orderDataUpdates.recipientDocument = recipientDocument;
        }
      }

      if (Object.keys(orderDataUpdates).length > 0) {
        updates.orderData = orderDataUpdates;
      }

      await onConfirm(updates);
      onClose();
    } catch (error: any) {
      alert(error.message || 'Erro ao atualizar pedido');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            ✏️ Editar Pedido
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            <X size={24} />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-4 space-y-4">
          {/* Aviso Importante */}
          <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
            <p className="text-sm text-blue-800 dark:text-blue-300">
              <strong>💡 Importante:</strong> Você só pode editar pedidos que ainda não foram aceitos.
              Valores (BRL e Crypto) não podem ser alterados - para isso, cancele e crie um novo pedido.
            </p>
          </div>

          {/* Tempo de Expiração */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Tempo de Expiração (horas)
            </label>
            <input
              type="number"
              min="1"
              max="720"
              value={customExpirationHours}
              onChange={(e) => setCustomExpirationHours(parseInt(e.target.value) || 24)}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              disabled={isSubmitting}
            />
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              Entre 1 e 720 horas (1 a 30 dias)
            </p>
          </div>

          {/* Dados de Pagamento PIX */}
          {orderType === 'PIX' && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Tipo de Chave PIX
                </label>
                <select
                  value={pixKeyType}
                  onChange={(e) => setPixKeyType(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  disabled={isSubmitting}
                >
                  <option value="CPF">CPF</option>
                  <option value="CNPJ">CNPJ</option>
                  <option value="EMAIL">E-mail</option>
                  <option value="PHONE">Telefone</option>
                  <option value="RANDOM">Chave Aleatória</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Chave PIX
                </label>
                <input
                  type="text"
                  value={pixKey}
                  onChange={(e) => setPixKey(e.target.value)}
                  placeholder="Digite sua chave PIX..."
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  disabled={isSubmitting}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Nome do Beneficiário
                </label>
                <input
                  type="text"
                  value={recipientName}
                  onChange={(e) => setRecipientName(e.target.value)}
                  placeholder="Nome completo..."
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  disabled={isSubmitting}
                />
              </div>
            </>
          )}

          {/* Dados de Pagamento BOLETO */}
          {orderType === 'BOLETO' && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Código de Barras
                </label>
                <input
                  type="text"
                  value={barcode}
                  onChange={(e) => setBarcode(e.target.value)}
                  placeholder="Digite o código de barras..."
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono"
                  disabled={isSubmitting}
                />
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  Mínimo 44 caracteres
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Data de Vencimento
                </label>
                <input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  disabled={isSubmitting}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Nome do Beneficiário
                </label>
                <input
                  type="text"
                  value={recipientName}
                  onChange={(e) => setRecipientName(e.target.value)}
                  placeholder="Nome completo..."
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  disabled={isSubmitting}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  CPF/CNPJ do Beneficiário
                </label>
                <input
                  type="text"
                  value={recipientDocument}
                  onChange={(e) => setRecipientDocument(e.target.value)}
                  placeholder="Digite o CPF ou CNPJ..."
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  disabled={isSubmitting}
                />
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex flex-col-reverse sm:flex-row gap-3 sm:justify-end">
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="px-6 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleSubmit}
            disabled={!hasChanges || isSubmitting}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium transition-colors flex items-center justify-center gap-2"
          >
            {isSubmitting ? (
              <>
                <svg
                  className="animate-spin h-5 w-5"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  ></circle>
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  ></path>
                </svg>
                Salvando...
              </>
            ) : (
              '✏️ Salvar Alterações'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
