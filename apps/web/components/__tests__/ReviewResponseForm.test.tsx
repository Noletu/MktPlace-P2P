import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ReviewResponseForm } from '../ReviewResponseForm';

describe('ReviewResponseForm', () => {
  const mockOnSuccess = jest.fn();
  const mockOnCancel = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    (global.fetch as jest.Mock).mockClear();
    localStorage.getItem = jest.fn(() => 'mock-token');
  });

  it('deve renderizar o formulário', () => {
    render(<ReviewResponseForm reviewId="review-1" />);

    expect(screen.getByLabelText('Sua Resposta')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Escreva sua resposta à avaliação...')).toBeInTheDocument();
    expect(screen.getByText('Enviar Resposta')).toBeInTheDocument();
  });

  it('deve mostrar contador de caracteres', () => {
    render(<ReviewResponseForm reviewId="review-1" />);

    expect(screen.getByText('Máximo 500 caracteres')).toBeInTheDocument();
    expect(screen.getByText('500 restantes')).toBeInTheDocument();
  });

  it('deve atualizar contador ao digitar', () => {
    render(<ReviewResponseForm reviewId="review-1" />);

    const textarea = screen.getByPlaceholderText('Escreva sua resposta à avaliação...');
    fireEvent.change(textarea, { target: { value: 'Obrigado!' } });

    expect(screen.getByText('490 restantes')).toBeInTheDocument();
  });

  it('deve mostrar warning quando restam menos de 50 caracteres', () => {
    render(<ReviewResponseForm reviewId="review-1" />);

    const textarea = screen.getByPlaceholderText('Escreva sua resposta à avaliação...');
    const longText = 'a'.repeat(460);
    fireEvent.change(textarea, { target: { value: longText } });

    const remaining = screen.getByText('40 restantes');
    expect(remaining).toHaveClass('text-orange-600');
  });

  it('deve desabilitar botão enviar quando textarea está vazio', () => {
    render(<ReviewResponseForm reviewId="review-1" />);

    const submitButton = screen.getByText('Enviar Resposta');
    expect(submitButton).toBeDisabled();
  });

  it('deve habilitar botão enviar quando há texto', () => {
    render(<ReviewResponseForm reviewId="review-1" />);

    const textarea = screen.getByPlaceholderText('Escreva sua resposta à avaliação...');
    fireEvent.change(textarea, { target: { value: 'Obrigado!' } });

    const submitButton = screen.getByText('Enviar Resposta');
    expect(submitButton).not.toBeDisabled();
  });

  it('deve mostrar erro quando resposta está vazia', async () => {
    render(<ReviewResponseForm reviewId="review-1" />);

    const submitButton = screen.getByText('Enviar Resposta');

    // Forçar submit mesmo com botão disabled (através do form)
    const form = submitButton.closest('form');
    if (form) {
      fireEvent.submit(form);
    }

    await waitFor(() => {
      expect(screen.getByText('Por favor, escreva uma resposta')).toBeInTheDocument();
    });
  });

  it('deve mostrar erro quando resposta excede 500 caracteres', async () => {
    render(<ReviewResponseForm reviewId="review-1" />);

    const textarea = screen.getByPlaceholderText('Escreva sua resposta à avaliação...');
    const longText = 'a'.repeat(501);
    fireEvent.change(textarea, { target: { value: longText } });

    const form = textarea.closest('form');
    if (form) {
      fireEvent.submit(form);
    }

    await waitFor(() => {
      expect(screen.getByText('A resposta não pode ter mais de 500 caracteres')).toBeInTheDocument();
    });
  });

  it('deve enviar resposta com sucesso', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true }),
    });

    render(<ReviewResponseForm reviewId="review-1" onSuccess={mockOnSuccess} />);

    const textarea = screen.getByPlaceholderText('Escreva sua resposta à avaliação...');
    fireEvent.change(textarea, { target: { value: 'Obrigado pelo feedback!' } });

    const submitButton = screen.getByText('Enviar Resposta');
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        'http://localhost:3002/api/v1/reviews/review-1/respond',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            'Authorization': 'Bearer mock-token',
          }),
          body: JSON.stringify({ response: 'Obrigado pelo feedback!' }),
        })
      );
    });

    await waitFor(() => {
      expect(mockOnSuccess).toHaveBeenCalled();
    });
  });

  it('deve mostrar loading state durante envio', async () => {
    (global.fetch as jest.Mock).mockImplementationOnce(
      () => new Promise((resolve) => setTimeout(() => resolve({ ok: true, json: async () => ({}) }), 1000))
    );

    render(<ReviewResponseForm reviewId="review-1" />);

    const textarea = screen.getByPlaceholderText('Escreva sua resposta à avaliação...');
    fireEvent.change(textarea, { target: { value: 'Teste' } });

    const submitButton = screen.getByText('Enviar Resposta');
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText('Enviando...')).toBeInTheDocument();
    });
  });

  it('deve desabilitar inputs durante loading', async () => {
    (global.fetch as jest.Mock).mockImplementationOnce(
      () => new Promise((resolve) => setTimeout(() => resolve({ ok: true, json: async () => ({}) }), 1000))
    );

    render(<ReviewResponseForm reviewId="review-1" />);

    const textarea = screen.getByPlaceholderText('Escreva sua resposta à avaliação...');
    fireEvent.change(textarea, { target: { value: 'Teste' } });

    const submitButton = screen.getByText('Enviar Resposta');
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(textarea).toBeDisabled();
      expect(submitButton).toBeDisabled();
    });
  });

  it('deve mostrar erro ao falhar no envio', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: 'Erro ao enviar resposta' }),
    });

    render(<ReviewResponseForm reviewId="review-1" />);

    const textarea = screen.getByPlaceholderText('Escreva sua resposta à avaliação...');
    fireEvent.change(textarea, { target: { value: 'Teste' } });

    const submitButton = screen.getByText('Enviar Resposta');
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText('Erro ao enviar resposta')).toBeInTheDocument();
    });
  });

  it('deve chamar onCancel ao clicar em cancelar', () => {
    render(<ReviewResponseForm reviewId="review-1" onCancel={mockOnCancel} />);

    const cancelButton = screen.getByText('Cancelar');
    fireEvent.click(cancelButton);

    expect(mockOnCancel).toHaveBeenCalled();
  });

  it('deve limpar textarea após envio com sucesso', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true }),
    });

    render(<ReviewResponseForm reviewId="review-1" />);

    const textarea = screen.getByPlaceholderText('Escreva sua resposta à avaliação...') as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: 'Teste' } });

    const submitButton = screen.getByText('Enviar Resposta');
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(textarea.value).toBe('');
    });
  });

  it('deve trimmar espaços em branco da resposta', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true }),
    });

    render(<ReviewResponseForm reviewId="review-1" />);

    const textarea = screen.getByPlaceholderText('Escreva sua resposta à avaliação...');
    fireEvent.change(textarea, { target: { value: '  Obrigado!  ' } });

    const submitButton = screen.getByText('Enviar Resposta');
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: JSON.stringify({ response: 'Obrigado!' }),
        })
      );
    });
  });
});
