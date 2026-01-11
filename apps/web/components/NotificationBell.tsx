'use client';

import { useState, useEffect } from 'react';
import { useNotificationContext } from '@/providers/NotificationProvider';
import { useRouter } from 'next/navigation';
import { normalizeNotificationUrl } from '@/utils/notificationUtils';

export function NotificationBell() {
  const { notifications, unreadCount, setNotifications, setUnreadCount } = useNotificationContext();
  const [isOpen, setIsOpen] = useState(false);
  const router = useRouter();

  // Carregar notificações iniciais (apenas uma vez)
  useEffect(() => {
    const fetchInitialNotifications = async () => {
      try {
        // FIX: Guard de browser API para evitar erro SSR
        if (typeof window === 'undefined') return;

        const token = localStorage.getItem('accessToken');
        if (!token) return;

        const response = await fetch('http://localhost:3001/api/v1/notifications?limit=10', {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (response.ok) {
          const data = await response.json();
          setNotifications(data.data.notifications || []);
          setUnreadCount(data.data.unreadCount || 0);
        }
      } catch (error) {
        console.error('Failed to fetch initial notifications:', error);
      }
    };

    fetchInitialNotifications();
  }, [setNotifications, setUnreadCount]);

  const handleNotificationClick = async (notification: any) => {
    // Marcar como lida via API (vai emitir WebSocket event que atualiza o context)
    if (!notification.isRead) {
      try {
        const token = localStorage.getItem('accessToken');
        await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001/api/v1"}/notifications/${notification.id}/read`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
        });
      } catch (error) {
        console.error('Failed to mark notification as read:', error);
      }
    }

    setIsOpen(false);

    if (notification.actionUrl) {
      const normalizedUrl = normalizeNotificationUrl(notification.actionUrl);
      router.push(normalizedUrl);
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      const token = localStorage.getItem('accessToken');
      await fetch('http://localhost:3001/api/v1/notifications/mark-all-read', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
    } catch (error) {
      console.error('Failed to mark all as read:', error);
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'URGENT': return 'bg-red-100 border-red-300';
      case 'HIGH': return 'bg-orange-100 border-orange-300';
      case 'NORMAL': return 'bg-blue-100 border-blue-300';
      case 'LOW': return 'bg-gray-100 border-gray-300';
      default: return 'bg-gray-100 border-gray-300';
    }
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 text-gray-700 hover:bg-gray-100 rounded-full"
      >
        🔔
        {unreadCount > 0 && (
          <span className="absolute top-0 right-0 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-96 bg-white rounded-lg shadow-xl border border-gray-200 z-50">
          <div className="p-4 border-b border-gray-200 flex justify-between items-center">
            <h3 className="font-semibold text-gray-900">Notificações</h3>
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllAsRead}
                className="text-sm text-blue-600 hover:text-blue-800"
              >
                Marcar todas como lidas
              </button>
            )}
          </div>

          <div className="max-h-96 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                Nenhuma notificação
              </div>
            ) : (
              notifications.map((notif) => (
                <div
                  key={notif.id}
                  onClick={() => handleNotificationClick(notif)}
                  className={`p-4 border-b border-gray-100 cursor-pointer hover:bg-gray-50 ${
                    !notif.isRead ? 'bg-blue-50' : ''
                  } ${getPriorityColor(notif.priority)}`}
                >
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <h4 className="font-medium text-gray-900 text-sm">
                        {notif.title}
                      </h4>
                      <p className="text-gray-600 text-sm mt-1">
                        {notif.message}
                      </p>
                      {notif.actionLabel && (
                        <button className="text-blue-600 text-sm mt-2 hover:text-blue-800">
                          {notif.actionLabel} →
                        </button>
                      )}
                    </div>
                    {!notif.isRead && (
                      <span className="w-2 h-2 bg-blue-600 rounded-full mt-1 ml-2"></span>
                    )}
                  </div>
                  <p className="text-xs text-gray-400 mt-2">
                    {new Date(notif.createdAt).toLocaleString('pt-BR')}
                  </p>
                </div>
              ))
            )}
          </div>

          {notifications.length > 0 && (
            <div className="p-3 border-t border-gray-200 text-center">
              <button
                onClick={() => {
                  setIsOpen(false);
                  router.push('/notifications');
                }}
                className="text-sm text-blue-600 hover:text-blue-800"
              >
                Ver todas as notificações
              </button>
            </div>
          )}
        </div>
      )}

      {isOpen && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setIsOpen(false)}
        ></div>
      )}
    </div>
  );
}
