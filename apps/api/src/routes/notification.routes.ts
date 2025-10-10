import { Router } from 'express';
import { notificationController } from '../controllers/notification.controller';
import { authMiddleware, adminMiddleware } from '../middleware/auth.middleware';

const router = Router();

// Todas as rotas requerem autenticação
router.use(authMiddleware);

/**
 * @route   GET /api/v1/notifications
 * @desc    Buscar notificações do usuário
 * @access  Private
 * @query   category, isRead, priority, limit, offset
 */
router.get('/', notificationController.getUserNotifications.bind(notificationController));

/**
 * @route   GET /api/v1/notifications/unread-count
 * @desc    Buscar contagem de notificações não lidas
 * @access  Private
 */
router.get('/unread-count', notificationController.getUnreadCount.bind(notificationController));

/**
 * @route   POST /api/v1/notifications/:notificationId/read
 * @desc    Marcar notificação como lida
 * @access  Private
 */
router.post('/:notificationId/read', notificationController.markAsRead.bind(notificationController));

/**
 * @route   POST /api/v1/notifications/mark-all-read
 * @desc    Marcar todas as notificações como lidas
 * @access  Private
 */
router.post('/mark-all-read', notificationController.markAllAsRead.bind(notificationController));

/**
 * @route   DELETE /api/v1/notifications/:notificationId
 * @desc    Deletar notificação
 * @access  Private
 */
router.delete('/:notificationId', notificationController.deleteNotification.bind(notificationController));

/**
 * @route   DELETE /api/v1/notifications/delete-all-read
 * @desc    Deletar todas as notificações lidas
 * @access  Private
 */
router.delete('/delete-all-read', notificationController.deleteAllRead.bind(notificationController));

// ============================================
// ADMIN ROUTES
// ============================================

/**
 * @route   POST /api/v1/notifications/broadcast
 * @desc    Enviar notificação para múltiplos usuários
 * @access  Admin
 */
router.post('/broadcast', adminMiddleware, notificationController.broadcastNotification.bind(notificationController));

/**
 * @route   POST /api/v1/notifications/system-announcement
 * @desc    Enviar anúncio do sistema para todos os usuários
 * @access  Admin
 */
router.post('/system-announcement', adminMiddleware, notificationController.sendSystemAnnouncement.bind(notificationController));

export default router;
