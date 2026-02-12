import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import type { Atendimento } from '../types';
import StatusBadge from './StatusBadge';

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function GlobalSearch({ open, onClose }: Props) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Atendimento[]>([]);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    if (open) {
      setQuery('');
      setResults([]);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open]);

  // Keyboard shortcut: Ctrl+K or Cmd+K
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        if (open) onClose(); else onClose(); // toggle handled by parent
      }
      if (e.key === 'Escape' && open) onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  const search = (q: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!q.trim()) { setResults([]); setLoading(false); return; }

    setLoading(true);
    debounceRef.current = setTimeout(async () => {
      const term = `%${q.trim()}%`;
      const { data } = await supabase
        .from('atendimentos')
        .select('*')
        .or(`cliente_nome.ilike.${term},cliente_telefone.ilike.${term},endereco.ilike.${term},cidade.ilike.${term},tipo_servico.ilike.${term}`)
        .order('created_at', { ascending: false })
        .limit(15);
      setResults(data || []);
      setLoading(false);
    }, 300);
  };

  const handleChange = (value: string) => {
    setQuery(value);
    search(value);
  };

  const handleSelect = (id: string) => {
    onClose();
    navigate(`/atendimentos/${id}`);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh] md:pt-[20vh]">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative w-full max-w-lg mx-4 bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden animate-fade-in">
        {/* Search input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-100">
          <svg className="w-5 h-5 text-slate-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => handleChange(e.target.value)}
            placeholder="Buscar cliente, endereço, telefone..."
            className="flex-1 text-base text-slate-900 placeholder:text-slate-400 outline-none bg-transparent"
          />
          <kbd className="hidden md:inline-flex text-xs text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded font-mono">Esc</kbd>
        </div>

        {/* Results */}
        <div className="max-h-[50vh] overflow-y-auto">
          {loading && (
            <div className="px-4 py-6 text-center">
              <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto" />
            </div>
          )}

          {!loading && query.trim() && results.length === 0 && (
            <div className="px-4 py-8 text-center">
              <p className="text-sm text-slate-400">Nenhum resultado para "{query}"</p>
            </div>
          )}

          {!loading && results.length > 0 && (
            <div className="py-2">
              {results.map((r) => (
                <button
                  key={r.id}
                  onClick={() => handleSelect(r.id)}
                  className="w-full px-4 py-3 text-left hover:bg-slate-50 flex items-start gap-3 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <p className="font-semibold text-slate-900 truncate">{r.cliente_nome}</p>
                      <StatusBadge status={r.status} />
                    </div>
                    <p className="text-sm text-slate-500 truncate">{r.cliente_telefone}</p>
                    <p className="text-xs text-slate-400 truncate">
                      {[r.endereco, r.numero, r.bairro, r.cidade].filter(Boolean).join(', ')}
                    </p>
                  </div>
                  <span className="text-xs text-slate-400 flex-shrink-0 mt-1">
                    {r.tipo_servico}
                  </span>
                </button>
              ))}
            </div>
          )}

          {!query.trim() && (
            <div className="px-4 py-8 text-center">
              <svg className="w-8 h-8 text-slate-300 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <p className="text-sm text-slate-400">Digite para buscar</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
