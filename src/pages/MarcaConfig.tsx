import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../lib/useAuth';
import { useBrandConfig } from '../lib/useBrandConfig';
import { supabase } from '../lib/supabase';
import { pdfFirstPageToBase64, pdfFirstPageToDataUrl } from '../lib/pdfToImage';
import { gerarPDF } from '../lib/gerarPDF';
import { DEFAULT_DOCUMENT_TEMPLATE } from '../lib/defaultDocumentTemplate';
import type { BrandConfig, DocumentTemplate } from '../types';

export default function MarcaConfig() {
  const { user } = useAuth();
  const { config, loading, saveConfig } = useBrandConfig();

  const [templatePreview, setTemplatePreview] = useState<string | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [logoUrl, setLogoUrl] = useState('');
  const [extracting, setExtracting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [pdfBase64ForExtract, setPdfBase64ForExtract] = useState<string | null>(null);
  const [pdfPreviewUrl, setPdfPreviewUrl] = useState<string | null>(null);
  const [generatingPdf, setGeneratingPdf] = useState(false);

  // Document Template from AI
  const [documentTemplate, setDocumentTemplate] = useState<DocumentTemplate | null>(null);

  // Editable company fields
  const [companyName, setCompanyName] = useState('');
  const [companyCnpj, setCompanyCnpj] = useState('');
  const [companyPhone, setCompanyPhone] = useState('');
  const [companyEmail, setCompanyEmail] = useState('');
  const [companyAddress, setCompanyAddress] = useState('');
  const [footerText, setFooterText] = useState('');
  const [validityDays, setValidityDays] = useState(15);

  const templateInputRef = useRef<HTMLInputElement>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);

  // Load saved config
  useEffect(() => {
    if (config) {
      setLogoUrl(config.logo_url || '');
      if (config.logo_url) setLogoPreview(config.logo_url);
      if (config.pdf_template && (config.pdf_template as DocumentTemplate).version === 2) {
        setDocumentTemplate(config.pdf_template as DocumentTemplate);
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

  // Upload template PDF
  const handleTemplateUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    setUploading(true);
    setMessage(null);
    try {
      // Preview
      const dataUrl = await pdfFirstPageToDataUrl(file);
      setTemplatePreview(dataUrl);

      // Base64 for AI extraction
      const base64 = await pdfFirstPageToBase64(file);
      setPdfBase64ForExtract(base64);

      // Upload original PDF
      const ext = file.name.split('.').pop() || 'pdf';
      const path = `${user.id}/template.${ext}`;
      await supabase.storage.from('brand').upload(path, file, { upsert: true });

      setMessage({ type: 'success', text: 'Template enviado! Clique em "Analisar Template" para extrair a estrutura.' });
    } catch (err) {
      setMessage({ type: 'error', text: `Erro ao enviar: ${err instanceof Error ? err.message : 'desconhecido'}` });
    } finally {
      setUploading(false);
    }
  };

  // AI extraction of DocumentTemplate
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
      if (data?.error) throw new Error(data.error + (data.raw ? `\nRaw: ${data.raw}` : ''));

      // Merge with defaults for any missing fields
      const template: DocumentTemplate = {
        ...DEFAULT_DOCUMENT_TEMPLATE,
        ...data,
        version: 2,
        mockup: data.mockup?.blocks?.length > 0 ? data.mockup : DEFAULT_DOCUMENT_TEMPLATE.mockup,
        branding: { ...DEFAULT_DOCUMENT_TEMPLATE.branding, ...data.branding },
        budget_table: { ...DEFAULT_DOCUMENT_TEMPLATE.budget_table, ...data.budget_table },
        totals: { ...DEFAULT_DOCUMENT_TEMPLATE.totals, ...data.totals },
        observations: { ...DEFAULT_DOCUMENT_TEMPLATE.observations, ...data.observations },
        layout_metadata: {
          ...DEFAULT_DOCUMENT_TEMPLATE.layout_metadata,
          ...data.layout_metadata,
          margins: { ...DEFAULT_DOCUMENT_TEMPLATE.layout_metadata.margins, ...data.layout_metadata?.margins },
          header: { ...DEFAULT_DOCUMENT_TEMPLATE.layout_metadata.header, ...data.layout_metadata?.header, title: { ...DEFAULT_DOCUMENT_TEMPLATE.layout_metadata.header.title, ...data.layout_metadata?.header?.title } },
          client_section: { ...DEFAULT_DOCUMENT_TEMPLATE.layout_metadata.client_section, ...data.layout_metadata?.client_section },
          footer: { ...DEFAULT_DOCUMENT_TEMPLATE.layout_metadata.footer, ...data.layout_metadata?.footer },
        },
      };

      setDocumentTemplate(template);

      // Fill company data from extracted fields
      const findCompany = (type: string) => template.company_fields.find(f => f.type === type)?.value || '';
      if (findCompany('text')) setCompanyName(findCompany('text'));
      if (findCompany('cnpj')) setCompanyCnpj(findCompany('cnpj'));
      if (findCompany('phone')) setCompanyPhone(findCompany('phone'));
      if (findCompany('email')) setCompanyEmail(findCompany('email'));
      if (findCompany('address')) setCompanyAddress(findCompany('address'));
      if (template.observations.default_text) setFooterText(template.observations.default_text);

      setMessage({ type: 'success', text: 'Template extraído! Revise os dados e clique em "Testar PDF".' });
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

  // Test PDF generation
  const handleTestPDF = async () => {
    if (!documentTemplate) {
      setMessage({ type: 'error', text: 'Extraia o template primeiro.' });
      return;
    }

    setGeneratingPdf(true);
    setMessage(null);
    try {
      const brandForTest: BrandConfig = {
        id: '', user_id: '', created_at: '', updated_at: '',
        template_pdf_url: null, logo_url: logoUrl || null,
        logo_position: 'left', primary_color: documentTemplate.branding.primary_color,
        secondary_color: documentTemplate.branding.secondary_color,
        accent_color: documentTemplate.branding.accent_color,
        company_name: companyName || null, company_cnpj: companyCnpj || null,
        company_phone: companyPhone || null, company_email: companyEmail || null,
        company_address: companyAddress || null, footer_text: footerText || null,
        validity_days: validityDays, layout_style: 'classic',
        font_family: documentTemplate.branding.font_family,
        pdf_template: documentTemplate,
        html_template: null, product_html_template: null,
        overlay_template: null, background_image_url: null,
      };

      // Load logo as base64 for PDF
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

    const { error } = await saveConfig({
      logo_url: logoUrl || null,
      pdf_template: documentTemplate as any,
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

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Minha Marca</h1>
      <p className="text-gray-600 text-sm">
        Envie seu PDF de orçamento modelo. A IA extrai a estrutura completa e gera novos orçamentos com o mesmo layout.
      </p>

      {message && (
        <div className={`p-3 rounded-lg text-sm whitespace-pre-wrap ${message.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
          {message.text}
        </div>
      )}

      {/* 1. Upload + Extração */}
      <section className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
        <h2 className="text-lg font-semibold text-gray-900 mb-3">Template do Orçamento</h2>
        <p className="text-sm text-gray-500 mb-4">
          A IA analisa cores, fontes, tabelas e estrutura do seu PDF e cria um template reutilizável.
        </p>

        <input ref={templateInputRef} type="file" accept=".pdf" onChange={handleTemplateUpload} className="hidden" />

        <div className="flex gap-3 flex-wrap">
          <button
            onClick={() => templateInputRef.current?.click()}
            disabled={uploading}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
          >
            {uploading ? 'Enviando...' : 'Enviar PDF'}
          </button>

          <button
            onClick={handleExtract}
            disabled={!pdfBase64ForExtract || extracting}
            className="px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700 disabled:opacity-50"
          >
            {extracting ? 'Analisando...' : 'Analisar Template'}
          </button>

          {documentTemplate && (
            <button
              onClick={handleTestPDF}
              disabled={generatingPdf}
              className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50"
            >
              {generatingPdf ? 'Gerando...' : 'Testar PDF'}
            </button>
          )}
        </div>

        {/* Preview + Template Summary */}
        <div className="mt-4 flex gap-4 flex-wrap">
          {templatePreview && (
            <div>
              <p className="text-xs text-gray-500 mb-2">Seu modelo original:</p>
              <img src={templatePreview} alt="Preview" className="max-h-64 rounded-lg border border-gray-200" />
            </div>
          )}

          {documentTemplate && (
            <div className="p-4 bg-gray-50 rounded-lg flex-1 min-w-[220px] space-y-3">
              <p className="text-sm font-semibold text-gray-800">Template Extraído</p>

              {/* Colors */}
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500">Cores:</span>
                <div className="w-5 h-5 rounded border" style={{ backgroundColor: documentTemplate.branding.primary_color }} title="Primária" />
                <div className="w-5 h-5 rounded border" style={{ backgroundColor: documentTemplate.branding.secondary_color }} title="Secundária" />
                <div className="w-5 h-5 rounded border" style={{ backgroundColor: documentTemplate.branding.accent_color }} title="Destaque" />
                <div className="w-5 h-5 rounded border" style={{ backgroundColor: documentTemplate.branding.price_highlight_color }} title="Preço" />
              </div>

              {/* Layout info */}
              <div className="text-xs text-gray-600 space-y-1">
                <p>Fonte: <span className="font-medium">{documentTemplate.branding.font_family}</span></p>

                {/* Mockup blocks info */}
                {documentTemplate.mockup?.blocks?.length ? (
                  <>
                    <p>Mockup: <span className="font-medium">{documentTemplate.mockup.blocks.length} bloco(s)</span></p>
                    {documentTemplate.mockup.blocks.map((block, i) => {
                      const typeLabels: Record<string, string> = {
                        header: 'Cabeçalho',
                        title: 'Título',
                        separator: 'Separador',
                        client_data: 'Dados do Cliente',
                        table: 'Tabela',
                        observations: 'Observações',
                        footer: 'Rodapé',
                      };
                      const tableInfo = block.type === 'table' && block.columns
                        ? ` (${block.columns.length} col. | ${block.row_style || 'plain'})`
                        : '';
                      const elCount = block.elements?.length || 0;
                      return (
                        <div key={i} className="ml-2 pl-2 border-l-2 border-gray-300">
                          <p className="font-medium">{typeLabels[block.type] || block.type}{tableInfo}</p>
                          {elCount > 0 && <p className="text-gray-500">{elCount} elemento(s)</p>}
                        </div>
                      );
                    })}
                  </>
                ) : (
                  <p>Produtos: <span className="font-medium">{documentTemplate.budget_table.style}</span> ({documentTemplate.budget_table.columns.length} colunas)</p>
                )}

                <p>Totais: <span className="font-medium">{documentTemplate.totals.position === 'per_item' ? 'por item' : 'resumo no final'}</span></p>
                <p>Empresa: <span className="font-medium">{documentTemplate.company_fields.length} campo(s)</span></p>
                <p>Cliente: <span className="font-medium">{documentTemplate.client_fields.length} campo(s)</span></p>
                <p>Margens: {documentTemplate.layout_metadata.margins.top}/{documentTemplate.layout_metadata.margins.right}/{documentTemplate.layout_metadata.margins.bottom}/{documentTemplate.layout_metadata.margins.left}mm</p>
              </div>
            </div>
          )}
        </div>
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
            {uploadingLogo ? 'Enviando...' : logoPreview ? 'Trocar Logo' : 'Enviar Logo'}
          </button>
        </div>
      </section>

      {/* 3. Dados da Empresa */}
      <section className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Dados da Empresa</h2>
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nome</label>
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
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Observações / Rodapé</h2>
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Texto</label>
            <textarea value={footerText} onChange={e => setFooterText(e.target.value)} rows={3}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" placeholder="Termos e condições..." />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Validade (dias)</label>
            <input type="number" value={validityDays} onChange={e => setValidityDays(Number(e.target.value))}
              min={1} max={90} className="w-24 border border-gray-300 rounded-lg px-3 py-2 text-sm" />
          </div>
        </div>
      </section>

      {/* 5. Ações */}
      <section className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
        <div className="flex gap-3">
          {documentTemplate && (
            <button onClick={handleTestPDF} disabled={generatingPdf}
              className="px-5 py-2.5 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50">
              {generatingPdf ? 'Gerando...' : 'Testar PDF'}
            </button>
          )}
          <button onClick={handleSave} disabled={saving}
            className="flex-1 px-5 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
            {saving ? 'Salvando...' : 'Salvar Configuração'}
          </button>
        </div>
      </section>

      {/* Modal Preview PDF */}
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
