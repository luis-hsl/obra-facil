interface ConfirmModalProps {
  aberto: boolean;
  titulo: string;
  descricao?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variante?: 'danger' | 'warning';
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmModal({
  aberto,
  titulo,
  descricao,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  variante = 'danger',
  loading = false,
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  if (!aberto) return null;

  const btnColor = variante === 'danger'
    ? 'bg-red-600 hover:bg-red-700 focus:ring-red-500'
    : 'bg-orange-600 hover:bg-orange-700 focus:ring-orange-500';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onCancel}>
      {/* Overlay */}
      <div className="absolute inset-0 bg-black/40" />

      {/* Modal */}
      <div
        className="relative bg-white rounded-xl shadow-xl max-w-sm w-full p-6"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Icon */}
        <div className={`mx-auto w-12 h-12 rounded-full flex items-center justify-center mb-4 ${
          variante === 'danger' ? 'bg-red-100' : 'bg-orange-100'
        }`}>
          <svg className={`w-6 h-6 ${variante === 'danger' ? 'text-red-600' : 'text-orange-600'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
        </div>

        <h3 className="text-lg font-semibold text-gray-900 text-center">{titulo}</h3>
        {descricao && <p className="mt-2 text-sm text-gray-500 text-center">{descricao}</p>}

        <div className="mt-6 flex gap-3">
          <button
            onClick={onCancel}
            disabled={loading}
            className="flex-1 px-4 py-2.5 rounded-lg text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 transition-colors disabled:opacity-50"
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className={`flex-1 px-4 py-2.5 rounded-lg text-sm font-medium text-white transition-colors disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-offset-2 ${btnColor}`}
          >
            {loading ? 'Aguarde...' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
