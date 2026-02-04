import { useState } from 'react';
import { supabase } from '../lib/supabase';
import type { Execucao } from '../types';

interface Props {
  obraId: string;
  execucoes: Execucao[];
  onSave: () => void;
}

export default function ExecucaoSection({ obraId, execucoes, onSave }: Props) {
  const exec = execucoes[0] || null;
  const [observacoes, setObservacoes] = useState('');
  const [loading, setLoading] = useState(false);
  const [toggling, setToggling] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [erro, setErro] = useState('');

  const handleIniciar = async () => {
    setErro('');
    setLoading(true);

    const { error } = await supabase.from('execucoes').insert({
      obra_id: obraId,
      observacoes: observacoes || null,
    });

    if (error) {
      setErro('Erro ao iniciar execução.');
      setLoading(false);
      return;
    }

    setObservacoes('');
    setLoading(false);
    onSave();
  };

  const toggleStatus = async () => {
    if (!exec) return;
    setToggling(true);
    const newStatus = exec.status === 'pendente' ? 'concluido' : 'pendente';
    const { error } = await supabase.from('execucoes').update({ status: newStatus }).eq('id', exec.id);
    if (error) {
      setErro('Erro ao atualizar status.');
    } else {
      onSave();
    }
    setToggling(false);
  };

  const handleUploadFoto = async (file: File) => {
    if (!exec) return;
    setUploading(true);
    setErro('');
    const ext = file.name.split('.').pop();
    const path = `${obraId}/${exec.id}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from('fotos')
      .upload(path, file, { upsert: true });

    if (uploadError) {
      setErro('Erro ao enviar foto.');
      setUploading(false);
      return;
    }

    const { data } = supabase.storage.from('fotos').getPublicUrl(path);
    const { error: updateError } = await supabase
      .from('execucoes')
      .update({ foto_final_url: data.publicUrl })
      .eq('id', exec.id);

    if (updateError) {
      setErro('Foto enviada, mas erro ao salvar referência.');
    }

    setUploading(false);
    onSave();
  };

  return (
    <div>
      {erro && <p className="text-red-600 text-sm mb-3">{erro}</p>}

      {!exec ? (
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Observações (opcional)
            </label>
            <input
              type="text"
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
              placeholder="Ex: Instalação prevista para segunda"
              className="w-full px-3 py-3 rounded-lg border border-gray-300 text-base focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <button
            onClick={handleIniciar}
            disabled={loading}
            className="w-full py-3 bg-blue-600 text-white rounded-lg font-semibold disabled:opacity-50"
          >
            {loading ? 'Iniciando...' : 'Iniciar Execução'}
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Status atual */}
          <div className={`rounded-lg p-4 ${exec.status === 'concluido' ? 'bg-green-50 border border-green-200' : 'bg-yellow-50 border border-yellow-200'}`}>
            <p className={`text-sm font-semibold ${exec.status === 'concluido' ? 'text-green-800' : 'text-yellow-800'}`}>
              {exec.status === 'concluido' ? 'Execução concluída' : 'Execução em andamento'}
            </p>
            {exec.observacoes && (
              <p className={`text-sm mt-1 ${exec.status === 'concluido' ? 'text-green-700' : 'text-yellow-700'}`}>
                {exec.observacoes}
              </p>
            )}
          </div>

          {/* Foto */}
          {exec.foto_final_url && (
            <img
              src={exec.foto_final_url}
              alt="Foto final"
              className="w-full rounded-lg max-h-64 object-cover"
            />
          )}

          <div className="flex gap-3">
            <button
              onClick={toggleStatus}
              disabled={toggling}
              className={`flex-1 py-3 rounded-lg font-semibold disabled:opacity-50 ${
                exec.status === 'pendente'
                  ? 'bg-green-600 text-white'
                  : 'bg-gray-200 text-gray-700'
              }`}
            >
              {toggling
                ? '...'
                : exec.status === 'pendente'
                  ? 'Marcar Concluído'
                  : 'Reabrir'}
            </button>

            <label className="flex-1 py-3 bg-gray-100 text-gray-700 rounded-lg font-semibold text-center cursor-pointer flex items-center justify-center">
              {uploading ? 'Enviando...' : 'Enviar Foto'}
              <input
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                disabled={uploading}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleUploadFoto(file);
                }}
              />
            </label>
          </div>
        </div>
      )}
    </div>
  );
}
