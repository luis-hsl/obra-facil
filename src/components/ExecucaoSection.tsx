import { useState } from 'react';
import { supabase } from '../lib/supabase';
import type { Execucao } from '../types';
import StatusBadge from './StatusBadge';

interface Props {
  obraId: string;
  execucoes: Execucao[];
  onSave: () => void;
}

export default function ExecucaoSection({ obraId, execucoes, onSave }: Props) {
  const [observacoes, setObservacoes] = useState('');
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [uploading, setUploading] = useState<string | null>(null);
  const [erro, setErro] = useState('');
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro('');
    setLoading(true);

    const { error } = await supabase.from('execucoes').insert({
      obra_id: obraId,
      observacoes: observacoes || null,
    });

    if (error) {
      setErro('Erro ao criar execução.');
      setLoading(false);
      return;
    }

    setObservacoes('');
    setShowForm(false);
    setLoading(false);
    onSave();
  };

  const toggleStatus = async (exec: Execucao) => {
    setTogglingId(exec.id);
    const newStatus = exec.status === 'pendente' ? 'concluido' : 'pendente';
    const { error } = await supabase.from('execucoes').update({ status: newStatus }).eq('id', exec.id);
    if (error) {
      setErro('Erro ao atualizar status.');
    } else {
      onSave();
    }
    setTogglingId(null);
  };

  const handleUploadFoto = async (execId: string, file: File) => {
    setUploading(execId);
    setErro('');
    const ext = file.name.split('.').pop();
    const path = `${obraId}/${execId}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from('fotos')
      .upload(path, file, { upsert: true });

    if (uploadError) {
      setErro('Erro ao enviar foto.');
      setUploading(null);
      return;
    }

    const { data } = supabase.storage.from('fotos').getPublicUrl(path);
    const { error: updateError } = await supabase
      .from('execucoes')
      .update({ foto_final_url: data.publicUrl })
      .eq('id', execId);

    if (updateError) {
      setErro('Foto enviada, mas erro ao salvar referência.');
    }

    setUploading(null);
    onSave();
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Excluir esta execução?')) return;
    setDeletingId(id);
    const { error } = await supabase.from('execucoes').delete().eq('id', id);
    if (error) {
      setErro('Erro ao excluir execução.');
    } else {
      onSave();
    }
    setDeletingId(null);
  };

  return (
    <div>
      {erro && <p className="text-red-600 text-sm mb-3">{erro}</p>}

      {/* Lista de execuções */}
      {execucoes.length > 0 && (
        <div className="space-y-3 mb-4">
          {execucoes.map((exec) => (
            <div key={exec.id} className="bg-white rounded-lg border border-gray-200 p-4">
              <div className="flex items-center justify-between mb-2">
                <StatusBadge status={exec.status} />
                <button
                  onClick={() => handleDelete(exec.id)}
                  disabled={deletingId === exec.id}
                  className="text-sm text-gray-400 disabled:opacity-50"
                >
                  {deletingId === exec.id ? '...' : 'Excluir'}
                </button>
              </div>

              {exec.observacoes && (
                <p className="text-sm text-gray-600 mb-3">{exec.observacoes}</p>
              )}

              {/* Foto */}
              {exec.foto_final_url && (
                <img
                  src={exec.foto_final_url}
                  alt="Foto final"
                  className="w-full rounded-lg mb-3 max-h-64 object-cover"
                />
              )}

              <div className="flex gap-2">
                <button
                  onClick={() => toggleStatus(exec)}
                  disabled={togglingId === exec.id}
                  className={`flex-1 py-2 rounded-lg font-medium text-sm disabled:opacity-50 ${
                    exec.status === 'pendente'
                      ? 'bg-green-600 text-white'
                      : 'bg-gray-200 text-gray-700'
                  }`}
                >
                  {togglingId === exec.id
                    ? '...'
                    : exec.status === 'pendente'
                      ? 'Marcar Concluído'
                      : 'Voltar p/ Pendente'}
                </button>

                <label className="flex-1 py-2 bg-gray-100 text-gray-700 rounded-lg font-medium text-sm text-center cursor-pointer">
                  {uploading === exec.id ? 'Enviando...' : 'Enviar Foto'}
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    className="hidden"
                    disabled={uploading === exec.id}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleUploadFoto(exec.id, file);
                    }}
                  />
                </label>
              </div>
            </div>
          ))}
        </div>
      )}

      {!showForm ? (
        <button
          onClick={() => setShowForm(true)}
          className="w-full py-3 border-2 border-dashed border-gray-300 rounded-lg text-gray-500 font-medium"
        >
          + Nova Execução
        </button>
      ) : (
        <form onSubmit={handleCreate} className="bg-white rounded-lg border border-gray-200 p-4 space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Observações
            </label>
            <input
              type="text"
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
              placeholder="Ex: Instalação do box"
              className="w-full px-3 py-2 rounded-lg border border-gray-300 text-base focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => { setShowForm(false); setErro(''); }}
              className="flex-1 py-2 border border-gray-300 rounded-lg text-gray-700 font-medium"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 py-2 bg-blue-600 text-white rounded-lg font-medium disabled:opacity-50"
            >
              {loading ? 'Salvando...' : 'Criar'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
