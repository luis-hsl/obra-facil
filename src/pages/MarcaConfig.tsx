import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../lib/useAuth';
import { useBrandConfig } from '../lib/useBrandConfig';
import { supabase } from '../lib/supabase';
import { gerarPDF } from '../lib/gerarPDF';
import { DEFAULT_PDF_BRAND_CONFIG } from '../lib/pdf/defaults';
import { PDF_PRESETS } from '../lib/pdf/presets';
import type { BrandConfig, PdfBrandConfig } from '../types';
import type { PdfPreset } from '../types/pdfTokens';
import type { Orcamento, OrcamentoItem } from '../types';

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
// Template card mini-preview
// ============================================================

function TemplatePreviewIcon({ preset, color, active }: { preset: PdfPreset; color: string; active: boolean }) {
  const style = preset.budgetTable.style;
  return (
    <div className={`w-full aspect-[3/4] rounded-md border-2 p-1.5 flex flex-col gap-0.5 transition-all ${
      active ? 'border-blue-500 shadow-sm' : 'border-slate-200'
    }`}>
      {/* header bar */}
      <div className="h-1.5 rounded-sm" style={{ backgroundColor: preset.header.showBackground ? color : 'transparent', border: preset.header.showBackground ? 'none' : `1px solid ${color}` }} />
      {/* content lines */}
      {style === 'table' && (
        <>
          <div className="h-1 rounded-sm mt-0.5" style={{ backgroundColor: color, opacity: 0.7 }} />
          <div className="h-0.5 bg-slate-200 rounded-sm" />
          <div className="h-0.5 bg-slate-100 rounded-sm" />
          <div className="h-0.5 bg-slate-200 rounded-sm" />
          <div className="h-0.5 bg-slate-100 rounded-sm" />
        </>
      )}
      {style === 'cards' && (
        <>
          <div className="flex-1 rounded-sm border border-slate-200 mt-0.5">
            <div className="h-1 rounded-t-sm" style={{ backgroundColor: color }} />
          </div>
          <div className="flex-1 rounded-sm border border-slate-200">
            <div className="h-1 rounded-t-sm" style={{ backgroundColor: color }} />
          </div>
        </>
      )}
      {style === 'list' && (
        <>
          <div className="h-0.5 bg-slate-300 rounded-sm mt-1 w-3/4" />
          <div className="h-0.5 bg-slate-200 rounded-sm w-1/2 ml-1" />
          <div className="h-px bg-slate-100 my-0.5" />
          <div className="h-0.5 bg-slate-300 rounded-sm w-3/4" />
          <div className="h-0.5 bg-slate-200 rounded-sm w-1/2 ml-1" />
        </>
      )}
      {/* footer line */}
      <div className="h-px mt-auto" style={{ backgroundColor: color, opacity: 0.3 }} />
    </div>
  );
}

// ============================================================
// Main Component
// ============================================================

export default function MarcaConfig() {
  const { user } = useAuth();
  const { config, loading, saveConfig } = useBrandConfig();

  // Token state
  const [tokenConfig, setTokenConfig] = useState<PdfBrandConfig>(DEFAULT_PDF_BRAND_CONFIG);

  // Company data
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
  const [activeTab, setActiveTab] = useState<'template' | 'empresa'>('template');
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const prevUrlRef = useRef<string | null>(null);

  // Load saved config
  useEffect(() => {
    if (!config) {
      if (user?.user_metadata) {
        const m = user.user_metadata;
        if (m.empresa) setCompanyName(m.empresa);
        if (m.telefone) setCompanyPhone(m.telefone);
        if (m.cpf_cnpj) setCompanyCnpj(m.cpf_cnpj);
      }
      return;
    }
    setCompanyName(config.company_name || '');
    setCompanyCnpj(config.company_cnpj || '');
    setCompanyPhone(config.company_phone || '');
    setCompanyEmail(config.company_email || '');
    setCompanyAddress(config.company_address || '');
    setFooterText(config.footer_text || '');
    setValidityDays(config.validity_days || 15);
    setLogoUrl(config.logo_url || null);
    setLogoPreview(config.logo_url || null);

    const stored = config.pdf_template as Record<string, unknown> | null;
    if (stored && stored.version === 3) {
      setTokenConfig(stored as unknown as PdfBrandConfig);
    } else {
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

  // Build brand config for PDF
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

  // Live preview
  useEffect(() => {
    if (!previewOpen) return;
    const timer = setTimeout(async () => {
      try {
        const url = await gerarPDF({
          atendimento: MOCK_ATENDIMENTO, orcamento: MOCK_ORCAMENTO,
          produto: null, itens: MOCK_ITENS, produtosMap: MOCK_PRODUTOS_MAP,
          numeroParcelas: 10, taxaJuros: 2,
          brandConfig: buildBrandConfig(), logoBase64, preview: true,
        });
        if (url) {
          if (prevUrlRef.current) URL.revokeObjectURL(prevUrlRef.current);
          prevUrlRef.current = url as string;
          setPreviewUrl(url as string);
        }
      } catch (err) { console.error('Preview error:', err); }
    }, 400);
    return () => clearTimeout(timer);
  }, [previewOpen, buildBrandConfig, logoBase64]);

  useEffect(() => () => { if (prevUrlRef.current) URL.revokeObjectURL(prevUrlRef.current); }, []);

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
    setSaving(true); setMsg('');
    const updates: Partial<BrandConfig> = {
      company_name: companyName || null, company_cnpj: companyCnpj || null,
      company_phone: companyPhone || null, company_email: companyEmail || null,
      company_address: companyAddress || null, footer_text: footerText || null,
      validity_days: validityDays, logo_url: logoUrl,
      logo_position: tokenConfig.logo.alignment,
      primary_color: tokenConfig.colors.primary, secondary_color: tokenConfig.colors.text,
      accent_color: tokenConfig.colors.secondary, font_family: tokenConfig.typography.fontFamily,
      layout_style: tokenConfig.templateId, pdf_template: tokenConfig,
    };
    const { error } = await saveConfig(updates);
    setSaving(false);
    setMsg(error ? 'Erro ao salvar.' : 'Salvo!');
    setTimeout(() => setMsg(''), 3000);
  };

  if (loading) return <p className="text-slate-500 text-center py-10">Carregando...</p>;

  return (
    <div className={`transition-all ${previewOpen ? 'pb-[55vh] md:pb-0 md:pr-[440px]' : ''}`}>
      {/* Page header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
        <h2 className="text-2xl font-bold text-slate-900">Minha Marca</h2>
        <div className="flex gap-2">
          <button type="button" onClick={() => { setTokenConfig(DEFAULT_PDF_BRAND_CONFIG); setMsg('Resetado!'); setTimeout(() => setMsg(''), 2000); }}
            className="px-3 py-2 rounded-xl text-sm font-medium border border-slate-200 text-slate-500 hover:bg-slate-50 transition-colors">
            Resetar
          </button>
          <button type="button" onClick={() => setPreviewOpen(p => !p)}
            className={`px-3 py-2 rounded-xl text-sm font-medium border transition-colors ${
              previewOpen ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}>
            {previewOpen ? 'Fechar' : 'Preview'}
          </button>
          <button type="button" onClick={handleSave} disabled={saving}
            className="px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl text-sm font-semibold disabled:opacity-50 shadow-lg shadow-blue-500/20 hover:shadow-xl hover:shadow-blue-500/30 active:scale-[0.98] transition-all">
            {saving ? 'Salvando...' : 'Salvar'}
          </button>
        </div>
      </div>
      {msg && (
        <div className={`rounded-xl px-4 py-3 mb-4 ${msg.includes('Erro') ? 'bg-red-50 border border-red-200' : 'bg-emerald-50 border border-emerald-200'}`}>
          <p className={`text-sm font-medium ${msg.includes('Erro') ? 'text-red-600' : 'text-emerald-700'}`}>{msg}</p>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-100 p-1 rounded-xl mb-6">
        <button onClick={() => setActiveTab('template')}
          className={`flex-1 py-2.5 text-sm font-medium rounded-lg transition-colors ${
            activeTab === 'template' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
          }`}>
          Design do PDF
        </button>
        <button onClick={() => setActiveTab('empresa')}
          className={`flex-1 py-2.5 text-sm font-medium rounded-lg transition-colors ${
            activeTab === 'empresa' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
          }`}>
          Dados da Empresa
        </button>
      </div>

      {/* ============================================================ */}
      {/* TAB: Design do PDF */}
      {/* ============================================================ */}
      {activeTab === 'template' && (
        <div className="space-y-6">

          {/* Template selector */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-3">Escolha o estilo</label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {Object.values(PDF_PRESETS).map(preset => {
                const active = tokenConfig.templateId === preset.id;
                return (
                  <button key={preset.id} type="button"
                    onClick={() => setTokenConfig(t => ({ ...t, templateId: preset.id }))}
                    className={`rounded-xl border-2 p-3 text-center transition-all ${
                      active ? 'border-blue-500 bg-blue-50/50 shadow-sm' : 'border-slate-200 hover:border-slate-200 hover:bg-slate-50'
                    }`}>
                    <div className="w-12 mx-auto mb-2">
                      <TemplatePreviewIcon preset={preset} color={tokenConfig.colors.primary} active={active} />
                    </div>
                    <div className={`text-sm font-semibold ${active ? 'text-blue-700' : 'text-slate-800'}`}>{preset.label}</div>
                    <div className="text-[11px] text-slate-500 mt-0.5 leading-tight">{preset.description}</div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Cores */}
          <div className="bg-white rounded-xl border border-slate-100 p-4 shadow-sm">
            <h3 className="text-sm font-semibold text-slate-700 mb-3">Cores</h3>
            <div className="grid grid-cols-2 gap-x-4 gap-y-3">
              <div className="flex items-center gap-2.5">
                <input type="color" value={tokenConfig.colors.primary} onChange={e => updateColor('primary', e.target.value)}
                  className="w-8 h-8 rounded-md border border-slate-200 cursor-pointer p-0" />
                <span className="text-sm text-slate-600">Principal</span>
              </div>
              <div className="flex items-center gap-2.5">
                <input type="color" value={tokenConfig.colors.secondary} onChange={e => updateColor('secondary', e.target.value)}
                  className="w-8 h-8 rounded-md border border-slate-200 cursor-pointer p-0" />
                <span className="text-sm text-slate-600">Destaque</span>
              </div>
              <div className="flex items-center gap-2.5">
                <input type="color" value={tokenConfig.colors.text} onChange={e => updateColor('text', e.target.value)}
                  className="w-8 h-8 rounded-md border border-slate-200 cursor-pointer p-0" />
                <span className="text-sm text-slate-600">Texto</span>
              </div>
              <div className="flex items-center gap-2.5">
                <input type="color" value={tokenConfig.colors.muted} onChange={e => updateColor('muted', e.target.value)}
                  className="w-8 h-8 rounded-md border border-slate-200 cursor-pointer p-0" />
                <span className="text-sm text-slate-600">Sutil</span>
              </div>
              <div className="flex items-center gap-2.5">
                <input type="color" value={tokenConfig.colors.border} onChange={e => updateColor('border', e.target.value)}
                  className="w-8 h-8 rounded-md border border-slate-200 cursor-pointer p-0" />
                <span className="text-sm text-slate-600">Bordas</span>
              </div>
            </div>
            {/* Barra de preview das cores */}
            <div className="flex gap-1 mt-4 h-2 rounded-full overflow-hidden">
              <div className="flex-1 rounded-full" style={{ backgroundColor: tokenConfig.colors.primary }} />
              <div className="flex-1 rounded-full" style={{ backgroundColor: tokenConfig.colors.secondary }} />
              <div className="flex-1 rounded-full" style={{ backgroundColor: tokenConfig.colors.text }} />
              <div className="flex-1 rounded-full" style={{ backgroundColor: tokenConfig.colors.muted }} />
              <div className="flex-1 rounded-full" style={{ backgroundColor: tokenConfig.colors.border }} />
            </div>
          </div>

          {/* Tipografia e Densidade */}
          <div className="bg-white rounded-xl border border-slate-100 p-4 shadow-sm space-y-4">
            <h3 className="text-sm font-semibold text-slate-700">Tipografia</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-slate-500 mb-1.5">Fonte</label>
                <select value={tokenConfig.typography.fontFamily}
                  onChange={e => updateTypo('fontFamily', e.target.value as PdfBrandConfig['typography']['fontFamily'])}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm bg-white shadow-sm">
                  <option value="helvetica">Helvetica</option>
                  <option value="times">Times</option>
                  <option value="courier">Courier</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1.5">Titulo</label>
                <div className="flex gap-1.5">
                  {(['bold', 'normal'] as const).map(w => (
                    <button key={w} type="button" onClick={() => updateTypo('headingWeight', w)}
                      className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors ${
                        tokenConfig.typography.headingWeight === w
                          ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-slate-200 text-slate-500 hover:bg-slate-50'
                      }`}>
                      {w === 'bold' ? 'Negrito' : 'Normal'}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1.5">Densidade do layout</label>
              <div className="flex gap-1.5">
                {([
                  { v: 'compact' as const, l: 'Compacto' },
                  { v: 'normal' as const, l: 'Normal' },
                  { v: 'spacious' as const, l: 'Espaçoso' },
                ]).map(d => (
                  <button key={d.v} type="button" onClick={() => updateLayout('density', d.v)}
                    className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors ${
                      tokenConfig.layout.density === d.v
                        ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-slate-200 text-slate-500 hover:bg-slate-50'
                    }`}>
                    {d.l}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Observações e rodapé */}
          <div className="bg-white rounded-xl border border-slate-100 p-4 shadow-sm space-y-3">
            <h3 className="text-sm font-semibold text-slate-700">Observações e Rodapé</h3>
            <textarea value={footerText} onChange={e => setFooterText(e.target.value)}
              rows={2} placeholder="Ex: Orçamento válido por 15 dias..."
              className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm shadow-sm resize-none" />
            <div className="flex items-center gap-3">
              <label className="text-sm text-slate-600">Validade:</label>
              <div className="flex items-center gap-1.5">
                <input type="number" value={validityDays}
                  onChange={e => setValidityDays(Math.max(1, Math.min(90, Number(e.target.value))))}
                  min={1} max={90} className="w-16 px-2 py-1.5 border border-slate-200 rounded-xl text-sm text-center shadow-sm" />
                <span className="text-sm text-slate-500">dias</span>
              </div>
            </div>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 text-sm text-slate-600">
                <input type="checkbox" checked={tokenConfig.layout.showNotes}
                  onChange={e => updateLayout('showNotes', e.target.checked)}
                  className="rounded border-slate-200 text-blue-600" />
                Observações
              </label>
              <label className="flex items-center gap-2 text-sm text-slate-600">
                <input type="checkbox" checked={tokenConfig.layout.showFooter}
                  onChange={e => updateLayout('showFooter', e.target.checked)}
                  className="rounded border-slate-200 text-blue-600" />
                Rodapé
              </label>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* TAB: Dados da Empresa */}
      {/* ============================================================ */}
      {activeTab === 'empresa' && (
        <div className="space-y-6">

          {/* Logo */}
          <div className="bg-white rounded-xl border border-slate-100 p-4 shadow-sm space-y-4">
            <h3 className="text-sm font-semibold text-slate-700">Logo da empresa</h3>
            <div className="flex items-start gap-4">
              {logoPreview ? (
                <img src={logoPreview} alt="Logo" className="h-16 w-24 object-contain rounded-lg border border-slate-200 bg-slate-50 p-1" />
              ) : (
                <div className="h-16 w-24 rounded-lg border-2 border-dashed border-slate-200 bg-slate-50 flex items-center justify-center">
                  <svg className="w-6 h-6 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
              )}
              <div className="flex-1">
                <label className="inline-block px-3 py-1.5 bg-slate-100 text-slate-700 text-sm font-medium rounded-xl cursor-pointer hover:bg-slate-200 transition-colors">
                  Enviar logo
                  <input type="file" accept="image/png,image/jpeg" onChange={handleLogoUpload} className="hidden" />
                </label>
                <p className="text-xs text-slate-400 mt-1.5">PNG ou JPEG</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-slate-500 mb-1">Posição no PDF</label>
                <div className="flex gap-1.5">
                  {([
                    { v: 'left' as const, l: 'Esq.' },
                    { v: 'center' as const, l: 'Centro' },
                    { v: 'right' as const, l: 'Dir.' },
                  ]).map(p => (
                    <button key={p.v} type="button" onClick={() => updateLogo('alignment', p.v)}
                      className={`flex-1 py-1.5 rounded-md text-xs font-medium border transition-colors ${
                        tokenConfig.logo.alignment === p.v
                          ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-slate-200 text-slate-500 hover:bg-slate-50'
                      }`}>
                      {p.l}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">Tamanho</label>
                <div className="flex gap-1.5">
                  {([
                    { v: 'small' as const, l: 'Pequeno' },
                    { v: 'medium' as const, l: 'Medio' },
                  ]).map(s => (
                    <button key={s.v} type="button" onClick={() => updateLogo('size', s.v)}
                      className={`flex-1 py-1.5 rounded-md text-xs font-medium border transition-colors ${
                        tokenConfig.logo.size === s.v
                          ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-slate-200 text-slate-500 hover:bg-slate-50'
                      }`}>
                      {s.l}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Dados da empresa */}
          <div className="bg-white rounded-xl border border-slate-100 p-4 shadow-sm space-y-3">
            <h3 className="text-sm font-semibold text-slate-700">Informações</h3>
            <div>
              <label className="block text-xs text-slate-500 mb-1">Nome da empresa</label>
              <input type="text" value={companyName} onChange={e => setCompanyName(e.target.value)}
                placeholder="Ex: João Pisos & Revestimentos"
                className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-slate-500 mb-1">CNPJ / CPF</label>
                <input type="text" value={companyCnpj} onChange={e => setCompanyCnpj(e.target.value)}
                  placeholder="00.000.000/0000-00"
                  className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">Telefone</label>
                <input type="tel" value={companyPhone} onChange={e => setCompanyPhone(e.target.value)}
                  placeholder="(00) 00000-0000"
                  className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
              </div>
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">Email</label>
              <input type="email" value={companyEmail} onChange={e => setCompanyEmail(e.target.value)}
                placeholder="contato@empresa.com"
                className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">Endereço</label>
              <input type="text" value={companyAddress} onChange={e => setCompanyAddress(e.target.value)}
                placeholder="Rua, número, bairro — cidade/UF"
                className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
            </div>
          </div>

          {/* Resumo visual */}
          {companyName && (
            <div className="bg-slate-50 rounded-xl border border-slate-100 p-4">
              <p className="text-xs text-slate-400 mb-2 uppercase tracking-wider">Dados que aparecem no PDF</p>
              <p className="text-sm font-semibold text-slate-800">{companyName}</p>
              {companyCnpj && <p className="text-xs text-slate-500">{companyCnpj}</p>}
              <div className="flex gap-4 mt-1">
                {companyPhone && <p className="text-xs text-slate-500">{companyPhone}</p>}
                {companyEmail && <p className="text-xs text-slate-500">{companyEmail}</p>}
              </div>
              {companyAddress && <p className="text-xs text-slate-500 mt-0.5">{companyAddress}</p>}
            </div>
          )}
        </div>
      )}

      {/* Live Preview Panel */}
      {previewOpen && (
        <div className="fixed bottom-14 left-0 right-0 h-[50vh] bg-white border-t border-slate-200 shadow-2xl z-30
                        md:bottom-0 md:top-0 md:left-auto md:right-0 md:w-[420px] md:h-full md:border-t-0 md:border-l">
          <div className="flex items-center justify-between px-4 py-2.5 bg-slate-50 border-b border-slate-200">
            <span className="text-sm font-semibold text-slate-700">Preview do PDF</span>
            <button onClick={() => setPreviewOpen(false)}
              className="w-7 h-7 flex items-center justify-center rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <div className="h-[calc(100%-42px)] bg-slate-100">
            {previewUrl ? (
              <iframe src={previewUrl} className="w-full h-full" title="PDF Preview" />
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-slate-400 gap-2">
                <svg className="w-8 h-8 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                <span className="text-sm">Gerando preview...</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
