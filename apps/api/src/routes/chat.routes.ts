import { Router } from 'express';
import { chatController } from '../controllers/chat.controller';
import { authMiddleware, adminMiddleware } from '../middleware/auth.middleware';

const router = Router();

// Todas as rotas requerem autenticação
router.use(authMiddleware);

/**
 * @route   GET /api/v1/chat
 * @desc    Buscar todos os chats do usuário
 * @access  Private
 */
router.get('/', chatController.getUserChats.bind(chatController));

/**
 * @route   GET /api/v1/chat/unread-count
 * @desc    Contar chats com mensagens não lidas
 * @access  Private
 */
router.get('/unread-count', chatController.getUnreadChatsCount.bind(chatController));

/**
 * @route   GET /api/v1/chat/order/:orderId
 * @desc    Obter ou criar chat para um pedido
 * @access  Private
 */
router.get('/order/:orderId', chatController.getOrCreateChat.bind(chatController));

/**
 * @route   GET /api/v1/chat/:chatId
 * @desc    Buscar chat por ID
 * @access  Private
 */
router.get('/:chatId', chatController.getChatById.bind(chatController));

/**
 * @route   GET /api/v1/chat/:chatId/messages
 * @desc    Buscar mensagens do chat (com paginação)
 * @access  Private
 * @query   limit, before (message ID)
 */
router.get('/:chatId/messages', chatController.getMessages.bind(chatController));

/**
 * @route   POST /api/v1/chat/:chatId/messages
 * @desc    Enviar mensagem (REST fallback para quando WebSocket não está disponível)
 * @access  Private
 */
router.post('/:chatId/messages', chatController.sendMessage.bind(chatController));

/**
 * @route   POST /api/v1/chat/:chatId/read
 * @desc    Marcar mensagens como lidas
 * @access  Private
 */
router.post('/:chatId/read', chatController.markAsRead.bind(chatController));

// ============================================
// ADMIN ROUTES
// ============================================

/**
 * @route   POST /api/v1/chat/:chatId/deactivate
 * @desc    Desativar chat
 * @access  Admin
 */
router.post('/:chatId/deactivate', adminMiddleware, chatController.deactivateChat.bind(chatController));

export default router;
