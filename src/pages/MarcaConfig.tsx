import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../lib/useAuth';
import { useBrandConfig } from '../lib/useBrandConfig';
import { supabase } from '../lib/supabase';
import { pdfFirstPageToBase64, pdfFirstPageToDataUrl } from '../lib/pdfToImage';
import { fetchImageAsBase64 } from '../lib/imageUtils';
import { gerarPDF } from '../lib/gerarPDF';
import type { BrandConfig, PdfTemplate } from '../types';

export default function MarcaConfig() {
  const { user } = useAuth();
  const { config, loading, saveConfig } = useBrandConfig();

  // State
  const [templatePreview, setTemplatePreview] = useState<string | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [logoUrl, setLogoUrl] = useState('');
  const [extracting, setExtracting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadingTemplate, setUploadingTemplate] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [pdfBase64ForExtract, setPdfBase64ForExtract] = useState<string | null>(null);
  const [pdfPreviewUrl, setPdfPreviewUrl] = useState<string | null>(null);
  const [template, setTemplate] = useState<PdfTemplate | null>(null);

  // Editable fields from template
  const [companyName, setCompanyName] = useState('');
  const [companyCnpj, setCompanyCnpj] = useState('');
  const [companyPhone, setCompanyPhone] = useState('');
  const [companyEmail, setCompanyEmail] = useState('');
  const [companyAddress, setCompanyAddress] = useState('');
  const [footerText, setFooterText] = useState('');
  const [validityDays, setValidityDays] = useState(15);

  const templateInputRef = useRef<HTMLInputElement>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);

  // Load from saved config
  useEffect(() => {
    if (config) {
      setLogoUrl(config.logo_url || '');
      if (config.logo_url) setLogoPreview(config.logo_url);
      if (config.pdf_template) {
        setTemplate(config.pdf_template);
        setCompanyName(config.pdf_template.company.name || '');
        setCompanyCnpj(config.pdf_template.company.cnpj || '');
        setCompanyPhone(config.pdf_template.company.phone || '');
        setCompanyEmail(config.pdf_template.company.email || '');
        setCompanyAddress(config.pdf_template.company.address || '');
        setFooterText(config.pdf_template.footer.text || '');
        setValidityDays(config.pdf_template.validityDays || 15);
      } else {
        setCompanyName(config.company_name || '');
        setCompanyCnpj(config.company_cnpj || '');
        setCompanyPhone(config.company_phone || '');
        setCompanyEmail(config.company_email || '');
        setCompanyAddress(config.company_address || '');
        setFooterText(config.footer_text || '');
        setValidityDays(config.validity_days || 15);
      }
    } else if (user) {
      const meta = user.user_metadata;
      if (meta?.empresa) setCompanyName(meta.empresa);
      if (meta?.telefone) setCompanyPhone(meta.telefone);
      if (meta?.cpf_cnpj) setCompanyCnpj(meta.cpf_cnpj);
    }
  }, [config, user]);

  // Upload template PDF
  const handleTemplateUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    setUploadingTemplate(true);
    setMessage(null);
    try {
      const dataUrl = await pdfFirstPageToDataUrl(file);
      setTemplatePreview(dataUrl);

      const base64 = await pdfFirstPageToBase64(file);
      setPdfBase64ForExtract(base64);

      const ext = file.name.split('.').pop() || 'pdf';
      const path = `${user.id}/template.${ext}`;
      await supabase.storage.from('brand').upload(path, file, { upsert: true });
      const { data: urlData } = supabase.storage.from('brand').getPublicUrl(path);
      await saveConfig({ template_pdf_url: urlData.publicUrl });

      setMessage({ type: 'success', text: 'Template enviado! Clique em "Extrair e Gerar Template" para analisar.' });
    } catch {
      setMessage({ type: 'error', text: 'Erro ao enviar template.' });
    } finally {
      setUploadingTemplate(false);
    }
  };

  // AI Extraction
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
      if (data?.error) throw new Error(data.error);

      const extracted = data as PdfTemplate;

      // Merge company editable data
      setTemplate(extracted);
      if (extracted.company) {
        if (extracted.company.name) setCompanyName(extracted.company.name);
        if (extracted.company.cnpj) setCompanyCnpj(extracted.company.cnpj);
        if (extracted.company.phone) setCompanyPhone(extracted.company.phone);
        if (extracted.company.email) setCompanyEmail(extracted.company.email);
        if (extracted.company.address) setCompanyAddress(extracted.company.address);
      }
      if (extracted.footer?.text) setFooterText(extracted.footer.text);
      if (extracted.validityDays) setValidityDays(extracted.validityDays);

      setMessage({ type: 'success', text: 'Template extraído com sucesso! Revise os dados e visualize o PDF.' });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro desconhecido';
      setMessage({ type: 'error', text: `Erro na extração: ${msg}` });
    } finally {
      setExtracting(false);
    }
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

  // Build current template with editable overrides
  const getCurrentTemplate = (): PdfTemplate | null => {
    if (!template) return null;
    return {
      ...template,
      company: {
        name: companyName || null,
        cnpj: companyCnpj || null,
        phone: companyPhone || null,
        email: companyEmail || null,
        address: companyAddress || null,
      },
      footer: {
        ...template.footer,
        text: footerText || null,
      },
      validityDays,
    };
  };

  // Save
  const handleSave = async () => {
    setSaving(true);
    setMessage(null);

    const currentTemplate = getCurrentTemplate();
    const { error } = await saveConfig({
      logo_url: logoUrl || null,
      pdf_template: currentTemplate,
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
      setMessage({ type: 'success', text: 'Configuração salva com sucesso!' });
    }
    setSaving(false);
  };

  // Preview
  const handlePreview = async () => {
    const currentTemplate = getCurrentTemplate();
    if (!currentTemplate) {
      setMessage({ type: 'error', text: 'Extraia um template primeiro.' });
      return;
    }

    let logoB64: string | null = null;
    if (logoUrl) {
      try { logoB64 = await fetchImageAsBase64(logoUrl); } catch { /* sem logo */ }
    }

    const brandForPreview: BrandConfig = {
      id: '', user_id: '', created_at: '', updated_at: '', template_pdf_url: null,
      logo_url: logoUrl || null,
      logo_position: currentTemplate.header.logoPosition,
      primary_color: currentTemplate.colors.primary,
      secondary_color: currentTemplate.colors.secondary,
      accent_color: currentTemplate.colors.accent,
      company_name: companyName || null,
      company_cnpj: companyCnpj || null,
      company_phone: companyPhone || null,
      company_email: companyEmail || null,
      company_address: companyAddress || null,
      footer_text: footerText || null,
      validity_days: validityDays,
      layout_style: 'classic',
      font_family: currentTemplate.fonts.family,
      pdf_template: currentTemplate,
    };

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
        Envie o PDF do seu orçamento atual. A IA vai analisar e replicar o layout automaticamente.
      </p>

      {message && (
        <div className={`p-3 rounded-lg text-sm ${message.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
          {message.text}
        </div>
      )}

      {/* 1. Upload + Extração */}
      <section className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
        <h2 className="text-lg font-semibold text-gray-900 mb-3">Template do Orçamento</h2>
        <p className="text-sm text-gray-500 mb-4">
          Envie o PDF que você usa atualmente. A IA vai extrair cores, layout, dados da empresa e replicar no sistema.
        </p>

        <input ref={templateInputRef} type="file" accept=".pdf" onChange={handleTemplateUpload} className="hidden" />

        <div className="flex gap-3 flex-wrap">
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
            {extracting ? 'Analisando...' : 'Extrair e Gerar Template'}
          </button>

          {template && (
            <button
              onClick={handlePreview}
              className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Visualizar PDF
            </button>
          )}
        </div>

        {templatePreview && (
          <div className="mt-4">
            <p className="text-xs text-gray-500 mb-2">Seu template original:</p>
            <img src={templatePreview} alt="Preview do template" className="max-h-64 rounded-lg border border-gray-200" />
          </div>
        )}

        {template && (
          <div className="mt-3 p-3 bg-green-50 rounded-lg">
            <p className="text-sm text-green-700 font-medium">Template extraído</p>
            <p className="text-xs text-green-600 mt-1">
              Layout: {template.header.backgroundColor ? 'Header colorido' : 'Header limpo'} |
              Fonte: {template.fonts.family} |
              Seção cliente: {template.clientSection.style} |
              Produtos: {template.productsSection.style}
            </p>
          </div>
        )}
      </section>

      {/* 2. Logo */}
      <section className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
        <h2 className="text-lg font-semibold text-gray-900 mb-3">Logo</h2>

        <input ref={logoInputRef} type="file" accept="image/png,image/jpeg,image/jpg" onChange={handleLogoUpload} className="hidden" />

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
      </section>

      {/* 3. Dados da Empresa (editáveis) */}
      <section className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Dados da Empresa</h2>
        <p className="text-sm text-gray-500 mb-3">Estes dados são preenchidos automaticamente pela extração. Ajuste se necessário.</p>

        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nome da Empresa</label>
            <input type="text" value={companyName} onChange={e => setCompanyName(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">CNPJ</label>
              <input type="text" value={companyCnpj} onChange={e => setCompanyCnpj(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Telefone</label>
              <input type="text" value={companyPhone} onChange={e => setCompanyPhone(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input type="email" value={companyEmail} onChange={e => setCompanyEmail(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Endereço</label>
            <input type="text" value={companyAddress} onChange={e => setCompanyAddress(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
          </div>
        </div>
      </section>

      {/* 4. Rodapé */}
      <section className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Rodapé do PDF</h2>
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Texto do Rodapé</label>
            <textarea
              value={footerText}
              onChange={e => setFooterText(e.target.value)}
              rows={3}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              placeholder="Termos e condições..."
            />
          </div>
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
        </div>
      </section>

      {/* 5. Cores (readonly, extraídas) */}
      {template && (
        <section className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
          <h2 className="text-lg font-semibold text-gray-900 mb-3">Cores Extraídas</h2>
          <div className="flex gap-4 flex-wrap">
            {Object.entries(template.colors).map(([key, hex]) => (
              <div key={key} className="flex items-center gap-2">
                <div className="w-8 h-8 rounded border border-gray-200" style={{ backgroundColor: hex }} />
                <div>
                  <p className="text-xs text-gray-500 capitalize">{key}</p>
                  <p className="text-xs font-mono text-gray-700">{hex}</p>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* 6. Ações */}
      <section className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
        <div className="flex gap-3">
          {template && (
            <button
              onClick={handlePreview}
              className="px-5 py-2.5 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Visualizar PDF
            </button>
          )}
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
              <button onClick={() => setPdfPreviewUrl(null)} className="p-1 rounded-lg hover:bg-gray-100 text-gray-500">
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
