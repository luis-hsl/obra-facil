import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../lib/useAuth';
import { useBrandConfig } from '../lib/useBrandConfig';
import { supabase } from '../lib/supabase';
import { pdfFirstPageToBase64, pdfFirstPageToDataUrl } from '../lib/pdfToImage';
import { fetchImageAsBase64 } from '../lib/imageUtils';
import { gerarPDF } from '../lib/gerarPDF';
import type { BrandConfig, BrandExtraction } from '../types';

export default function MarcaConfig() {
  const { user } = useAuth();
  const { config, loading, saveConfig } = useBrandConfig();

  // Form state
  const [logoUrl, setLogoUrl] = useState('');
  const [logoPosition, setLogoPosition] = useState<BrandConfig['logo_position']>('left');
  const [primaryColor, setPrimaryColor] = useState('#1e40af');
  const [secondaryColor, setSecondaryColor] = useState('#374151');
  const [accentColor, setAccentColor] = useState('#059669');
  const [companyName, setCompanyName] = useState('');
  const [companyCnpj, setCompanyCnpj] = useState('');
  const [companyPhone, setCompanyPhone] = useState('');
  const [companyEmail, setCompanyEmail] = useState('');
  const [companyAddress, setCompanyAddress] = useState('');
  const [footerText, setFooterText] = useState('');
  const [validityDays, setValidityDays] = useState(15);
  const [layoutStyle, setLayoutStyle] = useState<BrandConfig['layout_style']>('classic');
  const [fontFamily, setFontFamily] = useState<BrandConfig['font_family']>('helvetica');

  // UI state
  const [templatePreview, setTemplatePreview] = useState<string | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [extracting, setExtracting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadingTemplate, setUploadingTemplate] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [pdfBase64ForExtract, setPdfBase64ForExtract] = useState<string | null>(null);
  const [pdfPreviewUrl, setPdfPreviewUrl] = useState<string | null>(null);

  const templateInputRef = useRef<HTMLInputElement>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);

  // Preencher form quando config carrega
  useEffect(() => {
    if (config) {
      setLogoUrl(config.logo_url || '');
      setLogoPosition(config.logo_position);
      setPrimaryColor(config.primary_color);
      setSecondaryColor(config.secondary_color);
      setAccentColor(config.accent_color);
      setCompanyName(config.company_name || '');
      setCompanyCnpj(config.company_cnpj || '');
      setCompanyPhone(config.company_phone || '');
      setCompanyEmail(config.company_email || '');
      setCompanyAddress(config.company_address || '');
      setFooterText(config.footer_text || '');
      setValidityDays(config.validity_days);
      setLayoutStyle(config.layout_style);
      setFontFamily(config.font_family);
      if (config.logo_url) setLogoPreview(config.logo_url);
    } else if (user) {
      // Pré-preencher com dados do cadastro
      const meta = user.user_metadata;
      if (meta?.empresa) setCompanyName(meta.empresa);
      if (meta?.telefone) setCompanyPhone(meta.telefone);
      if (meta?.cpf_cnpj) setCompanyCnpj(meta.cpf_cnpj);
    }
  }, [config, user]);

  // Upload do template PDF
  const handleTemplateUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    setUploadingTemplate(true);
    setMessage(null);

    try {
      // Renderizar preview
      const dataUrl = await pdfFirstPageToDataUrl(file);
      setTemplatePreview(dataUrl);

      // Guardar base64 para extração
      const base64 = await pdfFirstPageToBase64(file);
      setPdfBase64ForExtract(base64);

      // Upload para storage
      const ext = file.name.split('.').pop() || 'pdf';
      const path = `${user.id}/template.${ext}`;
      await supabase.storage.from('brand').upload(path, file, { upsert: true });
      const { data: urlData } = supabase.storage.from('brand').getPublicUrl(path);

      await saveConfig({ template_pdf_url: urlData.publicUrl });
      setMessage({ type: 'success', text: 'Template enviado! Clique em "Extrair Identidade Visual" para analisar.' });
    } catch {
      setMessage({ type: 'error', text: 'Erro ao enviar template.' });
    } finally {
      setUploadingTemplate(false);
    }
  };

  // Extração AI
  const handleExtract = async () => {
    if (!pdfBase64ForExtract) {
      setMessage({ type: 'error', text: 'Envie um template PDF primeiro.' });
      return;
    }

    setExtracting(true);
    setMessage(null);

    try {
      const { data, error } = await supabase.functions.invoke('extract-brand', {
        body: { image_base64: pdfBase64ForExtract },
      });

      if (error) throw error;

      if (data?.error) {
        throw new Error(data.error);
      }

      const extraction = data as BrandExtraction;

      // Preencher form com dados extraídos
      if (extraction.colors) {
        if (extraction.colors.primary) setPrimaryColor(extraction.colors.primary);
        if (extraction.colors.secondary) setSecondaryColor(extraction.colors.secondary);
        if (extraction.colors.accent) setAccentColor(extraction.colors.accent);
      }
      if (extraction.company) {
        if (extraction.company.name) setCompanyName(extraction.company.name);
        if (extraction.company.cnpj) setCompanyCnpj(extraction.company.cnpj);
        if (extraction.company.phone) setCompanyPhone(extraction.company.phone);
        if (extraction.company.email) setCompanyEmail(extraction.company.email);
        if (extraction.company.address) setCompanyAddress(extraction.company.address);
      }
      if (extraction.footer_text) setFooterText(extraction.footer_text);
      if (extraction.layout_suggestion) setLayoutStyle(extraction.layout_suggestion);
      if (extraction.font_suggestion) setFontFamily(extraction.font_suggestion);

      setMessage({ type: 'success', text: 'Identidade visual extraída! Revise e ajuste os dados abaixo.' });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro desconhecido';
      setMessage({ type: 'error', text: `Erro na extração: ${msg}` });
    } finally {
      setExtracting(false);
    }
  };

  // Upload do logo
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

  // Salvar tudo
  const handleSave = async () => {
    setSaving(true);
    setMessage(null);

    const { error } = await saveConfig({
      logo_url: logoUrl || null,
      logo_position: logoPosition,
      primary_color: primaryColor,
      secondary_color: secondaryColor,
      accent_color: accentColor,
      company_name: companyName || null,
      company_cnpj: companyCnpj || null,
      company_phone: companyPhone || null,
      company_email: companyEmail || null,
      company_address: companyAddress || null,
      footer_text: footerText || null,
      validity_days: validityDays,
      layout_style: layoutStyle,
      font_family: fontFamily,
    });

    if (error) {
      setMessage({ type: 'error', text: 'Erro ao salvar.' });
    } else {
      setMessage({ type: 'success', text: 'Configuração salva com sucesso!' });
    }
    setSaving(false);
  };

  // Preview PDF
  const handlePreview = async () => {
    const brandForPreview: BrandConfig = {
      id: '', user_id: '', created_at: '', updated_at: '', template_pdf_url: null,
      logo_url: logoUrl || null,
      logo_position: logoPosition,
      primary_color: primaryColor,
      secondary_color: secondaryColor,
      accent_color: accentColor,
      company_name: companyName || null,
      company_cnpj: companyCnpj || null,
      company_phone: companyPhone || null,
      company_email: companyEmail || null,
      company_address: companyAddress || null,
      footer_text: footerText || null,
      validity_days: validityDays,
      layout_style: layoutStyle,
      font_family: fontFamily,
    };

    let logoB64: string | null = null;
    if (logoUrl) {
      try {
        logoB64 = await fetchImageAsBase64(logoUrl);
      } catch { /* sem logo no preview */ }
    }

    const url = gerarPDF({
      atendimento: {
        cliente_nome: 'João da Silva',
        cliente_telefone: '(11) 99999-1234',
        endereco: 'Rua Exemplo',
        numero: '123',
        complemento: 'Apto 45',
        bairro: 'Centro',
        cidade: 'São Paulo',
        tipo_servico: 'Piso Laminado',
      },
      orcamento: {
        id: 'preview', atendimento_id: '', produto_id: null,
        area_total: 50, area_com_perda: 55, perda_percentual: 10,
        valor_total: 5500, status: 'enviado', observacoes: null,
        forma_pagamento: 'parcelado', numero_parcelas: 10,
        taxa_juros_mensal: 2, valor_parcela: null, valor_total_parcelado: null,
        created_at: '',
      },
      produto: null,
      itens: [
        {
          id: '1', orcamento_id: 'preview', produto_id: null,
          area_total: 50, area_com_perda: 55, perda_percentual: 10,
          preco_por_m2: 110, valor_total: 5500, created_at: '',
        },
        {
          id: '2', orcamento_id: 'preview', produto_id: null,
          area_total: 50, area_com_perda: 55, perda_percentual: 10,
          preco_por_m2: 85, valor_total: 4250, created_at: '',
        },
      ],
      produtosMap: {},
      brandConfig: brandForPreview,
      logoBase64: logoB64,
      preview: true,
    });

    if (url) setPdfPreviewUrl(url);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-gray-500">Carregando...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Minha Marca</h1>
      <p className="text-gray-600 text-sm">
        Configure a identidade visual dos seus orçamentos. Envie seu modelo atual e extraia as cores e dados automaticamente.
      </p>

      {message && (
        <div className={`p-3 rounded-lg text-sm ${message.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
          {message.text}
        </div>
      )}

      {/* 1. Upload Template */}
      <section className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
        <h2 className="text-lg font-semibold text-gray-900 mb-3">Template do Orçamento</h2>
        <p className="text-sm text-gray-500 mb-4">
          Envie o PDF que você normalmente manda para seus clientes. Vamos extrair as cores, dados e estilo.
        </p>

        <input
          ref={templateInputRef}
          type="file"
          accept=".pdf"
          onChange={handleTemplateUpload}
          className="hidden"
        />

        <div className="flex gap-3">
          <button
            onClick={() => templateInputRef.current?.click()}
            disabled={uploadingTemplate}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
          >
            {uploadingTemplate ? 'Enviando...' : 'Enviar PDF'}
          </button>

          <button
            onClick={handleExtract}
            disabled={!pdfBase64ForExtract || extracting}
            className="px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700 disabled:opacity-50"
          >
            {extracting ? 'Analisando...' : 'Extrair Identidade Visual'}
          </button>
        </div>

        {templatePreview && (
          <div className="mt-4">
            <img src={templatePreview} alt="Preview do template" className="max-h-64 rounded-lg border border-gray-200" />
          </div>
        )}
      </section>

      {/* 2. Identidade Visual */}
      <section className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Identidade Visual</h2>

        {/* Cores */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Cor Primária</label>
            <div className="flex items-center gap-2">
              <input type="color" value={primaryColor} onChange={e => setPrimaryColor(e.target.value)} className="w-10 h-10 rounded cursor-pointer border-0" />
              <input type="text" value={primaryColor} onChange={e => setPrimaryColor(e.target.value)} className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Cor Secundária</label>
            <div className="flex items-center gap-2">
              <input type="color" value={secondaryColor} onChange={e => setSecondaryColor(e.target.value)} className="w-10 h-10 rounded cursor-pointer border-0" />
              <input type="text" value={secondaryColor} onChange={e => setSecondaryColor(e.target.value)} className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Cor Destaque</label>
            <div className="flex items-center gap-2">
              <input type="color" value={accentColor} onChange={e => setAccentColor(e.target.value)} className="w-10 h-10 rounded cursor-pointer border-0" />
              <input type="text" value={accentColor} onChange={e => setAccentColor(e.target.value)} className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono" />
            </div>
          </div>
        </div>

        {/* Logo */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">Logo</label>
          <input
            ref={logoInputRef}
            type="file"
            accept="image/png,image/jpeg,image/jpg"
            onChange={handleLogoUpload}
            className="hidden"
          />
          <div className="flex items-center gap-4">
            {logoPreview && (
              <img src={logoPreview} alt="Logo" className="h-16 object-contain rounded border border-gray-200 p-1" />
            )}
            <button
              onClick={() => logoInputRef.current?.click()}
              disabled={uploadingLogo}
              className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              {uploadingLogo ? 'Enviando...' : logoPreview ? 'Trocar Logo' : 'Enviar Logo (PNG/JPG)'}
            </button>
          </div>
        </div>

        {/* Posição do logo */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Posição do Logo</label>
          <div className="flex gap-2">
            {(['left', 'center', 'right'] as const).map(pos => (
              <button
                key={pos}
                onClick={() => setLogoPosition(pos)}
                className={`flex-1 py-2 rounded-lg text-sm font-medium border ${
                  logoPosition === pos
                    ? 'bg-blue-50 border-blue-300 text-blue-700'
                    : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                }`}
              >
                {pos === 'left' ? 'Esquerda' : pos === 'center' ? 'Centro' : 'Direita'}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* 3. Dados da Empresa */}
      <section className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Dados da Empresa</h2>
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nome da Empresa</label>
            <input type="text" value={companyName} onChange={e => setCompanyName(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" placeholder="Ex: Pisos & Revestimentos Ltda" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">CNPJ</label>
              <input type="text" value={companyCnpj} onChange={e => setCompanyCnpj(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" placeholder="00.000.000/0000-00" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Telefone</label>
              <input type="text" value={companyPhone} onChange={e => setCompanyPhone(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" placeholder="(11) 99999-9999" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input type="email" value={companyEmail} onChange={e => setCompanyEmail(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" placeholder="contato@empresa.com" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Endereço</label>
            <input type="text" value={companyAddress} onChange={e => setCompanyAddress(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" placeholder="Rua, Número - Bairro, Cidade/UF" />
          </div>
        </div>
      </section>

      {/* 4. Configuração do PDF */}
      <section className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Configuração do PDF</h2>

        {/* Layout */}
        <div className="mb-5">
          <label className="block text-sm font-medium text-gray-700 mb-2">Estilo do Layout</label>
          <div className="grid grid-cols-3 gap-3">
            {([
              { value: 'classic' as const, label: 'Clássico', desc: 'Logo + empresa no topo, seções organizadas' },
              { value: 'modern' as const, label: 'Moderno', desc: 'Header colorido, cards com bordas arredondadas' },
              { value: 'minimal' as const, label: 'Minimal', desc: 'Clean, espaçamento amplo, tipografia leve' },
            ]).map(opt => (
              <button
                key={opt.value}
                onClick={() => setLayoutStyle(opt.value)}
                className={`p-3 rounded-xl border text-left ${
                  layoutStyle === opt.value
                    ? 'bg-blue-50 border-blue-300'
                    : 'border-gray-200 hover:bg-gray-50'
                }`}
              >
                <div className="font-medium text-sm text-gray-900">{opt.label}</div>
                <div className="text-xs text-gray-500 mt-1">{opt.desc}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Fonte */}
        <div className="mb-5">
          <label className="block text-sm font-medium text-gray-700 mb-1">Fonte</label>
          <select
            value={fontFamily}
            onChange={e => setFontFamily(e.target.value as BrandConfig['font_family'])}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
          >
            <option value="helvetica">Helvetica (Sans-serif)</option>
            <option value="times">Times (Serif)</option>
            <option value="courier">Courier (Monospace)</option>
          </select>
        </div>

        {/* Rodapé */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">Texto do Rodapé</label>
          <textarea
            value={footerText}
            onChange={e => setFooterText(e.target.value)}
            rows={3}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
            placeholder="Termos e condições... Use {validity_days} para inserir os dias de validade."
          />
        </div>

        {/* Validade */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Dias de Validade</label>
          <input
            type="number"
            value={validityDays}
            onChange={e => setValidityDays(Number(e.target.value))}
            min={1}
            max={90}
            className="w-24 border border-gray-300 rounded-lg px-3 py-2 text-sm"
          />
        </div>
      </section>

      {/* 5. Ações */}
      <section className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
        <div className="flex gap-3">
          <button
            onClick={handlePreview}
            className="px-5 py-2.5 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Visualizar PDF
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 px-5 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? 'Salvando...' : 'Salvar Configuração'}
          </button>
        </div>
      </section>

      {/* Modal Preview PDF */}
      {pdfPreviewUrl && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setPdfPreviewUrl(null)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-3xl h-[85vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-3 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">Preview do Orçamento</h3>
              <button
                onClick={() => setPdfPreviewUrl(null)}
                className="p-1 rounded-lg hover:bg-gray-100 text-gray-500"
              >
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
