'use client';

import { useRouter } from 'next/navigation';
import { useNotifications } from '@/hooks/useNotifications';
import { useNotificationContext } from '@/providers/NotificationProvider';
import { normalizeNotificationUrl } from '@/utils/notificationUtils';
import { NotificationListSkeleton } from '@/components/NotificationSkeleton';
import {
  Bell,
  ShoppingCart,
  CreditCard,
  AlertCircle,
  Star,
  Wallet,
  UserCheck,
  Trash2,
  Check,
  ArrowLeft,
} from 'lucide-react';

export default function NotificationsPage() {
  const router = useRouter();

  const {
    notifications,
    unreadCount,
    total,
    loading,
    hasMore,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    deleteAllRead,
    loadMore,
  } = useNotifications(undefined, 20);

  const {
    markAsRead: contextMarkAsRead,
    markAllAsRead: contextMarkAllAsRead,
    removeNotification: contextRemoveNotification,
  } = useNotificationContext();

  const handleMarkAsRead = async (id: string) => {
    await markAsRead(id);
    contextMarkAsRead(id);
  };

  const handleMarkAllAsRead = async () => {
    await markAllAsRead();
    contextMarkAllAsRead();
  };

  const handleDeleteNotification = async (id: string) => {
    await deleteNotification(id);
    contextRemoveNotification(id);
  };

  const categoryIcons: Record<string, any> = {
    ORDER: ShoppingCart,
    TRANSACTION: CreditCard,
    DISPUTE: AlertCircle,
    REVIEW: Star,
    WALLET: Wallet,
    KYC: UserCheck,
    LIMIT: Bell,
    SYSTEM: Bell,
  };

  const priorityColors: Record<string, string> = {
    URGENT: 'border-red-500 bg-red-50 dark:bg-red-900/20',
    HIGH: 'border-orange-500 bg-orange-50 dark:bg-orange-900/20',
    NORMAL: 'border-blue-500 bg-blue-50 dark:bg-blue-900/20',
    LOW: 'border-gray-400 bg-gray-50 dark:bg-gray-700',
  };

  const priorityBadges: Record<string, string> = {
    URGENT: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
    HIGH: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400',
    NORMAL: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
    LOW: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300',
  };

  const handleNotificationClick = async (notification: any) => {
    if (!notification.isRead) {
      await handleMarkAsRead(notification.id);
    }
    if (notification.actionUrl) {
      const normalizedUrl = normalizeNotificationUrl(notification.actionUrl);
      router.push(normalizedUrl);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'Agora';
    if (diffMins < 60) return `há ${diffMins} min`;
    if (diffHours < 24) return `há ${diffHours}h`;
    if (diffDays < 7) return `há ${diffDays}d`;
    return date.toLocaleDateString('pt-BR');
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4 md:p-8">
      <div className="max-w-6xl mx-auto">
        <button
          onClick={() => router.back()}
          className="flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white mb-6 transition-colors"
        >
          <ArrowLeft size={20} />
          Voltar
        </button>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6 mb-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Notificações</h1>
              <p className="text-gray-600 dark:text-gray-400 mt-1">
                {total} {total === 1 ? 'notificação' : 'notificações'}{' '}
                {unreadCount > 0 && `· ${unreadCount} não ${unreadCount === 1 ? 'lida' : 'lidas'}`}
              </p>
            </div>

            <div className="flex gap-3 flex-wrap">
              {unreadCount > 0 && (
                <button
                  onClick={handleMarkAllAsRead}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
                >
                  <Check size={18} />
                  Marcar todas como lidas
                </button>
              )}

              {notifications.some(n => n.isRead) && (
                <button
                  onClick={deleteAllRead}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 flex items-center gap-2"
                >
                  <Trash2 size={18} />
                  Deletar lidas
                </button>
              )}
            </div>
          </div>
        </div>

        {loading && notifications.length === 0 ? (
          <NotificationListSkeleton count={5} />
        ) : notifications.length === 0 ? (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-12 text-center">
            <Bell className="mx-auto mb-4 text-gray-300 dark:text-gray-600" size={64} />
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">Nenhuma notificação</h3>
            <p className="text-gray-600 dark:text-gray-400">
              Você não tem notificações no momento.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {notifications.map((notification) => {
              const IconComponent = categoryIcons[notification.category] || Bell;
              const borderColor = priorityColors[notification.priority] || priorityColors.NORMAL;
              const badgeColor = priorityBadges[notification.priority] || priorityBadges.NORMAL;

              return (
                <div
                  key={notification.id}
                  className={`bg-white dark:bg-gray-800 rounded-lg shadow-sm border-l-4 ${borderColor} ${
                    notification.actionUrl ? 'cursor-pointer hover:shadow-md' : ''
                  } transition-all duration-200 ${!notification.isRead ? 'ring-2 ring-blue-200 dark:ring-blue-800' : ''}`}
                  onClick={() => notification.actionUrl && handleNotificationClick(notification)}
                >
                  <div className="p-6">
                    <div className="flex items-start gap-4">
                      <div className={`flex-shrink-0 w-12 h-12 rounded-full ${borderColor} flex items-center justify-center`}>
                        <IconComponent size={24} className="text-gray-700 dark:text-gray-300" />
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-4 mb-2">
                          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{notification.title}</h3>
                          <span className="text-sm text-gray-500 dark:text-gray-400 whitespace-nowrap">
                            {formatDate(notification.createdAt)}
                          </span>
                        </div>

                        <p className="text-gray-700 dark:text-gray-300 mb-3">{notification.message}</p>

                        <div className="flex flex-wrap items-center gap-3">
                          <span className={`px-3 py-1 rounded-full text-xs font-medium ${badgeColor}`}>
                            {notification.priority}
                          </span>

                          <span className="px-3 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300">
                            {notification.category}
                          </span>

                          {!notification.isRead && (
                            <span className="px-3 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                              Não lida
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex-shrink-0 flex gap-2">
                        {!notification.isRead && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleMarkAsRead(notification.id);
                            }}
                            className="p-2 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg transition-colors"
                            title="Marcar como lida"
                          >
                            <Check size={20} />
                          </button>
                        )}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (confirm('Deseja realmente deletar esta notificação?')) {
                              handleDeleteNotification(notification.id);
                            }
                          }}
                          className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors"
                          title="Deletar"
                        >
                          <Trash2 size={20} />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}

            {hasMore && (
              <div className="text-center pt-6">
                <button
                  onClick={loadMore}
                  className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Carregar mais
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
