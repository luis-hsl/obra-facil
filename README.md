# Obra Facil

Aplicacao web completa para gestao de projetos de obras e reformas. Acompanha atendimentos desde o contato inicial do cliente ate a conclusao do servico, passando por visita tecnica, medicao, orcamento, aprovacao, execucao e fechamento financeiro.

Interface em portugues (PT-BR), voltada para profissionais autonomos e pequenas empresas do setor de construcao civil (pisos, revestimentos, gesso, vidro, acabamentos em geral).

## Stack Tecnologica

| Camada | Tecnologia |
|--------|-----------|
| Frontend | React 19 + TypeScript 5.9 |
| Build | Vite 7 |
| Estilizacao | Tailwind CSS 4 |
| Roteamento | React Router DOM 7 |
| Backend | Supabase (Auth, PostgreSQL, Storage, Edge Functions) |
| PDF | jsPDF 4 |
| IA | Google Gemini 2.0 Flash (via Supabase Edge Functions) |
| Deploy | Vercel |

## Funcionalidades

### Pipeline de Atendimento

Cada atendimento segue um fluxo de status progressivo (pode pular etapas):

```
iniciado -> visita_tecnica -> medicao -> orcamento -> aprovado -> execucao -> concluido
                                                   \-> reprovado
```

O status e um marcador, nao um portao — todas as secoes (medicao, orcamento, execucao) sao acessiveis independente do status atual.

### Modulos / Paginas

| Pagina | Rota | Descricao |
|--------|------|-----------|
| **Agenda (Home)** | `/` | Dashboard principal com KPIs, calendario interativo de visitas, follow-ups pendentes, pipeline de orcamentos, percurso otimizado por IA, integracao Waze |
| **Clientes** | `/clientes` | Agrupamento de atendimentos por cliente (nome + telefone), taxa de conclusao, busca, paginacao, exclusao em lote |
| **Em Andamento** | `/andamento` | Atendimentos nos status visita_tecnica, medicao e orcamento com filtro por status e busca |
| **Operacional** | `/operacional` | Atendimentos aprovados e em execucao com KPIs de custos pendentes/realizados |
| **Concluidos** | `/concluidos` | Atendimentos finalizados com fechamento financeiro, ordenacao por data/margem/valor, fotos com lightbox |
| **Financeiro** | `/financeiro` | Dashboard financeiro completo com graficos, KPIs comparativos, insights IA, exportacao PDF/CSV |
| **Novo Atendimento** | `/atendimentos/novo` | Formulario de criacao (cliente, endereco, tipo de servico) |
| **Detalhe** | `/atendimentos/:id` | Visao completa com secoes colapsaveis de medicao, orcamento e execucao |
| **Editar** | `/atendimentos/:id/editar` | Formulario de edicao do atendimento |
| **Precificacao** | `/precificacao/:id` | Alocacao de custos (distribuidor, instalador, extras) e calculo de lucro |
| **Produtos** | `/produtos` | Catalogo de produtos (fabricante, linha, preco por m2) |
| **Novo Produto** | `/produtos/novo` | Formulario de criacao de produto |
| **Editar Produto** | `/produtos/:id/editar` | Formulario de edicao de produto |
| **Minha Marca** | `/marca` | Configuracao de identidade visual, logo, cores, fontes, templates de PDF, dados da empresa |
| **Login** | `/login` | Autenticacao (email + senha via Supabase Auth) |

Todas as rotas (exceto `/login`) sao protegidas pelo componente `ProtectedRoute`.

### Medicao

- Cadastro de comodos com dimensoes (comprimento x largura)
- Itens adicionais (rodape, perfil, soleira, etc.)
- Calculo automatico de area total com percentual de perda

### Orcamento

- Multiplos orcamentos por atendimento (versoes/opcoes)
- Multiplos produtos por orcamento (tabela `orcamento_itens`)
- Formula: `valor_total = area * (1 + perda/100) * preco_por_m2`
- Formas de pagamento: a vista (5% desconto no PDF) ou parcelado (2-12x com taxa configuravel)
- Geracao de PDF personalizado com marca/identidade visual
- Status: rascunho, enviado, aprovado, reprovado

### Fechamento Financeiro

- Registro de valor recebido do cliente
- Custos: distribuidor, instalador, extras
- Calculo automatico: `lucro_final = valor_recebido - (custos)`
- Margem de lucro em percentual

### Agenda e Calendario

- Calendario interativo com indicadores visuais de visitas agendadas
- KPIs: visitas do dia, follow-ups pendentes, orcamentos pendentes, novos da semana
- Visitas do dia com numeracao de rota e botao Waze individual por visita
- Pipeline visual de orcamentos por status

### Follow-up Inteligente

Sistema de follow-up progressivo em 5 estagios:

| Estagio | Gatilho | Acao |
|---------|---------|------|
| 1 | 3-5 dias sem contato | WhatsApp: apresentacao do processo |
| 2 | +3 dias | Ligacao direta |
| 3 | +6 dias | WhatsApp: oferta especial |
| 4 | +13 dias | WhatsApp: ultima tentativa |
| 5 | +45 dias (reprovado) | WhatsApp: reengajamento |

- Mensagens geradas por IA (Gemini) personalizadas por cliente/servico/estagio
- Cache de mensagens por 4h para economia de tokens
- Rate limit de 10s entre chamadas IA
- Reset automatico ao mudar status do atendimento

### Percurso Otimizado (IA)

- Botao "Percurso Otimizado" na Agenda
- IA (Gemini) agrupa visitas por bairro/proximidade
- Sugere melhor dia/horario (max 5 visitas/dia, seg-sex, 08-17h)
- Aceitar individual ou todas as sugestoes
- Atualiza calendario automaticamente
- Rate limit de 30s entre chamadas

### Dashboard Financeiro

- Filtros de periodo: Hoje, Semana, Mes, Ano, Personalizado
- KPIs com deltas vs periodo anterior: receita, custos, lucro, margem, ticket medio, numero de projetos
- Grafico de tendencia receita/lucro (12 meses)
- Donut de composicao de custos (distribuidor, instalador, extras)
- Receita por tipo de servico (barras)
- Top 5 clientes por receita
- Margem de lucro ao longo do tempo
- Exportacao PDF e CSV
- Click em mes no grafico filtra os fechamentos

### Insights com IA

Insights automaticos no painel Financeiro:

**Insights calculados (sem IA):**
- Tendencia de margem (alta/queda vs periodo anterior)
- Lucro negativo no periodo
- Melhor mes em faturamento
- Concentracao de receita em cliente
- Servico mais lucrativo
- Tendencia de crescimento/queda trimestral

**Insights IA (Gemini):**
- Analise de conversao de orcamentos (aprovados vs reprovados)
- Padroes por tipo de servico, faixa de preco, bairro
- Impacto de follow-ups na conversao
- Sugestoes acionaveis
- Cache de 24h em localStorage, rate limit de 1min
- Minimo 5 orcamentos para ativar

### Minha Marca (Identidade Visual)

**Aba Design do PDF:**
- 3 templates: Classico (tabela formal), Moderno (fundo colorido), Minimalista (cards clean)
- 5 cores configuraveis: principal, destaque, texto, sutil, bordas
- 13 fontes disponiveis (3 classicas + 10 Google Fonts com preview real)
- Peso do titulo: negrito ou normal
- Densidade do layout: compacto, normal, espacoso
- Observacoes e rodape configuraveis
- Validade do orcamento (1-90 dias)

**Aba Dados da Empresa:**
- Upload de logo (PNG/JPEG) com posicao (esquerda, centro, direita) e tamanho
- Nome da empresa, CNPJ/CPF, telefone, email, endereco
- Resumo visual dos dados

**Preview ao vivo:** painel lateral com PDF gerado em tempo real conforme ajustes

**Fontes disponiveis:**

| Categoria | Fontes |
|-----------|--------|
| Classicas | Helvetica, Times, Courier |
| Sans-serif | Roboto, Open Sans, Lato, Montserrat, Poppins, Raleway, Nunito, Inter |
| Serifadas | Playfair Display, Merriweather |

As fontes Google Fonts sao baixadas sob demanda na geracao do PDF e cacheadas em IndexedDB para uso offline subsequente.

### Busca Global

- Atalho `Ctrl+K` (ou `Cmd+K` no Mac) abre modal de busca
- Busca em atendimentos, produtos e clientes

### Layout Responsivo

- **Desktop**: sidebar lateral com grupos (CRM + Configurar)
- **Mobile**: header com gradiente + navegacao inferior com 4 itens principais e menu "Mais"

## Pre-requisitos

- Node.js 18+
- npm
- Conta no [Supabase](https://supabase.com)

## Configuracao

### 1. Clonar o repositorio

```bash
git clone <url-do-repositorio>
cd obra-facil
```

### 2. Instalar dependencias

```bash
npm install
```

### 3. Configurar variaveis de ambiente

Crie um arquivo `.env` na raiz do projeto:

```env
VITE_SUPABASE_URL=https://seu-projeto.supabase.co
VITE_SUPABASE_ANON_KEY=sua-anon-key
```

Para obter esses valores:
1. Acesse o painel do Supabase
2. Va em **Project Settings > API**
3. Copie a **Project URL** e a **anon public key**

### 4. Configurar secrets do Supabase (para IA)

```bash
npx supabase secrets set GEMINI_API_KEY=sua-chave-gemini
```

A chave Gemini e usada pelas Edge Functions de IA. Obtenha em [Google AI Studio](https://aistudio.google.com/app/apikey).

### 5. Configurar o banco de dados

No Supabase SQL Editor, execute o schema base (`schema.sql`), depois as migrations em ordem:

```bash
npx supabase link --project-ref seu-project-ref
npx supabase db push --include-all
```

Migrations disponiveis em `supabase/migrations/`:

| Migration | Descricao |
|-----------|-----------|
| `20260204222505_rename_and_split_produto_fields` | Split campos de produto |
| `20260204225418_remove_box_columns` | Remocao de colunas legadas |
| `20260204230030_remove_perda_padrao` | Remocao de perda padrao |
| `20260204235345_restructure_atendimento` | Reestruturacao do atendimento |
| `20260205001631_snapshot_model` | Modelo snapshot (dados inline) |
| `20260205120000_financeiro` | Tabela de fechamentos |
| `20260205130000_perda_na_medicao` | Perda percentual na medicao |
| `20260205140000_orcamento_itens` | Itens multi-produto no orcamento |
| `20260206190450_repair_fechamentos` | Correcao schema fechamentos |
| `20260210120000_brand_configs` | Tabela de configuracao de marca |
| `20260211_visit_scheduling` | Campos data_visita e observacoes_visita |

### 6. Deploy das Edge Functions

```bash
npx supabase functions deploy extract-brand
npx supabase functions deploy generate-followup-message
npx supabase functions deploy analyze-conversion
npx supabase functions deploy suggest-schedule
```

### 7. Iniciar o servidor de desenvolvimento

```bash
npm run dev
```

A aplicacao estara disponivel em `http://localhost:5173`.

## Scripts Disponiveis

| Comando | Descricao |
|---------|-----------|
| `npm run dev` | Servidor de desenvolvimento com HMR |
| `npm run build` | Verificacao TypeScript + build de producao |
| `npm run lint` | Verificacao ESLint |
| `npm run preview` | Preview do build de producao |

## Estrutura do Projeto

```
src/
├── pages/                              # Paginas (rotas)
│   ├── Login.tsx                       # Autenticacao (login/cadastro)
│   ├── Agenda.tsx                      # Home: calendario, KPIs, follow-ups, IA
│   ├── ClientesList.tsx                # Agrupamento por cliente
│   ├── AndamentoList.tsx               # Filtro: em andamento
│   ├── OperacionalList.tsx             # Filtro: aprovado/execucao
│   ├── ConcluidosList.tsx              # Filtro: concluidos
│   ├── Financeiro.tsx                  # Dashboard financeiro + insights IA
│   ├── AtendimentoForm.tsx             # Formulario criar/editar atendimento
│   ├── AtendimentoDetail.tsx           # Detalhe com secoes colapsaveis
│   ├── Precificacao.tsx                # Alocacao de custos operacionais
│   ├── ProdutosList.tsx                # Catalogo de produtos
│   ├── ProdutoForm.tsx                 # Formulario criar/editar produto
│   └── MarcaConfig.tsx                 # Identidade visual e design do PDF
├── components/                         # Componentes reutilizaveis
│   ├── Layout.tsx                      # Sidebar desktop + nav mobile
│   ├── GlobalSearch.tsx                # Modal de busca global (Ctrl+K)
│   ├── StatusBadge.tsx                 # Badge de status com cores
│   ├── StatusProgress.tsx              # Barra de progresso do pipeline
│   ├── EmptyState.tsx                  # Estado vazio reutilizavel
│   ├── LoadingSkeleton.tsx             # Skeletons de carregamento
│   ├── ConfirmModal.tsx                # Modal de confirmacao de exclusao
│   ├── MedicaoForm.tsx                 # Formulario de medicao
│   ├── OrcamentoForm.tsx               # Formulario de orcamento multi-produto
│   ├── FechamentoForm.tsx              # Formulario de fechamento financeiro
│   ├── ExecucaoSection.tsx             # Secao de execucao com fotos
│   └── financeiro/                     # Sub-componentes do dashboard financeiro
│       ├── KpiCards.tsx                # Cards de KPI com deltas
│       ├── RevenueProfitChart.tsx      # Grafico de tendencia receita/lucro
│       ├── CostBreakdownChart.tsx      # Donut de composicao de custos
│       ├── RevenueByServiceChart.tsx   # Barras de receita por servico
│       ├── TopClients.tsx              # Top 5 clientes
│       ├── ProfitMarginChart.tsx       # Tendencia de margem de lucro
│       ├── InsightsPanel.tsx           # Painel de insights (normais + IA)
│       ├── FechamentosList.tsx         # Tabela de fechamentos
│       └── ChartTooltip.tsx            # Tooltip customizado para graficos
├── lib/                                # Utilitarios e logica de negocio
│   ├── supabase.ts                     # Cliente Supabase (env vars)
│   ├── useAuth.ts                      # Hook de autenticacao
│   ├── statusConfig.ts                 # Config de status e transicoes validas
│   ├── useBrandConfig.ts               # Hook para carregar/salvar marca
│   ├── imageUtils.ts                   # Utilidades de imagem (base64, hex->rgb)
│   ├── gerarPDF.ts                     # Re-export da geracao de PDF
│   ├── gerarRelatorioFinanceiroPDF.ts  # PDF do relatorio financeiro
│   ├── pdfToImage.ts                   # Conversao de PDF para imagem
│   ├── pdf/                            # Motor de geracao de PDF
│   │   ├── renderPdf.ts               # Renderer principal (header, tabela, totais, rodape)
│   │   ├── resolveTokens.ts           # Resolve tokens semanticos -> valores concretos
│   │   ├── defaults.ts                # Configuracao padrao do PDF
│   │   ├── presets.ts                 # Presets de template (classico, moderno, minimalista)
│   │   └── fontLoader.ts             # Carregamento de fontes Google Fonts + cache IndexedDB
│   └── financeiro/                     # Logica do dashboard financeiro
│       ├── useFinanceiroData.ts       # Hook principal (queries, KPIs, filtros, export)
│       ├── computeInsights.ts         # Insights calculados + fetch IA
│       ├── computeConversionData.ts   # Agregacao de dados de conversao para IA
│       └── chartUtils.ts             # Formatacao de dados para graficos
├── types/
│   ├── index.ts                        # Interfaces (Atendimento, Orcamento, Produto, etc.)
│   └── pdfTokens.ts                    # Tipos do sistema de design do PDF
├── App.tsx                             # Rotas e ProtectedRoute
├── main.tsx                            # Entry point
└── index.css                           # Imports Tailwind CSS
```

## Banco de Dados

### Tabelas

| Tabela | Descricao |
|--------|-----------|
| `atendimentos` | Entidade principal — dados do cliente (snapshot), endereco, tipo de servico, status, data de visita, contadores de follow-up |
| `medicoes` | Medicoes de area vinculadas a um atendimento (area_total, perda_percentual) |
| `orcamentos` | Orcamentos com forma de pagamento (a_vista/parcelado), parcelas, taxa de juros, status |
| `orcamento_itens` | Itens do orcamento (produto, area, preco por m2, valor total) |
| `execucoes` | Registros de execucao com status (pendente/em_andamento/concluido) e foto |
| `fechamentos` | Fechamento financeiro (valor_recebido, custo_distribuidor, custo_instalador, custo_extras, lucro_final) |
| `produtos` | Catalogo de produtos do usuario (fabricante, linha, preco_por_m2) |
| `brand_configs` | Configuracao de marca/identidade visual (logo, cores, fontes, template PDF, dados da empresa) |

### Modelo de Dados

- **Snapshot model**: dados do cliente (nome, telefone, endereco) armazenados diretamente no atendimento (sem tabela separada de clientes)
- Tabelas filhas (`medicoes`, `orcamentos`, `execucoes`, `fechamentos`) com `ON DELETE CASCADE` vinculado ao `atendimento_id`
- Tipo de servico: Piso, Gesso, Vidro, Outro

### Seguranca

- **Row Level Security (RLS)** habilitado em todas as tabelas
- Cada usuario so acessa seus proprios dados (`auth.uid() = user_id`)
- Tabelas filhas verificam o `user_id` do atendimento pai
- **Storage**: bucket `fotos` (leitura publica, upload autenticado), bucket `brand` (logos)
- Todas as Edge Functions com JWT obrigatorio

## Edge Functions (Supabase)

Funcoes serverless em Deno usando Google Gemini 2.0 Flash:

| Funcao | Descricao | Rate Limit | Cache |
|--------|-----------|------------|-------|
| `generate-followup-message` | Gera mensagens de follow-up personalizadas por estagio | 10s entre chamadas | 4h por mensagem (localStorage) |
| `suggest-schedule` | Sugere agenda otimizada agrupando visitas por bairro/proximidade | 30s entre chamadas | — |
| `analyze-conversion` | Analisa padroes de conversao de orcamentos para insights | 1min entre chamadas | 24h (localStorage) |
| `extract-brand` | Extrai identidade visual de imagem/logo | — | — |

Todas requerem `GEMINI_API_KEY` configurada como secret do Supabase.

## Autenticacao

- Login e cadastro via **Supabase Auth** (email + senha)
- Cadastro armazena metadados: nome, telefone, empresa, CPF/CNPJ
- Hook `useAuth()` fornece: `user`, `loading`, `signIn()`, `signUp()`, `signOut()`
- Sessao persistente gerenciada pelo Supabase
- `ProtectedRoute` redireciona para `/login` caso nao autenticado

## Arquitetura

- **Sem camada de API intermediaria**: componentes acessam o Supabase diretamente via `supabase.from()`
- **Sem state management externo**: usa hooks nativos do React (`useState`, `useEffect`, `useMemo`, `useCallback`)
- **Layout responsivo**: sidebar fixa no desktop, navegacao inferior no mobile
- **TypeScript strict mode** habilitado
- **Dados financeiros**: queries batch com `Promise.all`, KPIs calculados no frontend com `useMemo`
- **PDF**: motor proprio com sistema de tokens semanticos (preset -> resolve -> render)
- **IA**: chamadas ao Gemini via Edge Functions com rate limiting e cache no frontend para controle de tokens
- **Fontes customizadas**: Google Fonts TTF baixadas sob demanda, cacheadas em IndexedDB, registradas dinamicamente no jsPDF
- **Fuso horario**: todas as operacoes de data normalizadas para America/Sao_Paulo
