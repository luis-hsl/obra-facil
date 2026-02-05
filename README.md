# Obra Facil

Aplicacao web para gestao de projetos de obras e reformas. Acompanha atendimentos desde o contato inicial do cliente ate a conclusao do servico, passando por medicao, orcamento, aprovacao, execucao e fechamento financeiro.

Interface em portugues (PT-BR), voltada para profissionais autonomos e pequenas empresas do setor de construcao civil (pisos, revestimentos, acabamentos).

## Stack Tecnologica

| Camada | Tecnologia |
|--------|-----------|
| Frontend | React 19 + TypeScript 5.9 |
| Build | Vite 7 |
| Estilizacao | Tailwind CSS 4 |
| Roteamento | React Router DOM 7 |
| Backend | Supabase (Auth, PostgreSQL, Storage) |
| PDF | jsPDF 4 |

## Funcionalidades

### Pipeline de Atendimento

Cada atendimento segue um fluxo de status:

```
iniciado -> visita_tecnica -> medicao -> orcamento -> aprovado -> execucao -> concluido
                                                   \-> reprovado
```

### Modulos

- **Clientes** - Cadastro e listagem de atendimentos com busca por nome, endereco e tipo de servico
- **Em Andamento** - Filtra atendimentos nos status visita_tecnica, medicao e orcamento
- **Operacional** - Atendimentos aprovados e em execucao, com controle de custos
- **Concluidos** - Atendimentos finalizados
- **Financeiro** - Visao financeira dos atendimentos
- **Produtos** - Catalogo de produtos (fabricante, linha, preco por m2) usado nos orcamentos

### Medicao

- Cadastro de comodos com dimensoes (comprimento x largura)
- Itens adicionais (rodape, perfil, soleira, etc.)
- Calculo automatico de area total com percentual de perda

### Orcamento

- Multiplos orcamentos por atendimento (versoes/opcoes)
- Multiplos produtos por orcamento (tabela `orcamento_itens`)
- Calculo de area com perda e preco por m2
- Formas de pagamento: a vista (com 5% de desconto no PDF) ou parcelado (2-12x com taxa configuravel)
- Geracao de PDF do orcamento via jsPDF
- Status: rascunho, enviado, aprovado, reprovado

### Fechamento (Precificacao)

- Registro de valor recebido do cliente
- Custos: distribuidor, instalador, extras
- Calculo automatico de lucro final

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

### 4. Configurar o banco de dados

No Supabase SQL Editor, execute o schema base:

```bash
# O schema principal esta em:
schema.sql
```

Em seguida, execute as migrations em ordem (pasta `supabase/migrations/`):

1. `20260204222505_rename_and_split_produto_fields.sql`
2. `20260204225418_remove_box_columns.sql`
3. `20260204230030_remove_perda_padrao.sql`
4. `20260204235345_restructure_atendimento.sql`
5. `20260205001631_snapshot_model.sql`
6. `20260205130000_perda_na_medicao.sql`
7. `20260205140000_orcamento_itens.sql`

### 5. Iniciar o servidor de desenvolvimento

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
├── pages/                       # Componentes de pagina (rotas)
│   ├── Login.tsx                # Autenticacao (login/cadastro)
│   ├── ClientesList.tsx         # Listagem de atendimentos
│   ├── AndamentoList.tsx        # Filtro: em andamento
│   ├── OperacionalList.tsx      # Filtro: aprovado/execucao
│   ├── ConcluidosList.tsx       # Filtro: concluidos
│   ├── Financeiro.tsx           # Visao financeira
│   ├── AtendimentoForm.tsx      # Formulario criar/editar atendimento
│   ├── AtendimentoDetail.tsx    # Detalhe com abas (medicao, orcamento, fechamento)
│   ├── Precificacao.tsx         # Alocacao de custos operacionais
│   ├── ProdutosList.tsx         # Listagem de produtos
│   └── ProdutoForm.tsx          # Formulario criar/editar produto
├── components/                  # Componentes reutilizaveis
│   ├── Layout.tsx               # Layout principal (sidebar + conteudo)
│   ├── StatusBadge.tsx          # Badge de status com cores
│   ├── MedicaoForm.tsx          # Formulario de medicao (comodos + adicionais)
│   ├── OrcamentoForm.tsx        # Formulario de orcamento (multi-produto)
│   └── FechamentoForm.tsx       # Formulario de fechamento financeiro
├── lib/                         # Utilitarios
│   ├── supabase.ts              # Cliente Supabase
│   ├── useAuth.ts               # Hook de autenticacao
│   ├── statusConfig.ts          # Configuracao de status e transicoes
│   └── gerarPDF.ts              # Geracao de PDF de orcamento
├── types/
│   └── index.ts                 # Interfaces TypeScript (espelham o banco)
├── App.tsx                      # Configuracao de rotas
├── main.tsx                     # Entry point
└── index.css                    # Imports Tailwind CSS
```

## Banco de Dados

### Tabelas

| Tabela | Descricao |
|--------|-----------|
| `atendimentos` | Entidade principal - dados do cliente, endereco, servico e status |
| `medicoes` | Medicoes de area vinculadas a um atendimento |
| `orcamentos` | Orcamentos com forma de pagamento e status |
| `orcamento_itens` | Itens do orcamento (produto, area, preco) |
| `execucoes` | Registros de execucao com status e foto |
| `fechamentos` | Fechamento financeiro (receita, custos, lucro) |
| `produtos` | Catalogo de produtos do usuario |

### Seguranca

- **Row Level Security (RLS)** habilitado em todas as tabelas
- Cada usuario so acessa seus proprios dados (`auth.uid() = user_id`)
- Tabelas filhas verificam o `user_id` do atendimento pai
- **Storage**: bucket `fotos` com leitura publica e upload autenticado

### Modelo de Dados

Todas as tabelas filhas (`medicoes`, `orcamentos`, `execucoes`, `fechamentos`) possuem `ON DELETE CASCADE` vinculado ao `atendimento_id`.

Os dados do cliente (nome, telefone, endereco) sao armazenados como snapshot diretamente no atendimento (modelo desnormalizado para preservar historico).

## Rotas

| Rota | Pagina | Descricao |
|------|--------|-----------|
| `/login` | Login | Autenticacao (email + senha) |
| `/` | ClientesList | Listagem principal de atendimentos |
| `/andamento` | AndamentoList | Atendimentos em andamento |
| `/operacional` | OperacionalList | Atendimentos aprovados/em execucao |
| `/concluidos` | ConcluidosList | Atendimentos concluidos |
| `/financeiro` | Financeiro | Visao financeira |
| `/atendimentos/novo` | AtendimentoForm | Novo atendimento |
| `/atendimentos/:id` | AtendimentoDetail | Detalhe do atendimento |
| `/atendimentos/:id/editar` | AtendimentoForm | Editar atendimento |
| `/precificacao/:id` | Precificacao | Custos operacionais |
| `/produtos` | ProdutosList | Catalogo de produtos |
| `/produtos/novo` | ProdutoForm | Novo produto |
| `/produtos/:id/editar` | ProdutoForm | Editar produto |

Todas as rotas (exceto `/login`) sao protegidas pelo componente `ProtectedRoute`, que redireciona para `/login` caso o usuario nao esteja autenticado.

## Autenticacao

- Login e cadastro via **Supabase Auth** (email + senha)
- Cadastro armazena metadados: nome, telefone, empresa, CPF/CNPJ
- Hook `useAuth()` fornece: `user`, `loading`, `signIn()`, `signUp()`, `signOut()`
- Sessao persistente gerenciada pelo Supabase

## Arquitetura

- **Sem camada de API**: componentes acessam o Supabase diretamente via `supabase.from()`
- **Sem state management**: usa hooks nativos do React (`useState`, `useEffect`)
- **Layout responsivo**: sidebar fixa no desktop, navegacao horizontal no mobile
- **TypeScript strict mode** habilitado
