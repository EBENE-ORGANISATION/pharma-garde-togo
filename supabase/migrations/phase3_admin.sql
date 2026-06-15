-- Phase 3 — Espace admin (annuaire + planning de garde + publication)
--
-- A executer manuellement dans le SQL Editor de Supabase.
-- Remplace 'TON_EMAIL_ICI' par l'email du compte admin avant d'executer
-- le bloc 1.
--
-- Aucune policy SELECT existante n'est modifiee : la lecture publique
-- (cle anon) sur zones / pharmacies / numeros_urgence / snapshots continue
-- de fonctionner exactement comme avant.

-- =========================================================
-- 1. Allowlist admin (par email)
-- =========================================================
create table if not exists public.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade
);

alter table public.admin_users enable row level security;
-- Aucune policy ajoutee volontairement : personne (anon/authenticated) ne peut
-- lire/ecrire cette table directement. Seule is_admin() (SECURITY DEFINER)
-- peut la consulter.

insert into public.admin_users (user_id)
select id from auth.users where email = 'TON_EMAIL_ICI'
on conflict (user_id) do nothing;

-- =========================================================
-- 2. Fonction is_admin()
-- =========================================================
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.admin_users where user_id = auth.uid()
  );
$$;

grant execute on function public.is_admin() to authenticated, anon;

-- =========================================================
-- 3. Policies d'ecriture admin (additives)
-- =========================================================

-- Annuaire des pharmacies : lecture publique inchangee, ecriture admin
create policy "admin write pharmacies"
  on public.pharmacies
  for all
  using (is_admin())
  with check (is_admin());

-- Numeros d'urgence : lecture publique inchangee, ecriture admin
create policy "admin write numeros_urgence"
  on public.numeros_urgence
  for all
  using (is_admin())
  with check (is_admin());

-- Planning de garde : pas de lecture publique, acces complet admin uniquement
create policy "admin all planning_garde"
  on public.planning_garde
  for all
  using (is_admin())
  with check (is_admin());

-- =========================================================
-- 4. Fonction publier_zone(zone_id) — avec garde is_admin()
-- =========================================================
create or replace function public.publier_zone(p_zone_id uuid)
returns public.snapshots
language plpgsql
security definer
set search_path = public
as $$
declare
  v_version int;
  v_data jsonb;
begin
  if not is_admin() then
    raise exception 'Acces refuse : reserve aux administrateurs';
  end if;

  select jsonb_build_object(
    'zone', (select jsonb_build_object('id', id, 'nom', nom, 'slug', slug) from zones where id = p_zone_id),
    'pharmacies', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', ph.id, 'nom', ph.nom, 'adresse', ph.adresse,
        'telephone', ph.telephone, 'latitude', ph.latitude,
        'longitude', ph.longitude, 'zone_id', ph.zone_id,
        'actif', ph.actif, 'created_at', ph.created_at
      ))
      from planning_garde pg
      join pharmacies ph on ph.id = pg.pharmacie_id
      where pg.zone_id = p_zone_id
        and pg.statut = 'publie'
        and now() between pg.date_debut and pg.date_fin
        and ph.actif
    ), '[]'::jsonb),
    'numeros_urgence', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', id, 'libelle', libelle, 'numero', numero, 'ordre', ordre, 'zone_id', zone_id
      ) order by ordre)
      from numeros_urgence
      where zone_id = p_zone_id and actif
    ), '[]'::jsonb),
    'generated_at', now()
  ) into v_data;

  select coalesce(max(version), 0) + 1 into v_version
  from snapshots where zone_id = p_zone_id;

  return (
    insert into snapshots (zone_id, version, semaine, published_at, data)
    values (p_zone_id, v_version, to_char(now(), 'IYYY-"W"IW'), now(), v_data)
    returning *
  );
end;
$$;

grant execute on function public.publier_zone(uuid) to authenticated;
