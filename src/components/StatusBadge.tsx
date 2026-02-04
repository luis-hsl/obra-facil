const statusConfig: Record<string, { label: string; color: string }> = {
  lead: { label: 'Lead', color: 'bg-gray-200 text-gray-800' },
  medicao: { label: 'Medição', color: 'bg-yellow-100 text-yellow-800' },
  orcado: { label: 'Orçado', color: 'bg-blue-100 text-blue-800' },
  execucao: { label: 'Execução', color: 'bg-orange-100 text-orange-800' },
  finalizado: { label: 'Finalizado', color: 'bg-green-100 text-green-800' },
  enviado: { label: 'Enviado', color: 'bg-blue-100 text-blue-800' },
  aprovado: { label: 'Aprovado', color: 'bg-green-100 text-green-800' },
  perdido: { label: 'Perdido', color: 'bg-red-100 text-red-800' },
  pendente: { label: 'Pendente', color: 'bg-yellow-100 text-yellow-800' },
  concluido: { label: 'Concluído', color: 'bg-green-100 text-green-800' },
};

export default function StatusBadge({ status }: { status: string }) {
  const config = statusConfig[status] || { label: status, color: 'bg-gray-200 text-gray-800' };
  return (
    <span className={`px-2 py-1 rounded-full text-xs font-medium ${config.color}`}>
      {config.label}
    </span>
  );
}
