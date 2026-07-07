-- Journal d'exécution du pipeline de garde (observabilité)
-- Date : 2026-07-06
--
-- But : chaque passage de l'Edge Function fetch-garde écrit ici une ligne
-- (résumé du run). La routine superviseur quotidienne la lit en LECTURE
-- SEULE, via la clé anon, pour détecter les anomalies.
--
-- Qui écrit : uniquement fetch-garde, avec la clé service_role (qui
-- contourne la RLS). Aucune écriture possible avec la clé anon.
--
-- ⚠️ Cette table est lisible publiquement (clé anon). Ne JAMAIS stocker
-- d'information sensible dans la colonne "erreur" (pas de clé, pas de
-- donnée personnelle). Les noms de pharmacies sont déjà publics.
--
-- Vocabulaire de la colonne "statut" :
--   'publiee' : publication réussie (nouvelle semaine ou déjà à jour)
--   'rien'    : rien à publier (l'Ordre n'a fourni aucune donnée)
--   'bloquee' : garde-fou déclenché (liste incomplète / trop d'inconnues)
--   'erreur'  : erreur technique (API injoignable, exception, timeout…)

create table if not exists public.garde_runs (
  id              uuid primary key default gen_random_uuid(),
  run_at          timestamptz not null default now(),
  statut          text        not null,
  nb_importees    int,
  nb_inconnues    int,
  semaine_publiee text,
  erreur          text
);

create index if not exists garde_runs_run_at_idx
  on public.garde_runs (run_at desc);

alter table public.garde_runs enable row level security;

-- Lecture seule (routine superviseur via la clé anon).
-- Pas de policy d'écriture : seul fetch-garde (service_role) écrit,
-- en contournant la RLS.
drop policy if exists "lecture publique garde_runs" on public.garde_runs;
create policy "lecture publique garde_runs" on public.garde_runs
  for select using (true);
