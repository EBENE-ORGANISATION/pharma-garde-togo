-- Contributions utilisateurs : signalements de problèmes sur les pharmacies
-- Date : 2026-07-06
--
-- Principe : un utilisateur peut signaler un problème sur une pharmacie
-- (position incorrecte, fermeture, autre). Le signalement arrive en file
-- d'attente ('nouveau') et n'est JAMAIS appliqué automatiquement : l'admin
-- valide (approuve/rejette) depuis le tableau de bord. Sécurité essentielle
-- pour une appli de santé.
--
-- Confidentialité : anonyme (réutilise l'identifiant anonyme de l'appareil).

create table if not exists public.signalements (
  id            uuid primary key default gen_random_uuid(),
  pharmacie_id  uuid not null references public.pharmacies(id) on delete cascade,
  type          text not null,                    -- 'position' | 'ferme' | 'autre'
  message       text,
  lat_suggeree  double precision,                 -- position GPS proposée (type 'position')
  lng_suggeree  double precision,
  anon_id       text,                             -- identifiant anonyme du contributeur
  statut        text not null default 'nouveau',  -- 'nouveau' | 'traite' | 'rejete'
  created_at    timestamptz not null default now()
);

create index if not exists signalements_statut_idx
  on public.signalements (statut, created_at);

alter table public.signalements enable row level security;

-- 1) INSERTION publique (contribution anonyme) — avec garde-fous de validité.
--    statut forcé à 'nouveau' : personne ne peut auto-approuver.
--    Coordonnées bornées au Togo (rejette les valeurs aberrantes).
drop policy if exists "public insert signalements" on public.signalements;
create policy "public insert signalements" on public.signalements
  for insert to anon, authenticated
  with check (
    type in ('position', 'ferme', 'autre')
    and statut = 'nouveau'
    and (message is null or length(message) <= 500)
    and (lat_suggeree is null or lat_suggeree between 5.0 and 12.0)
    and (lng_suggeree is null or lng_suggeree between -1.0 and 3.0)
  );

-- 2) LECTURE + GESTION réservées à l'admin.
drop policy if exists "admin read signalements" on public.signalements;
create policy "admin read signalements" on public.signalements
  for select using (is_admin());

drop policy if exists "admin update signalements" on public.signalements;
create policy "admin update signalements" on public.signalements
  for update to authenticated
  using (is_admin()) with check (is_admin());

drop policy if exists "admin delete signalements" on public.signalements;
create policy "admin delete signalements" on public.signalements
  for delete to authenticated
  using (is_admin());
