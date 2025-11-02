import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { NotificationBell } from '../NotificationBell';
import { NotificationProvider } from '@/providers/NotificationProvider';
import { ToastProvider } from '@/hooks/useToast';

// Mock do router
const mockPush = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}));

// Wrapper com providers necessários
const Wrapper = ({ children }: { children: React.ReactNode }) => (
  <ToastProvider>
    <NotificationProvider>{children}</NotificationProvider>
  </ToastProvider>
);

describe('NotificationBell', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (global.fetch as jest.Mock).mockClear();
    localStorage.getItem = jest.fn(() => 'mock-token');
  });

  it('deve renderizar o sino de notificações', () => {
    render(
      <Wrapper>
        <NotificationBell />
      </Wrapper>
    );

    const bell = screen.getByRole('button');
    expect(bell).toBeInTheDocument();
    expect(bell).toHaveTextContent('🔔');
  });

  it('deve mostrar badge com contador de não lidas', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: {
          notifications: [],
          unreadCount: 5,
        },
      }),
    });

    render(
      <Wrapper>
        <NotificationBell />
      </Wrapper>
    );

    await waitFor(() => {
      const badge = screen.getByText('5');
      expect(badge).toBeInTheDocument();
    });
  });

  it('deve mostrar "9+" quando há mais de 9 não lidas', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: {
          notifications: [],
          unreadCount: 15,
        },
      }),
    });

    render(
      <Wrapper>
        <NotificationBell />
      </Wrapper>
    );

    await waitFor(() => {
      const badge = screen.getByText('9+');
      expect(badge).toBeInTheDocument();
    });
  });

  it('deve abrir dropdown ao clicar no sino', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: {
          notifications: [
            {
              id: '1',
              title: 'Teste',
              message: 'Mensagem de teste',
              priority: 'NORMAL',
              isRead: false,
              createdAt: new Date().toISOString(),
            },
          ],
          unreadCount: 1,
        },
      }),
    });

    render(
      <Wrapper>
        <NotificationBell />
      </Wrapper>
    );

    const bell = screen.getByRole('button');
    fireEvent.click(bell);

    await waitFor(() => {
      expect(screen.getByText('Notificações')).toBeInTheDocument();
    });
  });

  it('deve mostrar mensagem quando não há notificações', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: {
          notifications: [],
          unreadCount: 0,
        },
      }),
    });

    render(
      <Wrapper>
        <NotificationBell />
      </Wrapper>
    );

    const bell = screen.getByRole('button');
    fireEvent.click(bell);

    await waitFor(() => {
      expect(screen.getByText('Nenhuma notificação')).toBeInTheDocument();
    });
  });

  it('deve listar notificações no dropdown', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: {
          notifications: [
            {
              id: '1',
              title: 'Pedido Pareado',
              message: 'Seu pedido foi pareado',
              priority: 'HIGH',
              isRead: false,
              createdAt: new Date().toISOString(),
            },
            {
              id: '2',
              title: 'Pagamento Confirmado',
              message: 'Pagamento foi confirmado',
              priority: 'NORMAL',
              isRead: true,
              createdAt: new Date().toISOString(),
            },
          ],
          unreadCount: 1,
        },
      }),
    });

    render(
      <Wrapper>
        <NotificationBell />
      </Wrapper>
    );

    const bell = screen.getByRole('button');
    fireEvent.click(bell);

    await waitFor(() => {
      expect(screen.getByText('Pedido Pareado')).toBeInTheDocument();
      expect(screen.getByText('Pagamento Confirmado')).toBeInTheDocument();
    });
  });

  it('deve navegar ao clicar em notificação com actionUrl', async () => {
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            notifications: [
              {
                id: '1',
                title: 'Teste',
                message: 'Mensagem',
                priority: 'NORMAL',
                isRead: false,
                actionUrl: '/orders/123',
                createdAt: new Date().toISOString(),
              },
            ],
            unreadCount: 1,
          },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
      });

    render(
      <Wrapper>
        <NotificationBell />
      </Wrapper>
    );

    const bell = screen.getByRole('button');
    fireEvent.click(bell);

    await waitFor(() => {
      const notification = screen.getByText('Teste');
      fireEvent.click(notification);
    });

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/orders/123');
    });
  });

  it('deve mostrar botão "Marcar todas como lidas" quando há não lidas', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: {
          notifications: [
            {
              id: '1',
              title: 'Teste',
              message: 'Mensagem',
              priority: 'NORMAL',
              isRead: false,
              createdAt: new Date().toISOString(),
            },
          ],
          unreadCount: 1,
        },
      }),
    });

    render(
      <Wrapper>
        <NotificationBell />
      </Wrapper>
    );

    const bell = screen.getByRole('button');
    fireEvent.click(bell);

    await waitFor(() => {
      expect(screen.getByText('Marcar todas como lidas')).toBeInTheDocument();
    });
  });

  it('deve chamar API ao marcar todas como lidas', async () => {
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            notifications: [
              {
                id: '1',
                title: 'Teste',
                message: 'Mensagem',
                priority: 'NORMAL',
                isRead: false,
                createdAt: new Date().toISOString(),
              },
            ],
            unreadCount: 1,
          },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
      });

    render(
      <Wrapper>
        <NotificationBell />
      </Wrapper>
    );

    const bell = screen.getByRole('button');
    fireEvent.click(bell);

    await waitFor(() => {
      const markAllButton = screen.getByText('Marcar todas como lidas');
      fireEvent.click(markAllButton);
    });

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        'http://localhost:3001/api/v1/notifications/read-all',
        expect.objectContaining({
          method: 'PATCH',
        })
      );
    });
  });

  it('deve mostrar link "Ver todas as notificações"', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: {
          notifications: [
            {
              id: '1',
              title: 'Teste',
              message: 'Mensagem',
              priority: 'NORMAL',
              isRead: false,
              createdAt: new Date().toISOString(),
            },
          ],
          unreadCount: 1,
        },
      }),
    });

    render(
      <Wrapper>
        <NotificationBell />
      </Wrapper>
    );

    const bell = screen.getByRole('button');
    fireEvent.click(bell);

    await waitFor(() => {
      expect(screen.getByText('Ver todas as notificações')).toBeInTheDocument();
    });
  });

  it('deve navegar para /notifications ao clicar em "Ver todas"', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: {
          notifications: [
            {
              id: '1',
              title: 'Teste',
              message: 'Mensagem',
              priority: 'NORMAL',
              isRead: false,
              createdAt: new Date().toISOString(),
            },
          ],
          unreadCount: 1,
        },
      }),
    });

    render(
      <Wrapper>
        <NotificationBell />
      </Wrapper>
    );

    const bell = screen.getByRole('button');
    fireEvent.click(bell);

    await waitFor(() => {
      const viewAllButton = screen.getByText('Ver todas as notificações');
      fireEvent.click(viewAllButton);
    });

    expect(mockPush).toHaveBeenCalledWith('/notifications');
  });

  it('deve fechar dropdown ao clicar fora', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: {
          notifications: [],
          unreadCount: 0,
        },
      }),
    });

    render(
      <Wrapper>
        <NotificationBell />
      </Wrapper>
    );

    const bell = screen.getByRole('button');
    fireEvent.click(bell);

    await waitFor(() => {
      expect(screen.getByText('Notificações')).toBeInTheDocument();
    });

    // Clicar no backdrop (fora do dropdown)
    const backdrop = document.querySelector('.fixed.inset-0');
    if (backdrop) {
      fireEvent.click(backdrop);
    }

    await waitFor(() => {
      expect(screen.queryByText('Notificações')).not.toBeInTheDocument();
    });
  });
});
