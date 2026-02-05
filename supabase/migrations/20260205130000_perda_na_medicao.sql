-- Migration: Mover perda para medição
-- Adiciona campo perda_percentual na tabela medicoes

ALTER TABLE medicoes
  ADD COLUMN IF NOT EXISTS perda_percentual numeric DEFAULT 10;
