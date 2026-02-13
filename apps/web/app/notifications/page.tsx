'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useNotifications, NotificationFilters } from '@/hooks/useNotifications';
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
  Filter,
  Loader2,
} from 'lucide-react';

export default function NotificationsPage() {
  const router = useRouter();
  const [filters, setFilters] = useState<NotificationFilters>({});
  const [showFilters, setShowFilters] = useState(false);

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
  } = useNotifications(filters, 20);

  const categoryIcons: Record<string, any> = {
    ORDER: ShoppingCart,
    TRANSACTION: CreditCard,
    DISPUTE: AlertCircle,
    REVIEW: Star,
    WALLET: Wallet,
    LIMIT: UserCheck,
    SYSTEM: Bell,
  };

  const priorityColors: Record<string, string> = {
    URGENT: 'border-red-500 bg-red-50',
    HIGH: 'border-orange-500 bg-orange-50',
    NORMAL: 'border-blue-500 bg-blue-50',
    LOW: 'border-gray-400 bg-gray-50',
  };

  const priorityBadges: Record<string, string> = {
    URGENT: 'bg-red-100 text-red-800',
    HIGH: 'bg-orange-100 text-orange-800',
    NORMAL: 'bg-blue-100 text-blue-800',
    LOW: 'bg-gray-100 text-gray-800',
  };

  const handleNotificationClick = async (notification: any) => {
    if (!notification.isRead) {
      await markAsRead(notification.id);
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
    <div className="min-h-screen bg-gray-50 p-4 md:p-8">
      <div className="max-w-6xl mx-auto">
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Notificações</h1>
              <p className="text-gray-600 mt-1">
                {total} {total === 1 ? 'notificação' : 'notificações'}{' '}
                {unreadCount > 0 && `· ${unreadCount} não ${unreadCount === 1 ? 'lida' : 'lidas'}`}
              </p>
            </div>

            <div className="flex gap-3 flex-wrap">
              <button
                onClick={() => setShowFilters(!showFilters)}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center gap-2"
              >
                <Filter size={18} />
                Filtros
              </button>

              {unreadCount > 0 && (
                <button
                  onClick={markAllAsRead}
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

          {showFilters && (
            <div className="mt-6 pt-6 border-t border-gray-200">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Categoria</label>
                  <select
                    value={filters.category || ''}
                    onChange={(e) => setFilters({ ...filters, category: e.target.value || undefined })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Todas</option>
                    <option value="ORDER">Pedidos</option>
                    <option value="TRANSACTION">Transações</option>
                    <option value="DISPUTE">Disputas</option>
                    <option value="REVIEW">Avaliacoes</option>
                    <option value="WALLET">Carteira</option>
                    <option value="LIMIT">Limites</option>
                    <option value="SYSTEM">Sistema</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
                  <select
                    value={filters.isRead === undefined ? 'all' : filters.isRead ? 'read' : 'unread'}
                    onChange={(e) => {
                      const value = e.target.value;
                      setFilters({
                        ...filters,
                        isRead: value === 'all' ? undefined : value === 'read',
                      });
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="all">Todas</option>
                    <option value="unread">Não lidas</option>
                    <option value="read">Lidas</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Prioridade</label>
                  <select
                    value={filters.priority || ''}
                    onChange={(e) => setFilters({ ...filters, priority: e.target.value || undefined })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Todas</option>
                    <option value="URGENT">Urgente</option>
                    <option value="HIGH">Alta</option>
                    <option value="NORMAL">Normal</option>
                    <option value="LOW">Baixa</option>
                  </select>
                </div>
              </div>
            </div>
          )}
        </div>

        {loading && notifications.length === 0 ? (
          <NotificationListSkeleton count={5} />
        ) : notifications.length === 0 ? (
          <div className="bg-white rounded-lg shadow-sm p-12 text-center">
            <Bell className="mx-auto mb-4 text-gray-300" size={64} />
            <h3 className="text-xl font-semibold text-gray-900 mb-2">Nenhuma notificação</h3>
            <p className="text-gray-600">
              {Object.keys(filters).length > 0
                ? 'Nenhuma notificação corresponde aos filtros selecionados.'
                : 'Você não tem notificações no momento.'}
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
                  className={`bg-white rounded-lg shadow-sm border-l-4 ${borderColor} ${
                    notification.actionUrl ? 'cursor-pointer hover:shadow-md' : ''
                  } transition-all duration-200 ${!notification.isRead ? 'ring-2 ring-blue-200' : ''}`}
                  onClick={() => notification.actionUrl && handleNotificationClick(notification)}
                >
                  <div className="p-6">
                    <div className="flex items-start gap-4">
                      <div className={`flex-shrink-0 w-12 h-12 rounded-full ${borderColor} flex items-center justify-center`}>
                        <IconComponent size={24} className="text-gray-700" />
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-4 mb-2">
                          <h3 className="text-lg font-semibold text-gray-900">{notification.title}</h3>
                          <span className="text-sm text-gray-500 whitespace-nowrap">
                            {formatDate(notification.createdAt)}
                          </span>
                        </div>

                        <p className="text-gray-700 mb-3">{notification.message}</p>

                        <div className="flex flex-wrap items-center gap-3">
                          <span className={`px-3 py-1 rounded-full text-xs font-medium ${badgeColor}`}>
                            {notification.priority}
                          </span>

                          <span className="px-3 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-700">
                            {notification.category}
                          </span>

                          {!notification.isRead && (
                            <span className="px-3 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
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
                              markAsRead(notification.id);
                            }}
                            className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            title="Marcar como lida"
                          >
                            <Check size={20} />
                          </button>
                        )}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (confirm('Deseja realmente deletar esta notificação?')) {
                              deleteNotification(notification.id);
                            }
                          }}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
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
