const actionLabels: Record<string, string> = {
  // Auth
  'LOGIN': 'Login',
  'LOGOUT': 'Logout',
  'REGISTER': 'Cadastro',
  'REFRESH_TOKEN': 'Renovação de Token',
  // KYC
  'KYC_SUBMIT': 'Envio de KYC',
  'KYC_APPROVE': 'Aprovação de KYC',
  'KYC_REJECT': 'Rejeição de KYC',
  // Pedidos
  'ORDER_CREATE': 'Criação de Pedido',
  'ORDER_MATCH': 'Match de Pedido',
  'ORDER_CANCEL': 'Cancelamento de Pedido',
  'ORDER_COMPLETED': 'Pedido Concluído',
  'CANCEL_ORDER': 'Cancelamento de Pedido (Admin)',
  'EDIT_ORDER': 'Edição de Pedido (Admin)',
  // Transações
  'TRANSACTION_SUBMIT_PROOF': 'Envio de Comprovante',
  'TRANSACTION_VALIDATE': 'Validação de Transação',
  'TRANSACTION_DISPUTE': 'Disputa de Transação',
  'CRYPTO_TRANSFER': 'Transferência Cripto',
  // Negociação
  'NEGOTIATION_STARTED': 'Negociação Iniciada',
  'NEGOTIATION_CANCELLED': 'Negociação Cancelada',
  // Presença
  'PRESENCE_ONLINE': 'Usuário Online',
  'PRESENCE_OFFLINE': 'Usuário Offline',
  // Carteiras
  'WALLET_CREATE': 'Criação de Carteira',
  'WALLET_DEPOSIT': 'Depósito',
  'WALLET_WITHDRAWAL': 'Saque',
  // Fundos Admin
  'FREEZE_ACCOUNT': 'Congelar Conta',
  'UNFREEZE_ACCOUNT': 'Descongelar Conta',
  'AUTO_UNFREEZE_ACCOUNT': 'Descongelamento Automático',
  'INTERNAL_TRANSFER': 'Transferência Interna',
  'BALANCE_ADJUSTMENT': 'Ajuste de Saldo',
  'PLATFORM_REFUND': 'Reembolso Plataforma',
  'PLATFORM_COLLECT': 'Cobrança Plataforma',
  'ADMIN_LOCK_BALANCE': 'Bloqueio de Saldo',
  'ADMIN_UNLOCK_BALANCE': 'Desbloqueio de Saldo',
  // Transferências Plataforma
  'PLATFORM_TRANSFER_COMPLETED': 'Transferência Plataforma Concluída',
  'PLATFORM_TRANSFER_FAILED': 'Transferência Plataforma Falhou',
  // Master Seed
  'MASTER_SEED_CREATED': 'Master Seed Criada',
  'MASTER_SEED_KEY_ROTATED': 'Rotação de Chave Master',
  // Colateral
  'COLLATERAL_RELEASED': 'Colateral Liberado',
  'ORPHANED_COLLATERAL_DETECTED': 'Colateral Órfão Detectado',
  // Roles
  'ROLE_CREATE': 'Criação de Role',
  'ROLE_UPDATE': 'Atualização de Role',
  'ROLE_DELETE': 'Exclusão de Role',
  'ROLE_PERMISSION_ASSIGN': 'Atribuição de Permissão',
  'ROLE_PERMISSION_REMOVE': 'Remoção de Permissão',
  'ROLE_PERMISSION_UPDATE': 'Atualização de Permissão',
  'USER_ROLE_CHANGE': 'Alteração de Role',
  'UPDATE_USER_ROLE': 'Alteração de Role',
  // Usuários
  'UPDATE_USER': 'Atualização de Usuário',
  'SET_CUSTOM_LIMIT': 'Definição de Limite',
  'ADMIN_RESET_USER_PASSWORD': 'Reset de Senha (Admin)',
  'ADMIN_RESET_PASSWORD': 'Reset de Senha',
  // Suporte
  'SUPPORT_TICKET_CREATE': 'Abertura de Chamado',
  'SUPPORT_TICKET_REPLY': 'Resposta de Chamado',
  'SUPPORT_TICKET_RESOLVE': 'Resolução de Chamado',
  'SUPPORT_TICKET_CLOSE': 'Fechamento de Chamado',
  // CRUD Genérico
  'CREATE': 'Criação',
  'UPDATE': 'Atualização',
  'DELETE': 'Exclusão',
  // Outros
  'ADMIN_ACTION': 'Ação Admin',
  'UPDATE_COUPON': 'Atualização de Cupom',
};

const resourceLabels: Record<string, string> = {
  'USER': 'Usuário',
  'ORDER': 'Pedido',
  'TRANSACTION': 'Transação',
  'WALLET': 'Carteira',
  'PLATFORM_WALLET': 'Carteira Plataforma',
  'KYC': 'KYC',
  'ROLE': 'Role',
  'PERMISSION': 'Permissão',
  'SUPPORT_TICKET': 'Chamado',
  'COUPON': 'Cupom',
  'MASTER_SEED': 'Master Seed',
  'PLATFORM_TRANSFER': 'Transferência Plataforma',
  'User': 'Usuário',
};

export function formatActionLabel(action: string): string {
  if (actionLabels[action]) return actionLabels[action];
  return action.replace(/_/g, ' ').toLowerCase().replace(/^\w/, c => c.toUpperCase());
}

export function formatResourceLabel(resource: string): string {
  if (resourceLabels[resource]) return resourceLabels[resource];
  return resource.replace(/_/g, ' ').toLowerCase().replace(/^\w/, c => c.toUpperCase());
}
