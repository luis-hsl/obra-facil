import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../lib/useAuth';
import { useBrandConfig } from '../lib/useBrandConfig';
import { supabase } from '../lib/supabase';
import { gerarPDF } from '../lib/gerarPDF';
import { DEFAULT_DOCUMENT_TEMPLATE } from '../lib/defaultDocumentTemplate';
import type { BrandConfig, DocumentTemplate } from '../types';

// ============================================================
// Helpers
// ============================================================

type SectionId = 'empresa' | 'logo' | 'cores' | 'cabecalho' | 'produtos' | 'cliente' | 'rodape';

const SECTION_LABELS: Record<SectionId, string> = {
  empresa: 'Dados da Empresa',
  logo: 'Logo',
  cores: 'Cores e Fonte',
  cabecalho: 'Cabeçalho',
  produtos: 'Estilo dos Produtos',
  cliente: 'Dados do Cliente',
  rodape: 'Rodapé / Observações',
};

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
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

// ============================================================
// Main component
// ============================================================

export default function MarcaConfig() {
  const { user } = useAuth();
  const { config, loading, saveConfig } = useBrandConfig();

  // Template state (single source of truth)
  const [template, setTemplate] = useState<DocumentTemplate>(DEFAULT_DOCUMENT_TEMPLATE);

  // Company data (persisted separately in brand_configs columns)
  const [companyName, setCompanyName] = useState('');
  const [companyCnpj, setCompanyCnpj] = useState('');
  const [companyPhone, setCompanyPhone] = useState('');
  const [companyEmail, setCompanyEmail] = useState('');
  const [companyAddress, setCompanyAddress] = useState('');
  const [footerText, setFooterText] = useState('');
  const [validityDays, setValidityDays] = useState(15);

  // Logo
  const [logoUrl, setLogoUrl] = useState('');
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);

  // UI state
  const [expandedSections, setExpandedSections] = useState<Set<SectionId>>(new Set(['empresa']));
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [pdfPreviewUrl, setPdfPreviewUrl] = useState<string | null>(null);
  const [generatingPdf, setGeneratingPdf] = useState(false);

  // Load saved config
  useEffect(() => {
    if (config) {
      setLogoUrl(config.logo_url || '');
      if (config.logo_url) setLogoPreview(config.logo_url);
      if (config.pdf_template && (config.pdf_template as DocumentTemplate).version === 2) {
        setTemplate(config.pdf_template as DocumentTemplate);
      }
      setCompanyName(config.company_name || '');
      setCompanyCnpj(config.company_cnpj || '');
      setCompanyPhone(config.company_phone || '');
      setCompanyEmail(config.company_email || '');
      setCompanyAddress(config.company_address || '');
      setFooterText(config.footer_text || '');
      setValidityDays(config.validity_days || 15);
    } else if (user) {
      const meta = user.user_metadata;
      if (meta?.empresa) setCompanyName(meta.empresa);
      if (meta?.telefone) setCompanyPhone(meta.telefone);
      if (meta?.cpf_cnpj) setCompanyCnpj(meta.cpf_cnpj);
    }
  }, [config, user]);

  // Template update helpers
  function updateBranding<K extends keyof DocumentTemplate['branding']>(key: K, value: DocumentTemplate['branding'][K]) {
    setTemplate(t => ({ ...t, branding: { ...t.branding, [key]: value } }));
  }
  function updateHeader<K extends keyof DocumentTemplate['layout_metadata']['header']>(key: K, value: DocumentTemplate['layout_metadata']['header'][K]) {
    setTemplate(t => ({
      ...t, layout_metadata: { ...t.layout_metadata, header: { ...t.layout_metadata.header, [key]: value } },
    }));
  }
  function updateHeaderTitle<K extends keyof DocumentTemplate['layout_metadata']['header']['title']>(key: K, value: DocumentTemplate['layout_metadata']['header']['title'][K]) {
    setTemplate(t => ({
      ...t, layout_metadata: {
        ...t.layout_metadata, header: {
          ...t.layout_metadata.header, title: { ...t.layout_metadata.header.title, [key]: value },
        },
      },
    }));
  }
  function updateBudgetTable<K extends keyof DocumentTemplate['budget_table']>(key: K, value: DocumentTemplate['budget_table'][K]) {
    setTemplate(t => ({ ...t, budget_table: { ...t.budget_table, [key]: value } }));
  }
  function updateTotals<K extends keyof DocumentTemplate['totals']>(key: K, value: DocumentTemplate['totals'][K]) {
    setTemplate(t => ({ ...t, totals: { ...t.totals, [key]: value } }));
  }
  function updateClientSection<K extends keyof DocumentTemplate['layout_metadata']['client_section']>(key: K, value: DocumentTemplate['layout_metadata']['client_section'][K]) {
    setTemplate(t => ({
      ...t, layout_metadata: { ...t.layout_metadata, client_section: { ...t.layout_metadata.client_section, [key]: value } },
    }));
  }
  function updateFooter<K extends keyof DocumentTemplate['layout_metadata']['footer']>(key: K, value: DocumentTemplate['layout_metadata']['footer'][K]) {
    setTemplate(t => ({
      ...t, layout_metadata: { ...t.layout_metadata, footer: { ...t.layout_metadata.footer, [key]: value } },
    }));
  }

  const toggleSection = (id: SectionId) => {
    setExpandedSections(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  // Upload logo
  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    setUploadingLogo(true);
    try {
      const ext = file.name.split('.').pop() || 'png';
      const path = `${user.id}/logo.${ext}`;
      await supabase.storage.from('brand').upload(path, file, { upsert: true });
      const { data: urlData } = supabase.storage.from('brand').getPublicUrl(path);
      setLogoUrl(urlData.publicUrl);
      setLogoPreview(URL.createObjectURL(file));
    } catch {
      setMessage({ type: 'error', text: 'Erro ao enviar logo.' });
    } finally {
      setUploadingLogo(false);
    }
  };

  // Test PDF
  const handleTestPDF = async () => {
    setGeneratingPdf(true);
    setMessage(null);
    try {
      const brandForTest: BrandConfig = {
        id: '', user_id: '', created_at: '', updated_at: '',
        logo_url: logoUrl || null, logo_position: 'left',
        primary_color: template.branding.primary_color,
        secondary_color: template.branding.secondary_color,
        accent_color: template.branding.accent_color,
        company_name: companyName || null, company_cnpj: companyCnpj || null,
        company_phone: companyPhone || null, company_email: companyEmail || null,
        company_address: companyAddress || null, footer_text: footerText || null,
        validity_days: validityDays, layout_style: 'classic',
        font_family: template.branding.font_family,
        pdf_template: template,
      };

      let logoBase64: string | null = null;
      if (logoUrl) {
        try {
          const resp = await fetch(logoUrl);
          const blob = await resp.blob();
          logoBase64 = await new Promise<string>((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.readAsDataURL(blob);
          });
        } catch { /* logo failed */ }
      }

      const url = await gerarPDF({
        atendimento: {
          cliente_nome: 'João da Silva',
          cliente_telefone: '(11) 99999-1234',
          endereco: 'Rua Exemplo', numero: '123',
          complemento: 'Apto 45', bairro: 'Centro',
          cidade: 'São Paulo', tipo_servico: 'Piso Laminado',
        },
        orcamento: {
          id: 'test', atendimento_id: '', produto_id: null,
          area_total: 50, area_com_perda: 55, perda_percentual: 10,
          valor_total: 5500, status: 'enviado', observacoes: null,
          forma_pagamento: 'parcelado', numero_parcelas: 10,
          taxa_juros_mensal: 2, valor_parcela: null, valor_total_parcelado: null,
          created_at: '',
        },
        produto: null,
        itens: [
          { id: '1', orcamento_id: 'test', produto_id: null,
            area_total: 50, area_com_perda: 55, perda_percentual: 10,
            preco_por_m2: 110, valor_total: 5500, created_at: '' },
          { id: '2', orcamento_id: 'test', produto_id: null,
            area_total: 50, area_com_perda: 55, perda_percentual: 10,
            preco_por_m2: 85, valor_total: 4250, created_at: '' },
        ],
        produtosMap: {},
        brandConfig: brandForTest,
        logoBase64,
        preview: true,
      });

      if (url) setPdfPreviewUrl(url as string);
    } catch (err) {
      setMessage({ type: 'error', text: `Erro ao gerar PDF: ${err instanceof Error ? err.message : 'desconhecido'}` });
    } finally {
      setGeneratingPdf(false);
    }
  };

  // Save
  const handleSave = async () => {
    setSaving(true);
    setMessage(null);

    const templateToSave: DocumentTemplate = {
      ...template,
      company_fields: [
        companyName ? { label: companyName, value: companyName, type: 'text' as const, style: 'bold' as const, fontSize: 10 } : null,
        companyCnpj ? { label: companyCnpj, value: companyCnpj, type: 'cnpj' as const, style: 'normal' as const, fontSize: 8 } : null,
        companyPhone ? { label: companyPhone, value: companyPhone, type: 'phone' as const, style: 'normal' as const, fontSize: 8 } : null,
        companyEmail ? { label: companyEmail, value: companyEmail, type: 'email' as const, style: 'normal' as const, fontSize: 8 } : null,
        companyAddress ? { label: companyAddress, value: companyAddress, type: 'address' as const, style: 'normal' as const, fontSize: 8 } : null,
      ].filter((f): f is NonNullable<typeof f> => f !== null),
      observations: {
        ...template.observations,
        default_text: footerText || template.observations.default_text,
      },
    };

    const { error } = await saveConfig({
      logo_url: logoUrl || null,
      pdf_template: templateToSave as any,
      company_name: companyName || null,
      company_cnpj: companyCnpj || null,
      company_phone: companyPhone || null,
      company_email: companyEmail || null,
      company_address: companyAddress || null,
      footer_text: footerText || null,
      validity_days: validityDays,
    });

    if (error) {
      setMessage({ type: 'error', text: 'Erro ao salvar.' });
    } else {
      setMessage({ type: 'success', text: 'Configuração salva!' });
    }
    setSaving(false);
  };

  if (loading) {
    return <div className="flex items-center justify-center py-12"><p className="text-gray-500">Carregando...</p></div>;
  }

  // ============================================================
  // Render
  // ============================================================

  const renderSection = (id: SectionId, children: React.ReactNode) => {
    const isOpen = expandedSections.has(id);
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <button onClick={() => toggleSection(id)}
          className="w-full flex items-center justify-between px-5 py-3.5 text-left">
          <span className="font-semibold text-gray-900">{SECTION_LABELS[id]}</span>
          <span className={`text-gray-400 text-lg transition-transform ${isOpen ? 'rotate-90' : ''}`}>›</span>
        </button>
        {isOpen && (
          <div className="px-5 pb-5 border-t border-gray-100 pt-4 space-y-4">
            {children}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-gray-900">Minha Marca</h1>
      <p className="text-gray-600 text-sm">
        Configure a identidade visual do seu orçamento. Use "Testar PDF" para ver o resultado.
      </p>

      {message && (
        <div className={`p-3 rounded-lg text-sm ${message.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
          {message.text}
        </div>
      )}

      {/* 1. Dados da Empresa */}
      {renderSection('empresa', <>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Nome</label>
          <input type="text" value={companyName} onChange={e => setCompanyName(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">CNPJ</label>
            <input type="text" value={companyCnpj} onChange={e => setCompanyCnpj(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Telefone</label>
            <input type="text" value={companyPhone} onChange={e => setCompanyPhone(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
          <input type="email" value={companyEmail} onChange={e => setCompanyEmail(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Endereço</label>
          <input type="text" value={companyAddress} onChange={e => setCompanyAddress(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
        </div>
      </>)}

      {/* 2. Logo */}
      {renderSection('logo', <>
        <input ref={logoInputRef} type="file" accept="image/png,image/jpeg,image/jpg" onChange={handleLogoUpload} className="hidden" />
        <div className="flex items-center gap-4">
          {logoPreview && (
            <img src={logoPreview} alt="Logo" className="h-16 object-contain rounded border border-gray-200 p-1" />
          )}
          <button onClick={() => logoInputRef.current?.click()} disabled={uploadingLogo}
            className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50">
            {uploadingLogo ? 'Enviando...' : logoPreview ? 'Trocar Logo' : 'Enviar Logo'}
          </button>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Posição do logo</label>
          <ToggleButtons
            options={[{ value: 'left', label: 'Esquerda' }, { value: 'center', label: 'Centro' }, { value: 'right', label: 'Direita' }]}
            value={template.layout_metadata.header.logo_position}
            onChange={v => updateHeader('logo_position', v)}
          />
        </div>
      </>)}

      {/* 3. Cores e Fonte */}
      {renderSection('cores', <>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <ColorInput label="Cor principal" value={template.branding.primary_color} onChange={v => updateBranding('primary_color', v)} />
          <ColorInput label="Cor secundária" value={template.branding.secondary_color} onChange={v => updateBranding('secondary_color', v)} />
          <ColorInput label="Destaque de preço" value={template.branding.price_highlight_color} onChange={v => updateBranding('price_highlight_color', v)} />
          <ColorInput label="Texto do cabeçalho" value={template.branding.header_text_color} onChange={v => updateBranding('header_text_color', v)} />
          <ColorInput label="Bordas" value={template.branding.border_color} onChange={v => updateBranding('border_color', v)} />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Fonte</label>
          <select value={template.branding.font_family}
            onChange={e => updateBranding('font_family', e.target.value as 'helvetica' | 'times' | 'courier')}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm">
            <option value="helvetica">Helvetica</option>
            <option value="times">Times</option>
            <option value="courier">Courier</option>
          </select>
        </div>
      </>)}

      {/* 4. Cabeçalho */}
      {renderSection('cabecalho', <>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Título do documento</label>
          <input type="text" value={template.layout_metadata.header.title.text}
            onChange={e => updateHeaderTitle('text', e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Alinhamento do título</label>
          <ToggleButtons
            options={[{ value: 'left', label: 'Esquerda' }, { value: 'center', label: 'Centro' }, { value: 'right', label: 'Direita' }]}
            value={template.layout_metadata.header.title.alignment}
            onChange={v => updateHeaderTitle('alignment', v)}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Tamanho da fonte</label>
          <input type="number" min={12} max={24}
            value={template.layout_metadata.header.title.font_size}
            onChange={e => updateHeaderTitle('font_size', Number(e.target.value))}
            className="w-20 border border-gray-300 rounded-lg px-3 py-2 text-sm" />
        </div>
        <div className="flex items-center gap-3">
          <input type="checkbox"
            checked={template.layout_metadata.header.background_color !== null}
            onChange={e => updateHeader('background_color', e.target.checked ? template.branding.primary_color : null)}
            className="rounded border-gray-300" />
          <span className="text-sm text-gray-700">Fundo colorido</span>
          {template.layout_metadata.header.background_color && (
            <input type="color" value={template.layout_metadata.header.background_color}
              onChange={e => updateHeader('background_color', e.target.value)}
              className="w-8 h-8 rounded border border-gray-300 cursor-pointer" />
          )}
        </div>
        <div className="flex items-center gap-3">
          <input type="checkbox"
            checked={template.layout_metadata.header.show_separator}
            onChange={e => updateHeader('show_separator', e.target.checked)}
            className="rounded border-gray-300" />
          <span className="text-sm text-gray-700">Mostrar separador</span>
          {template.layout_metadata.header.show_separator && (
            <input type="color" value={template.layout_metadata.header.separator_color || template.branding.primary_color}
              onChange={e => updateHeader('separator_color', e.target.value)}
              className="w-8 h-8 rounded border border-gray-300 cursor-pointer" />
          )}
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Posição das infos da empresa</label>
          <ToggleButtons
            options={[
              { value: 'left', label: 'Esquerda' },
              { value: 'right', label: 'Direita' },
              { value: 'below-logo', label: 'Abaixo do logo' },
            ]}
            value={template.layout_metadata.header.company_info_position}
            onChange={v => updateHeader('company_info_position', v)}
          />
        </div>
      </>)}

      {/* 5. Estilo dos Produtos */}
      {renderSection('produtos', <>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Estilo de exibição</label>
          <ToggleButtons
            options={[
              { value: 'cards', label: 'Cards' },
              { value: 'table', label: 'Tabela' },
              { value: 'list', label: 'Lista' },
            ]}
            value={template.budget_table.style}
            onChange={v => updateBudgetTable('style', v)}
          />
        </div>
        <div className="space-y-3 pt-2">
          <div className="flex items-center gap-3">
            <input type="checkbox" checked={template.totals.show_discount}
              onChange={e => updateTotals('show_discount', e.target.checked)}
              className="rounded border-gray-300" />
            <span className="text-sm text-gray-700">Mostrar desconto à vista</span>
          </div>
          {template.totals.show_discount && (
            <div className="ml-7 grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Label</label>
                <input type="text" value={template.totals.discount_label}
                  onChange={e => updateTotals('discount_label', e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Desconto (%)</label>
                <input type="number" min={0} max={50} value={template.totals.discount_percent}
                  onChange={e => updateTotals('discount_percent', Number(e.target.value))}
                  className="w-20 border border-gray-300 rounded-lg px-3 py-1.5 text-sm" />
              </div>
            </div>
          )}
          <div className="flex items-center gap-3">
            <input type="checkbox" checked={template.totals.show_installments}
              onChange={e => updateTotals('show_installments', e.target.checked)}
              className="rounded border-gray-300" />
            <span className="text-sm text-gray-700">Mostrar parcelamento</span>
          </div>
          {template.totals.show_installments && (
            <div className="ml-7">
              <label className="block text-xs text-gray-500 mb-1">Label</label>
              <input type="text" value={template.totals.installment_label}
                onChange={e => updateTotals('installment_label', e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm" />
            </div>
          )}
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Posição dos totais</label>
          <ToggleButtons
            options={[
              { value: 'per_item', label: 'Por item' },
              { value: 'summary_bottom', label: 'Resumo no final' },
            ]}
            value={template.totals.position}
            onChange={v => updateTotals('position', v)}
          />
        </div>
      </>)}

      {/* 6. Dados do Cliente */}
      {renderSection('cliente', <>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Estilo</label>
          <ToggleButtons
            options={[
              { value: 'inline', label: 'Inline' },
              { value: 'card', label: 'Card' },
              { value: 'table', label: 'Tabela' },
            ]}
            value={template.layout_metadata.client_section.style}
            onChange={v => updateClientSection('style', v)}
          />
        </div>
        <div className="flex items-center gap-3">
          <input type="checkbox" checked={template.layout_metadata.client_section.label_bold}
            onChange={e => updateClientSection('label_bold', e.target.checked)}
            className="rounded border-gray-300" />
          <span className="text-sm text-gray-700">Labels em negrito</span>
        </div>
        {template.layout_metadata.client_section.style !== 'inline' && (
          <div className="flex items-center gap-3">
            <input type="checkbox" checked={template.layout_metadata.client_section.border}
              onChange={e => updateClientSection('border', e.target.checked)}
              className="rounded border-gray-300" />
            <span className="text-sm text-gray-700">Borda</span>
          </div>
        )}
      </>)}

      {/* 7. Rodapé */}
      {renderSection('rodape', <>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Texto de observações</label>
          <textarea value={footerText || template.observations.default_text}
            onChange={e => setFooterText(e.target.value)} rows={3}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" placeholder="Termos e condições..." />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Validade (dias)</label>
          <input type="number" value={validityDays} onChange={e => setValidityDays(Number(e.target.value))}
            min={1} max={90} className="w-24 border border-gray-300 rounded-lg px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Estilo do rodapé</label>
          <ToggleButtons
            options={[
              { value: 'line', label: 'Linha' },
              { value: 'bar', label: 'Barra' },
              { value: 'minimal', label: 'Mínimo' },
            ]}
            value={template.layout_metadata.footer.style}
            onChange={v => updateFooter('style', v)}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Alinhamento</label>
          <ToggleButtons
            options={[{ value: 'left', label: 'Esquerda' }, { value: 'center', label: 'Centro' }, { value: 'right', label: 'Direita' }]}
            value={template.layout_metadata.footer.text_alignment}
            onChange={v => updateFooter('text_alignment', v)}
          />
        </div>
      </>)}

      {/* Ações */}
      <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
        <div className="flex gap-3">
          <button onClick={handleTestPDF} disabled={generatingPdf}
            className="px-5 py-2.5 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50">
            {generatingPdf ? 'Gerando...' : 'Testar PDF'}
          </button>
          <button onClick={handleSave} disabled={saving}
            className="flex-1 px-5 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
            {saving ? 'Salvando...' : 'Salvar Configuração'}
          </button>
        </div>
      </div>

      {/* Preview modal */}
      {pdfPreviewUrl && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
          onClick={() => { URL.revokeObjectURL(pdfPreviewUrl); setPdfPreviewUrl(null); }}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-3xl h-[85vh] flex flex-col"
            onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-3 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">Preview do Orçamento</h3>
              <button onClick={() => { URL.revokeObjectURL(pdfPreviewUrl); setPdfPreviewUrl(null); }}
                className="p-1 rounded-lg hover:bg-gray-100 text-gray-500">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="flex-1 p-2">
              <iframe src={pdfPreviewUrl} className="w-full h-full rounded-lg border border-gray-200" title="Preview PDF" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
