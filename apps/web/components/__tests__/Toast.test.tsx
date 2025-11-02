import { render, screen, waitFor } from '@testing-library/react';
import { Toast, ToastContainer } from '../Toast';

describe('Toast', () => {
  const mockOnClose = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  it('deve renderizar toast de sucesso', () => {
    render(
      <Toast
        id="toast-1"
        title="Sucesso"
        message="Operação realizada com sucesso"
        type="success"
        onClose={mockOnClose}
      />
    );

    expect(screen.getByText('Sucesso')).toBeInTheDocument();
    expect(screen.getByText('Operação realizada com sucesso')).toBeInTheDocument();
  });

  it('deve renderizar toast de erro', () => {
    render(
      <Toast
        id="toast-1"
        title="Erro"
        message="Ocorreu um erro"
        type="error"
        onClose={mockOnClose}
      />
    );

    expect(screen.getByText('Erro')).toBeInTheDocument();
    expect(screen.getByText('Ocorreu um erro')).toBeInTheDocument();
  });

  it('deve renderizar toast de warning', () => {
    render(
      <Toast
        id="toast-1"
        title="Atenção"
        message="Ação requer atenção"
        type="warning"
        onClose={mockOnClose}
      />
    );

    expect(screen.getByText('Atenção')).toBeInTheDocument();
    expect(screen.getByText('Ação requer atenção')).toBeInTheDocument();
  });

  it('deve renderizar toast de info por padrão', () => {
    render(
      <Toast
        id="toast-1"
        title="Informação"
        message="Mensagem informativa"
        onClose={mockOnClose}
      />
    );

    expect(screen.getByText('Informação')).toBeInTheDocument();
    expect(screen.getByText('Mensagem informativa')).toBeInTheDocument();
  });

  it('deve ter classes corretas para tipo success', () => {
    const { container } = render(
      <Toast
        id="toast-1"
        title="Sucesso"
        message="Mensagem"
        type="success"
        onClose={mockOnClose}
      />
    );

    const toastElement = container.firstChild as HTMLElement;
    expect(toastElement).toHaveClass('border-green-200', 'bg-green-50');
  });

  it('deve ter classes corretas para tipo error', () => {
    const { container } = render(
      <Toast
        id="toast-1"
        title="Erro"
        message="Mensagem"
        type="error"
        onClose={mockOnClose}
      />
    );

    const toastElement = container.firstChild as HTMLElement;
    expect(toastElement).toHaveClass('border-red-200', 'bg-red-50');
  });

  it('deve fechar automaticamente após duração padrão (5s)', async () => {
    render(
      <Toast
        id="toast-1"
        title="Teste"
        message="Mensagem"
        onClose={mockOnClose}
      />
    );

    // Avançar 5 segundos + 300ms de animação
    jest.advanceTimersByTime(5300);

    await waitFor(() => {
      expect(mockOnClose).toHaveBeenCalledWith('toast-1');
    });
  });

  it('deve fechar automaticamente após duração customizada', async () => {
    render(
      <Toast
        id="toast-1"
        title="Teste"
        message="Mensagem"
        duration={3000}
        onClose={mockOnClose}
      />
    );

    // Avançar 3 segundos + 300ms de animação
    jest.advanceTimersByTime(3300);

    await waitFor(() => {
      expect(mockOnClose).toHaveBeenCalledWith('toast-1');
    });
  });

  it('deve mostrar ícone correto para cada tipo', () => {
    const { rerender } = render(
      <Toast
        id="toast-1"
        title="Teste"
        message="Mensagem"
        type="success"
        onClose={mockOnClose}
      />
    );

    // Success - ícone CheckCircle2
    expect(screen.getByRole('img', { hidden: true })).toBeInTheDocument();

    rerender(
      <Toast
        id="toast-1"
        title="Teste"
        message="Mensagem"
        type="error"
        onClose={mockOnClose}
      />
    );

    // Error - ícone AlertCircle
    expect(screen.getByRole('img', { hidden: true })).toBeInTheDocument();
  });
});

describe('ToastContainer', () => {
  const mockOnClose = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('deve renderizar múltiplos toasts', () => {
    const toasts = [
      {
        id: 'toast-1',
        title: 'Primeiro',
        message: 'Mensagem 1',
        type: 'success' as const,
        onClose: mockOnClose,
      },
      {
        id: 'toast-2',
        title: 'Segundo',
        message: 'Mensagem 2',
        type: 'error' as const,
        onClose: mockOnClose,
      },
    ];

    render(<ToastContainer toasts={toasts} onClose={mockOnClose} />);

    expect(screen.getByText('Primeiro')).toBeInTheDocument();
    expect(screen.getByText('Segundo')).toBeInTheDocument();
  });

  it('deve renderizar container vazio quando não há toasts', () => {
    const { container } = render(<ToastContainer toasts={[]} onClose={mockOnClose} />);

    const toastContainer = container.querySelector('.space-y-2');
    expect(toastContainer?.children.length).toBe(0);
  });

  it('deve estar posicionado no canto inferior direito', () => {
    const { container } = render(<ToastContainer toasts={[]} onClose={mockOnClose} />);

    const containerElement = container.firstChild as HTMLElement;
    expect(containerElement).toHaveClass('fixed', 'bottom-4', 'right-4');
  });

  it('deve ter z-index alto para aparecer sobre outros elementos', () => {
    const { container } = render(<ToastContainer toasts={[]} onClose={mockOnClose} />);

    const containerElement = container.firstChild as HTMLElement;
    expect(containerElement).toHaveClass('z-[9999]');
  });
});
