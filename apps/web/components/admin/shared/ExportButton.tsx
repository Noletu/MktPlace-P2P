import { useState } from 'react';

interface ExportButtonProps {
  onExport: () => Promise<void>;
  label?: string;
}

export default function ExportButton({ onExport, label = 'Exportar CSV' }: ExportButtonProps) {
  const [loading, setLoading] = useState(false);

  const handleClick = async () => {
    setLoading(true);
    try {
      await onExport();
    } catch (error) {
      console.error('Erro ao exportar:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handleClick}
      disabled={loading}
      className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 border border-green-500 text-white rounded-lg transition flex items-center gap-2"
    >
      {loading ? (
        <>
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
          <span>Exportando...</span>
        </>
      ) : (
        <>
          <span>📥</span>
          <span>{label}</span>
        </>
      )}
    </button>
  );
}
