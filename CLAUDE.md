# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Obra Facil is a construction project management web app (Portuguese-language UI). It tracks projects (obras) through a pipeline: lead -> medicao -> orcado -> execucao -> finalizado. Built with React 19 + TypeScript + Vite, using Supabase as the backend (auth, PostgreSQL database, file storage).

## Commands

- `npm run dev` - Start Vite dev server (localhost:5173)
- `npm run build` - TypeScript check + production build (`tsc -b && vite build`)
- `npm run lint` - ESLint
- `npm run preview` - Preview production build

No test framework is configured.

## Architecture

**Stack:** React 19, TypeScript 5.9, Vite 7, Tailwind CSS 4, Supabase, React Router DOM 7

**Data flow:** Components call Supabase directly (no API layer or state management library). The Supabase client is initialized in `src/lib/supabase.ts` using env vars `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.

**Auth:** `src/lib/useAuth.ts` hook provides `{ user, loading }`. `ProtectedRoute` in `App.tsx` wraps all authenticated routes and redirects to `/login`. Authenticated pages render inside `Layout` component.

**Routes:**
- `/login` - Login/signup (email+password via Supabase Auth)
- `/` - ObrasList (project listing with search/filter)
- `/obras/nova` - ObraForm (create)
- `/obras/:id` - ObraDetail (detail view with tabs for medicoes, orcamentos, execucoes)
- `/obras/:id/editar` - ObraForm (edit)

**Database:** Schema in `schema.sql`. Four tables with RLS policies scoped to `auth.uid()`:
- `obras` - main entity, owned by user_id
- `medicoes` - measurements (m2/ml/unidade), linked to obra
- `orcamentos` - budgets with status (enviado/aprovado/perdido)
- `execucoes` - execution records with photo upload (pendente/concluido)

All child tables cascade-delete with their parent obra.

**Types:** `src/types/index.ts` mirrors the database tables as TypeScript interfaces (`Obra`, `Medicao`, `Orcamento`, `Execucao`).

**Key components:**
- `src/pages/` - route-level page components
- `src/components/` - `Layout`, `StatusBadge`, and form components (`MedicaoForm`, `OrcamentoForm`, `ExecucaoSection`) used within ObraDetail tabs
- Form components accept `obraId` and `onSave` callback to trigger parent reload

**File storage:** Supabase Storage bucket `fotos` (public read, authenticated upload) for execution photos.
