import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../lib/useAuth';
import { useBrandConfig } from '../lib/useBrandConfig';
import { supabase } from '../lib/supabase';
import { gerarPDF } from '../lib/gerarPDF';
import { DEFAULT_PDF_BRAND_CONFIG } from '../lib/pdf/defaults';
import { PDF_PRESETS } from '../lib/pdf/presets';
import type { BrandConfig, PdfBrandConfig } from '../types';
import type { Orcamento, OrcamentoItem } from '../types';

// ============================================================
// Helpers
// ============================================================

function ColorInput({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex items-center gap-3">
      <input type="color" value={value} onChange={e => onChange(e.target.value)}
        className="w-10 h-10 rounded border border-gray-300 cursor-pointer p-0.5" />
      <span className="text-sm text-gray-700">{label}</span>
    </div>
  );
}

function ToggleButtons<T extends string>({ options, value, onChange }: {
  options: Array<{ value: T; label: string }>;
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex gap-2 flex-wrap">
      {options.map(opt => (
        <button key={opt.value} type="button"
          onClick={() => onChange(opt.value)}
          className={`px-4 py-2 rounded-lg text-sm font-medium border-2 transition-colors ${
            value === opt.value
              ? 'border-blue-500 bg-blue-50 text-blue-700'
              : 'border-gray-200 text-gray-600 hover:bg-gray-50'
          }`}
        >{opt.label}</button>
      ))}
    </div>
  );
}

function Section({ title, open, onToggle, children }: {
  title: string; open: boolean; onToggle: () => void; children: React.ReactNode;
}) {
  return (
    <div className="border border-gray-200 rounded-lg">
      <button type="button" onClick={onToggle}
        className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-gray-50 transition-colors">
        <span className="font-semibold text-gray-800">{title}</span>
        <span className="text-gray-400">{open ? '−' : '+'}</span>
      </button>
      {open && <div className="px-4 pb-4 space-y-4">{children}</div>}
    </div>
  );
}

// ============================================================
// Mock data para preview
// ============================================================

const MOCK_ATENDIMENTO = {
  cliente_nome: 'Maria Silva',
  cliente_telefone: '(41) 99999-1234',
  endereco: 'Rua das Flores',
  numero: '123',
  complemento: 'Apto 4',
  bairro: 'Centro',
  cidade: 'Curitiba',
  tipo_servico: 'Piso Laminado',
};

const MOCK_ORCAMENTO: Orcamento = {
  id: 'mock', atendimento_id: 'mock', produto_id: null,
  area_total: 50, area_com_perda: 55, perda_percentual: 10,
  valor_total: 5500, status: 'rascunho', observacoes: null,
  forma_pagamento: 'parcelado', numero_parcelas: 10,
  taxa_juros_mensal: 2, valor_parcela: null, valor_total_parcelado: null,
  created_at: '',
};

const MOCK_ITENS: OrcamentoItem[] = [
  { id: '1', orcamento_id: 'mock', produto_id: 'p1', area_total: 50, area_com_perda: 55, perda_percentual: 10, preco_por_m2: 110, valor_total: 5500, created_at: '' },
  { id: '2', orcamento_id: 'mock', produto_id: 'p2', area_total: 50, area_com_perda: 55, perda_percentual: 10, preco_por_m2: 85, valor_total: 4250, created_at: '' },
];

const MOCK_PRODUTOS_MAP: Record<string, { id: string; user_id: string; fabricante: string; linha: string; preco_por_m2: number; created_at: string }> = {
  p1: { id: 'p1', user_id: '', fabricante: 'Durafloor', linha: 'Nature', preco_por_m2: 110, created_at: '' },
  p2: { id: 'p2', user_id: '', fabricante: 'Eucafloor', linha: 'Prime', preco_por_m2: 85, created_at: '' },
};

// ============================================================
// Main Component
// ============================================================

export default function MarcaConfig() {
  const { user } = useAuth();
  const { config, loading, saveConfig } = useBrandConfig();

  // Token state
  const [tokenConfig, setTokenConfig] = useState<PdfBrandConfig>(DEFAULT_PDF_BRAND_CONFIG);

  // Company data (separate from style)
  const [companyName, setCompanyName] = useState('');
  const [companyCnpj, setCompanyCnpj] = useState('');
  const [companyPhone, setCompanyPhone] = useState('');
  const [companyEmail, setCompanyEmail] = useState('');
  const [companyAddress, setCompanyAddress] = useState('');
  const [footerText, setFooterText] = useState('');
  const [validityDays, setValidityDays] = useState(15);

  // Logo
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [logoBase64, setLogoBase64] = useState<string | null>(null);

  // UI
  const [openSections, setOpenSections] = useState<Set<string>>(new Set(['visual']));
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const prevUrlRef = useRef<string | null>(null);

  // Load saved config
  useEffect(() => {
    if (!config) {
      // Fallback: user metadata
      if (user?.user_metadata) {
        const m = user.user_metadata;
        if (m.empresa) setCompanyName(m.empresa);
        if (m.telefone) setCompanyPhone(m.telefone);
        if (m.cpf_cnpj) setCompanyCnpj(m.cpf_cnpj);
      }
      return;
    }
    // Load company data
    setCompanyName(config.company_name || '');
    setCompanyCnpj(config.company_cnpj || '');
    setCompanyPhone(config.company_phone || '');
    setCompanyEmail(config.company_email || '');
    setCompanyAddress(config.company_address || '');
    setFooterText(config.footer_text || '');
    setValidityDays(config.validity_days || 15);
    setLogoUrl(config.logo_url || null);
    setLogoPreview(config.logo_url || null);

    // Load token config
    const stored = config.pdf_template as Record<string, unknown> | null;
    if (stored && stored.version === 3) {
      setTokenConfig(stored as unknown as PdfBrandConfig);
    } else {
      // Synthesize from flat fields
      setTokenConfig({
        ...DEFAULT_PDF_BRAND_CONFIG,
        templateId: (config.layout_style as PdfBrandConfig['templateId']) || 'modern',
        colors: {
          primary: config.primary_color || DEFAULT_PDF_BRAND_CONFIG.colors.primary,
          secondary: config.accent_color || DEFAULT_PDF_BRAND_CONFIG.colors.secondary,
          text: config.secondary_color || DEFAULT_PDF_BRAND_CONFIG.colors.text,
          muted: DEFAULT_PDF_BRAND_CONFIG.colors.muted,
          border: DEFAULT_PDF_BRAND_CONFIG.colors.border,
        },
        typography: {
          fontFamily: config.font_family || 'helvetica',
          headingWeight: 'bold',
          bodyWeight: 'normal',
        },
        logo: {
          url: config.logo_url || null,
          alignment: config.logo_position || 'left',
          size: 'medium',
        },
      });
    }
  }, [config, user]);

  // Preload logo as base64
  useEffect(() => {
    if (!logoUrl) { setLogoBase64(null); return; }
    fetch(logoUrl)
      .then(r => r.blob())
      .then(blob => {
        const reader = new FileReader();
        reader.onloadend = () => setLogoBase64(reader.result as string);
        reader.readAsDataURL(blob);
      })
      .catch(() => setLogoBase64(null));
  }, [logoUrl]);

  // Token update helpers
  const updateColor = (key: keyof PdfBrandConfig['colors'], value: string) =>
    setTokenConfig(t => ({ ...t, colors: { ...t.colors, [key]: value } }));

  const updateTypo = <K extends keyof PdfBrandConfig['typography']>(key: K, value: PdfBrandConfig['typography'][K]) =>
    setTokenConfig(t => ({ ...t, typography: { ...t.typography, [key]: value } }));

  const updateLogo = <K extends keyof PdfBrandConfig['logo']>(key: K, value: PdfBrandConfig['logo'][K]) =>
    setTokenConfig(t => ({ ...t, logo: { ...t.logo, [key]: value } }));

  const updateLayout = <K extends keyof PdfBrandConfig['layout']>(key: K, value: PdfBrandConfig['layout'][K]) =>
    setTokenConfig(t => ({ ...t, layout: { ...t.layout, [key]: value } }));

  // Build brand config for PDF generation
  const buildBrandConfig = useCallback((): BrandConfig => ({
    id: '', user_id: '', created_at: '', updated_at: '',
    logo_url: logoUrl,
    logo_position: tokenConfig.logo.alignment,
    primary_color: tokenConfig.colors.primary,
    secondary_color: tokenConfig.colors.text,
    accent_color: tokenConfig.colors.secondary,
    company_name: companyName || null,
    company_cnpj: companyCnpj || null,
    company_phone: companyPhone || null,
    company_email: companyEmail || null,
    company_address: companyAddress || null,
    footer_text: footerText || null,
    validity_days: validityDays,
    layout_style: tokenConfig.templateId,
    font_family: tokenConfig.typography.fontFamily,
    pdf_template: tokenConfig,
  }), [tokenConfig, logoUrl, companyName, companyCnpj, companyPhone, companyEmail, companyAddress, footerText, validityDays]);

  // Live preview with debounce
  useEffect(() => {
    if (!previewOpen) return;
    const timer = setTimeout(async () => {
      try {
        const url = await gerarPDF({
          atendimento: MOCK_ATENDIMENTO,
          orcamento: MOCK_ORCAMENTO,
          produto: null,
          itens: MOCK_ITENS,
          produtosMap: MOCK_PRODUTOS_MAP,
          numeroParcelas: 10,
          taxaJuros: 2,
          brandConfig: buildBrandConfig(),
          logoBase64,
          preview: true,
        });
        if (url) {
          if (prevUrlRef.current) URL.revokeObjectURL(prevUrlRef.current);
          prevUrlRef.current = url as string;
          setPreviewUrl(url as string);
        }
      } catch (err) {
        console.error('Preview error:', err);
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [previewOpen, buildBrandConfig, logoBase64]);

  // Cleanup on unmount
  useEffect(() => () => { if (prevUrlRef.current) URL.revokeObjectURL(prevUrlRef.current); }, []);

  // Toggle section
  const toggle = (id: string) => setOpenSections(s => {
    const next = new Set(s);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });

  // Logo upload
  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    setLogoPreview(URL.createObjectURL(file));
    const path = `${user.id}/logo-${Date.now()}.${file.name.split('.').pop()}`;
    const { error } = await supabase.storage.from('brand').upload(path, file, { upsert: true });
    if (!error) {
      const { data: urlData } = supabase.storage.from('brand').getPublicUrl(path);
      setLogoUrl(urlData.publicUrl);
      updateLogo('url', urlData.publicUrl);
    }
  };

  // Save
  const handleSave = async () => {
    setSaving(true);
    setMsg('');
    const updates: Partial<BrandConfig> = {
      company_name: companyName || null,
      company_cnpj: companyCnpj || null,
      company_phone: companyPhone || null,
      company_email: companyEmail || null,
      company_address: companyAddress || null,
      footer_text: footerText || null,
      validity_days: validityDays,
      logo_url: logoUrl,
      logo_position: tokenConfig.logo.alignment,
      primary_color: tokenConfig.colors.primary,
      secondary_color: tokenConfig.colors.text,
      accent_color: tokenConfig.colors.secondary,
      font_family: tokenConfig.typography.fontFamily,
      layout_style: tokenConfig.templateId,
      pdf_template: tokenConfig,
    };
    const { error } = await saveConfig(updates);
    setSaving(false);
    setMsg(error ? 'Erro ao salvar.' : 'Salvo!');
    setTimeout(() => setMsg(''), 3000);
  };

  if (loading) return <p className="text-gray-500 text-center py-10">Carregando...</p>;

  return (
    <div className={`transition-all ${previewOpen ? 'pb-[55vh] md:pb-0 md:pr-[420px]' : ''}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-gray-900">Minha Marca</h2>
        <div className="flex gap-2">
          <button type="button" onClick={() => setPreviewOpen(p => !p)}
            className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
              previewOpen ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-300 text-gray-600 hover:bg-gray-50'
            }`}>
            {previewOpen ? 'Fechar Preview' : 'Preview'}
          </button>
          <button type="button" onClick={handleSave} disabled={saving}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium disabled:opacity-50">
            {saving ? 'Salvando...' : 'Salvar'}
          </button>
        </div>
      </div>
      {msg && <p className={`text-sm mb-4 ${msg.includes('Erro') ? 'text-red-600' : 'text-green-600'}`}>{msg}</p>}

      {/* Template Selector */}
      <div className="mb-6">
        <label className="block text-sm font-semibold text-gray-700 mb-3">Template</label>
        <div className="grid grid-cols-3 gap-3">
          {Object.values(PDF_PRESETS).map(preset => (
            <button key={preset.id} type="button"
              onClick={() => setTokenConfig(t => ({ ...t, templateId: preset.id }))}
              className={`p-3 rounded-lg border-2 text-left transition-colors ${
                tokenConfig.templateId === preset.id
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 hover:bg-gray-50'
              }`}>
              <div className="font-semibold text-sm text-gray-800">{preset.label}</div>
              <div className="text-xs text-gray-500 mt-1">{preset.description}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Sections */}
      <div className="space-y-3">
        {/* 1. Empresa */}
        <Section title="Dados da Empresa" open={openSections.has('empresa')} onToggle={() => toggle('empresa')}>
          <input type="text" value={companyName} onChange={e => setCompanyName(e.target.value)}
            placeholder="Nome da empresa" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
          <input type="text" value={companyCnpj} onChange={e => setCompanyCnpj(e.target.value)}
            placeholder="CNPJ" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
          <input type="tel" value={companyPhone} onChange={e => setCompanyPhone(e.target.value)}
            placeholder="Telefone" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
          <input type="email" value={companyEmail} onChange={e => setCompanyEmail(e.target.value)}
            placeholder="Email" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
          <input type="text" value={companyAddress} onChange={e => setCompanyAddress(e.target.value)}
            placeholder="Endereço" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
        </Section>

        {/* 2. Logo */}
        <Section title="Logo" open={openSections.has('logo')} onToggle={() => toggle('logo')}>
          <input type="file" accept="image/png,image/jpeg" onChange={handleLogoUpload}
            className="text-sm text-gray-600" />
          {logoPreview && (
            <img src={logoPreview} alt="Logo" className="h-16 object-contain rounded border border-gray-200 p-1" />
          )}
          <div>
            <label className="block text-xs text-gray-500 mb-1">Posição</label>
            <ToggleButtons
              options={[{ value: 'left' as const, label: 'Esquerda' }, { value: 'center' as const, label: 'Centro' }, { value: 'right' as const, label: 'Direita' }]}
              value={tokenConfig.logo.alignment}
              onChange={v => updateLogo('alignment', v)}
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Tamanho</label>
            <ToggleButtons
              options={[{ value: 'small' as const, label: 'Pequeno' }, { value: 'medium' as const, label: 'Médio' }]}
              value={tokenConfig.logo.size}
              onChange={v => updateLogo('size', v)}
            />
          </div>
        </Section>

        {/* 3. Visual */}
        <Section title="Visual" open={openSections.has('visual')} onToggle={() => toggle('visual')}>
          <div className="grid grid-cols-2 gap-3">
            <ColorInput label="Cor principal" value={tokenConfig.colors.primary} onChange={v => updateColor('primary', v)} />
            <ColorInput label="Destaque (preços)" value={tokenConfig.colors.secondary} onChange={v => updateColor('secondary', v)} />
            <ColorInput label="Texto" value={tokenConfig.colors.text} onChange={v => updateColor('text', v)} />
            <ColorInput label="Texto sutil" value={tokenConfig.colors.muted} onChange={v => updateColor('muted', v)} />
            <ColorInput label="Bordas" value={tokenConfig.colors.border} onChange={v => updateColor('border', v)} />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Fonte</label>
            <select value={tokenConfig.typography.fontFamily}
              onChange={e => updateTypo('fontFamily', e.target.value as PdfBrandConfig['typography']['fontFamily'])}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white">
              <option value="helvetica">Helvetica</option>
              <option value="times">Times</option>
              <option value="courier">Courier</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Peso dos títulos</label>
            <ToggleButtons
              options={[{ value: 'bold' as const, label: 'Negrito' }, { value: 'normal' as const, label: 'Normal' }]}
              value={tokenConfig.typography.headingWeight}
              onChange={v => updateTypo('headingWeight', v)}
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Densidade</label>
            <ToggleButtons
              options={[
                { value: 'compact' as const, label: 'Compacto' },
                { value: 'normal' as const, label: 'Normal' },
                { value: 'spacious' as const, label: 'Espaçoso' },
              ]}
              value={tokenConfig.layout.density}
              onChange={v => updateLayout('density', v)}
            />
          </div>
        </Section>

        {/* 4. Observações */}
        <Section title="Observações e Rodapé" open={openSections.has('obs')} onToggle={() => toggle('obs')}>
          <textarea value={footerText} onChange={e => setFooterText(e.target.value)}
            rows={3} placeholder="Texto de observações do orçamento"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
          <div className="flex items-center gap-3">
            <label className="text-sm text-gray-700">Validade (dias):</label>
            <input type="number" value={validityDays} onChange={e => setValidityDays(Math.max(1, Math.min(90, Number(e.target.value))))}
              min={1} max={90} className="w-20 px-3 py-2 border border-gray-300 rounded-lg text-sm" />
          </div>
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input type="checkbox" checked={tokenConfig.layout.showNotes}
              onChange={e => updateLayout('showNotes', e.target.checked)}
              className="rounded border-gray-300" />
            Mostrar observações no PDF
          </label>
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input type="checkbox" checked={tokenConfig.layout.showFooter}
              onChange={e => updateLayout('showFooter', e.target.checked)}
              className="rounded border-gray-300" />
            Mostrar rodapé com validade
          </label>
        </Section>
      </div>

      {/* Live Preview Panel */}
      {previewOpen && (
        <div className="fixed bottom-0 left-0 right-0 h-[50vh] bg-white border-t border-gray-300 shadow-lg z-40
                        md:top-0 md:bottom-0 md:left-auto md:right-0 md:w-[400px] md:h-full md:border-t-0 md:border-l">
          <div className="flex items-center justify-between px-4 py-2 bg-gray-50 border-b border-gray-200">
            <span className="text-sm font-semibold text-gray-700">Preview do PDF</span>
            <button onClick={() => setPreviewOpen(false)} className="text-gray-400 hover:text-gray-600 text-lg">&times;</button>
          </div>
          <div className="h-[calc(100%-40px)] bg-gray-100">
            {previewUrl ? (
              <iframe src={previewUrl} className="w-full h-full" title="PDF Preview" />
            ) : (
              <div className="flex items-center justify-center h-full text-gray-400 text-sm">
                Gerando preview...
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
