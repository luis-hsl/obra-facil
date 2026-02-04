-- =============================================
-- OBRA FÁCIL - Schema SQL para Supabase
-- Execute este SQL no SQL Editor do Supabase
-- =============================================

-- Tabela de Obras (entidade principal)
create table obras (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) not null,
  cliente_nome text not null,
  endereco text,
  tipo_servico text,
  status text not null default 'lead' check (status in ('lead', 'medicao', 'orcado', 'execucao', 'finalizado')),
  observacoes text,
  created_at timestamp with time zone default now()
);

-- Tabela de Medições
create table medicoes (
  id uuid default gen_random_uuid() primary key,
  obra_id uuid references obras(id) on delete cascade not null,
  tipo_medida text not null default 'm2',
  valor numeric not null,
  observacoes text,
  created_at timestamp with time zone default now()
);

-- Tabela de Orçamentos
create table orcamentos (
  id uuid default gen_random_uuid() primary key,
  obra_id uuid references obras(id) on delete cascade not null,
  produto_id uuid references produtos(id),
  area_total numeric,
  area_com_perda numeric,
  perda_percentual numeric,
  valor_total numeric not null,
  status text not null default 'gerado' check (status in ('gerado', 'enviado', 'aprovado', 'perdido')),
  created_at timestamp with time zone default now()
);

-- Tabela de Execuções
create table execucoes (
  id uuid default gen_random_uuid() primary key,
  obra_id uuid references obras(id) on delete cascade not null,
  status text not null default 'pendente' check (status in ('pendente', 'concluido')),
  foto_final_url text,
  observacoes text,
  created_at timestamp with time zone default now()
);

-- =============================================
-- RLS (Row Level Security) - Simples
-- Cada usuário só vê suas próprias obras
-- =============================================

alter table obras enable row level security;
alter table medicoes enable row level security;
alter table orcamentos enable row level security;
alter table execucoes enable row level security;

-- Obras: usuário só acessa as próprias
create policy "Usuário acessa próprias obras" on obras
  for all using (auth.uid() = user_id);

-- Medições: acessa se a obra pertence ao usuário
create policy "Usuário acessa medições das próprias obras" on medicoes
  for all using (
    obra_id in (select id from obras where user_id = auth.uid())
  );

-- Orçamentos: acessa se a obra pertence ao usuário
create policy "Usuário acessa orçamentos das próprias obras" on orcamentos
  for all using (
    obra_id in (select id from obras where user_id = auth.uid())
  );

-- Execuções: acessa se a obra pertence ao usuário
create policy "Usuário acessa execuções das próprias obras" on execucoes
  for all using (
    obra_id in (select id from obras where user_id = auth.uid())
  );

-- Tabela de Produtos (catálogo de pisos)
create table produtos (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) not null,
  fabricante text not null,
  linha text not null,
  preco_por_m2 numeric not null,
  created_at timestamp with time zone default now()
);

alter table produtos enable row level security;

create policy "Usuário acessa próprios produtos" on produtos
  for all using (auth.uid() = user_id);

-- =============================================
-- Storage bucket para fotos
-- =============================================
insert into storage.buckets (id, name, public)
values ('fotos', 'fotos', true)
on conflict (id) do nothing;

-- Policy para upload de fotos (usuário autenticado)
create policy "Usuário autenticado faz upload" on storage.objects
  for insert with check (bucket_id = 'fotos' and auth.role() = 'authenticated');

create policy "Fotos são públicas" on storage.objects
  for select using (bucket_id = 'fotos');
