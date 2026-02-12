import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import type { Medicao } from '../types';

interface Props {
  atendimentoId: string;
  medicoes: Medicao[];
  currentStatus: string;
  onSave: () => void;
}

interface Adicional {
  nome: string;
  medidas: string; // Ex: "4,47 + 5,58 + 3,20"
}

interface Comodo {
  nome: string;
  comprimento: string;
  largura: string;
  adicionais: Adicional[];
}

const COMODOS_SUGESTOES = ['Sala', 'Quarto', 'Cozinha', 'Banheiro', 'Corredor', 'Varanda', 'Lavanderia', 'Escritório'];
const ADICIONAIS_SUGESTOES = ['Rodapé', 'Perfil', 'Soleira', 'Roda-meio', 'Acabamento', 'Cantoneira'];

const criarComodoVazio = (): Comodo => ({ nome: '', comprimento: '', largura: '', adicionais: [] });

export default function MedicaoForm({ atendimentoId, medicoes, currentStatus, onSave }: Props) {
  const medicao = medicoes[0] || null;
  const [editing, setEditing] = useState(false);
  const [comodos, setComodos] = useState<Comodo[]>([criarComodoVazio()]);
  const [perdaPercentual, setPerdaPercentual] = useState('10');
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState('');

  const showForm = !medicao || editing;

  // Calcular área de cada cômodo
  const calcularAreaComodo = (c: Comodo) => {
    const comp = parseFloat(c.comprimento.replace(',', '.')) || 0;
    const larg = parseFloat(c.largura.replace(',', '.')) || 0;
    return comp * larg;
  };

  // Área total = soma de todos os cômodos
  const areaTotal = comodos.reduce((sum, c) => sum + calcularAreaComodo(c), 0);
  const perda = parseFloat(perdaPercentual) || 10;
  const areaComPerda = areaTotal * (1 + perda / 100);

  // Carregar dados existentes ao editar
  useEffect(() => {
    if (medicao && editing) {
      setPerdaPercentual(String(medicao.perda_percentual || 10));
      if (medicao.observacoes) {
        try {
          const saved = JSON.parse(medicao.observacoes);
          // Novo formato com adicionais dentro de cada cômodo
          if (saved.comodos && Array.isArray(saved.comodos)) {
            setComodos(saved.comodos.map((c: any) => ({
              nome: c.nome || '',
              comprimento: String(c.comprimento || ''),
              largura: String(c.largura || ''),
              adicionais: (c.adicionais || []).map((a: any) => ({
                nome: a.nome || '',
                medidas: a.medidas || String(a.quantidade || ''),
              })),
            })));
            return;
          }
          // Formato antigo (só array de cômodos sem adicionais)
          if (Array.isArray(saved) && saved.length > 0) {
            setComodos(saved.map((c: any) => ({
              nome: c.nome || '',
              comprimento: String(c.comprimento || ''),
              largura: String(c.largura || ''),
              adicionais: [],
            })));
            return;
          }
        } catch {
          // Não é JSON
        }
      }
      setComodos([criarComodoVazio()]);
    }
  }, [medicao, editing]);

  const startEdit = () => {
    setEditing(true);
  };

  // Cômodos
  const adicionarComodo = () => {
    setComodos([...comodos, criarComodoVazio()]);
  };

  const removerComodo = (index: number) => {
    if (comodos.length === 1) return;
    setComodos(comodos.filter((_, i) => i !== index));
  };

  const atualizarComodo = (index: number, campo: 'nome' | 'comprimento' | 'largura', valor: string) => {
    const novos = [...comodos];
    novos[index] = { ...novos[index], [campo]: valor };
    setComodos(novos);
  };

  // Calcular soma de medidas (ex: "4,47 + 5,58 + 3,20" = 13,25)
  const calcularSomaMedidas = (medidas: string) => {
    if (!medidas.trim()) return 0;
    const valores = medidas.split('+').map(v => parseFloat(v.trim().replace(',', '.')) || 0);
    return valores.reduce((sum, v) => sum + v, 0);
  };

  // Adicionais dentro de cada cômodo
  const adicionarAdicional = (comodoIndex: number) => {
    const novos = [...comodos];
    novos[comodoIndex].adicionais.push({ nome: '', medidas: '' });
    setComodos(novos);
  };

  const removerAdicional = (comodoIndex: number, adicionalIndex: number) => {
    const novos = [...comodos];
    novos[comodoIndex].adicionais = novos[comodoIndex].adicionais.filter((_, i) => i !== adicionalIndex);
    setComodos(novos);
  };

  const atualizarAdicional = (comodoIndex: number, adicionalIndex: number, campo: keyof Adicional, valor: string) => {
    const novos = [...comodos];
    novos[comodoIndex].adicionais[adicionalIndex] = {
      ...novos[comodoIndex].adicionais[adicionalIndex],
      [campo]: valor,
    };
    setComodos(novos);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro('');

    if (areaTotal <= 0) {
      setErro('A área total precisa ser maior que zero.');
      return;
    }

    setLoading(true);

    // Salvar cômodos com adicionais como JSON
    const comodosParaSalvar = comodos.map(c => ({
      nome: c.nome,
      comprimento: parseFloat(c.comprimento.replace(',', '.')) || 0,
      largura: parseFloat(c.largura.replace(',', '.')) || 0,
      adicionais: c.adicionais
        .filter(a => a.nome && a.medidas)
        .map(a => ({
          nome: a.nome,
          medidas: a.medidas,
          total: calcularSomaMedidas(a.medidas),
        })),
    }));

    const data = {
      area_total: Math.round(areaTotal * 100) / 100,
      perda_percentual: perda,
      observacoes: JSON.stringify({ comodos: comodosParaSalvar }),
    };

    if (medicao) {
      const { error } = await supabase
        .from('medicoes')
        .update(data)
        .eq('id', medicao.id);

      if (error) {
        setErro('Erro ao atualizar medição.');
        setLoading(false);
        return;
      }
    } else {
      const { error } = await supabase.from('medicoes').insert({
        atendimento_id: atendimentoId,
        ...data,
      });

      if (error) {
        setErro('Erro ao salvar medição.');
        setLoading(false);
        return;
      }

      if (currentStatus === 'visita_tecnica') {
        await supabase.from('atendimentos').update({ status: 'medicao' }).eq('id', atendimentoId);
      }
    }

    setComodos([criarComodoVazio()]);
    setPerdaPercentual('10');
    setEditing(false);
    setLoading(false);
    onSave();
  };

  // Renderizar dados salvos para visualização
  const renderVisualizacao = () => {
    if (!medicao?.observacoes) return null;
    try {
      const saved = JSON.parse(medicao.observacoes);
      const lista = saved.comodos || (Array.isArray(saved) ? saved : null);
      if (!lista) return null;

      return (
        <div className="mt-2 space-y-2">
          {lista.map((c: any, i: number) => {
            const area = (c.comprimento || 0) * (c.largura || 0);
            return (
              <div key={i}>
                <p className="text-sm text-green-700">
                  {c.nome || `Cômodo ${i + 1}`}: {c.comprimento} × {c.largura} = {area.toFixed(2)} m²
                </p>
                {c.adicionais && c.adicionais.length > 0 && (
                  <div className="ml-4">
                    {c.adicionais.map((a: any, j: number) => (
                      <p key={j} className="text-xs text-gray-600">
                        └ {a.nome}: {a.medidas || a.quantidade} = {a.total?.toFixed(2) || a.quantidade} m²
                      </p>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      );
    } catch {
      return medicao.observacoes ? (
        <p className="text-sm text-green-700 mt-1">{medicao.observacoes}</p>
      ) : null;
    }
  };

  return (
    <div>
      {erro && <p className="text-red-600 text-sm mb-3">{erro}</p>}

      {!showForm && medicao ? (
        <div className="bg-emerald-50 rounded-xl border border-emerald-200 p-4">
          <div className="flex items-center justify-between mb-1">
            <p className="text-sm font-bold text-emerald-800">Medição registrada</p>
            <button onClick={startEdit} className="text-sm text-blue-600 font-medium">
              Editar
            </button>
          </div>
          <p className="text-2xl font-bold text-emerald-900">{medicao.area_total} m²</p>
          <p className="text-sm text-emerald-700">Perda: {medicao.perda_percentual || 10}%</p>
          <p className="text-sm text-emerald-600">
            Área final: {(medicao.area_total * (1 + (medicao.perda_percentual || 10) / 100)).toFixed(2)} m²
          </p>
          {renderVisualizacao()}
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-slate-100 p-4 space-y-4 shadow-sm">
          {/* Cômodos */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-gray-700">Cômodos</label>
              <button
                type="button"
                onClick={adicionarComodo}
                className="text-sm text-blue-600 font-medium"
              >
                + Adicionar cômodo
              </button>
            </div>

            <div className="space-y-4">
              {comodos.map((comodo, index) => {
                const area = calcularAreaComodo(comodo);
                return (
                  <div key={index} className="bg-slate-50 rounded-xl p-3 border border-slate-200">
                    {/* Nome e remover */}
                    <div className="flex items-center gap-2 mb-2">
                      <input
                        type="text"
                        list="comodos-list"
                        value={comodo.nome}
                        onChange={(e) => atualizarComodo(index, 'nome', e.target.value)}
                        placeholder="ex: Sala"
                        className="flex-1 px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm"
                      />
                      {comodos.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removerComodo(index)}
                          className="text-red-500 text-sm px-2"
                        >
                          ✕
                        </button>
                      )}
                    </div>

                    {/* Dimensões */}
                    <div className="flex items-center gap-2 mb-3">
                      <input
                        type="text"
                        inputMode="decimal"
                        value={comodo.comprimento}
                        onChange={(e) => atualizarComodo(index, 'comprimento', e.target.value)}
                        placeholder="ex: 4,47"
                        className="w-24 px-2 py-2 rounded-lg border border-gray-300 text-sm text-center focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                      <span className="text-gray-400">×</span>
                      <input
                        type="text"
                        inputMode="decimal"
                        value={comodo.largura}
                        onChange={(e) => atualizarComodo(index, 'largura', e.target.value)}
                        placeholder="ex: 5,58"
                        className="w-24 px-2 py-2 rounded-lg border border-gray-300 text-sm text-center focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                      <span className="text-gray-400">=</span>
                      <span className={`font-semibold ${area > 0 ? 'text-blue-600' : 'text-gray-400'}`}>
                        {area > 0 ? `${area.toFixed(2)} m²` : '0 m²'}
                      </span>
                    </div>

                    {/* Adicionais do cômodo */}
                    <div className="border-t border-gray-200 pt-2">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs text-gray-500">Adicionais</span>
                        <button
                          type="button"
                          onClick={() => adicionarAdicional(index)}
                          className="text-xs text-blue-600 font-medium"
                        >
                          + Adicionar
                        </button>
                      </div>

                      {comodo.adicionais.length === 0 ? (
                        <p className="text-xs text-gray-400">Rodapé, perfil, soleira... Some os valores com + (ex: 4,47 + 5,58)</p>
                      ) : (
                        <div className="space-y-2">
                          {comodo.adicionais.map((adicional, adicionalIndex) => {
                            const totalAdicional = calcularSomaMedidas(adicional.medidas);
                            return (
                              <div key={adicionalIndex} className="bg-white rounded p-2 border border-gray-200">
                                <div className="flex items-center gap-2 mb-1">
                                  <input
                                    type="text"
                                    list="adicionais-list"
                                    value={adicional.nome}
                                    onChange={(e) => atualizarAdicional(index, adicionalIndex, 'nome', e.target.value)}
                                    placeholder="ex: Rodapé"
                                    className="flex-1 px-2 py-1 rounded border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                  />
                                  <button
                                    type="button"
                                    onClick={() => removerAdicional(index, adicionalIndex)}
                                    className="text-red-500 text-xs px-1"
                                  >
                                    ✕
                                  </button>
                                </div>
                                <div className="flex items-center gap-2">
                                  <input
                                    type="text"
                                    value={adicional.medidas}
                                    onChange={(e) => atualizarAdicional(index, adicionalIndex, 'medidas', e.target.value)}
                                    placeholder="ex: 4,47 + 5,58 + 3,20"
                                    className="flex-1 px-2 py-1 rounded border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                  />
                                  <span className="text-gray-400">=</span>
                                  <span className={`font-semibold text-sm ${totalAdicional > 0 ? 'text-blue-600' : 'text-gray-400'}`}>
                                    {totalAdicional > 0 ? `${totalAdicional.toFixed(2)} m²` : '0 m²'}
                                  </span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            <datalist id="comodos-list">
              {COMODOS_SUGESTOES.map((s) => (
                <option key={s} value={s} />
              ))}
            </datalist>
            <datalist id="adicionais-list">
              {ADICIONAIS_SUGESTOES.map((s) => (
                <option key={s} value={s} />
              ))}
            </datalist>
          </div>

          {/* Total em tempo real */}
          {areaTotal > 0 && (
            <div className="bg-blue-50 rounded-xl p-4 border border-blue-200">
              <p className="text-sm text-blue-600 font-medium">Área total medida:</p>
              <p className="text-3xl font-bold text-blue-900">{areaTotal.toFixed(2)} m²</p>
            </div>
          )}

          {/* Perda só aparece após ter área */}
          {areaTotal > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Perda (%)</label>
              <input
                type="number"
                inputMode="numeric"
                step="1"
                min="0"
                value={perdaPercentual}
                onChange={(e) => setPerdaPercentual(e.target.value)}
                placeholder="Ex: 10"
                className="w-full px-3 py-3 rounded-lg border border-gray-300 text-base focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <p className="text-xs text-gray-400 mt-1">
                Ao cortar peças para encaixe em cantos e paredes, parte do material é desperdiçada. O padrão de 10% cobre a maioria dos casos. Ambientes com muitos recortes (banheiros, corredores estreitos) podem exigir 15% ou mais.
              </p>
            </div>
          )}

          {/* Área final com perda */}
          {areaTotal > 0 && (
            <div className="bg-emerald-50 rounded-xl p-4 border border-emerald-200">
              <p className="text-sm text-emerald-600 font-medium">Área final (com {perda}% perda):</p>
              <p className="text-3xl font-bold text-emerald-900">{areaComPerda.toFixed(2)} m²</p>
            </div>
          )}

          <div className="flex gap-3">
            {editing && (
              <button
                type="button"
                onClick={() => { setEditing(false); setErro(''); setComodos([criarComodoVazio()]); }}
                className="flex-1 py-3 border border-slate-200 rounded-xl text-slate-700 font-semibold bg-white shadow-sm hover:bg-slate-50"
              >
                Cancelar
              </button>
            )}
            <button
              type="submit"
              disabled={loading || areaTotal <= 0}
              className="flex-1 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl font-semibold disabled:opacity-50 shadow-lg shadow-blue-500/20"
            >
              {loading ? 'Salvando...' : 'Salvar Medição'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
