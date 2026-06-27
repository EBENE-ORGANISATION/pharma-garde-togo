-- =====================================================================
-- RÉCAPITULATIF DES MODIFICATIONS DE BASE DE DONNÉES — 2026-06-22
-- Projet : PharmaGarde
-- =====================================================================
-- Ce fichier regroupe, pour l'historique du dépôt, l'ENSEMBLE des
-- changements de base appliqués dans Supabase le 22/06/2026. Il reflète
-- l'état FINAL des fonctions (versions définitives). Toutes les commandes
-- sont idempotentes (rejouables sans danger).
--
-- Sommaire :
--   A. planning_garde : dédoublonnage + contrainte d'unicité
--   B. importer_garde : import avec ON CONFLICT (compatible contrainte)
--   C. publier_garde_auto : clôture automatique de la semaine précédente
--   D. depublier_garde_absents : alignement sur la source (retraits)
--   E. Compteur d'utilisateurs anonyme (table + fonctions SECURITY INVOKER)
-- =====================================================================


-- =====================================================================
-- A. planning_garde — dédoublonnage de sécurité + contrainte d'unicité
-- =====================================================================
-- Garde une seule ligne par pharmacie + semaine (priorité aux lignes
-- 'publie', puis source 'api-onpt'). No-op s'il n'y a aucun doublon.
delete from planning_garde
where ctid in (
  select ctid from (
    select ctid,
           row_number() over (
             partition by pharmacie_id, date_debut, date_fin
             order by (statut = 'publie')  desc,
                      (source = 'api-onpt') desc,
                      ctid
           ) as rn
    from planning_garde
  ) t
  where t.rn > 1
);

-- Une pharmacie ne peut plus figurer qu'une fois par semaine.
create unique index if not exists planning_garde_pharm_semaine_uniq
  on planning_garde (pharmacie_id, date_debut, date_fin);


-- =====================================================================
-- B. importer_garde — import des slugs de l'Ordre (avec ON CONFLICT)
-- =====================================================================
create or replace function public.importer_garde(
  p_de    date,
  p_a     date,
  p_slugs text[]
)
returns table(
  inserees       int,
  deja_publiees  int,
  slugs_inconnus text[]
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_inserees      int    := 0;
  v_deja_pub      int    := 0;
  v_inconnus      text[] := '{}';
  v_slug          text;
  v_pharm_id      uuid;
  v_zone_id       uuid;
  v_already_pub   boolean;
begin
  -- 1. Suppression idempotente des brouillons API pour cette semaine.
  delete from planning_garde
  where date_debut = p_de
    and date_fin   = p_a
    and source     = 'api-onpt'
    and statut     = 'brouillon';

  -- 2. Insertion : une ligne par slug.
  foreach v_slug in array p_slugs loop

    select p.id, p.zone_id
    into   v_pharm_id, v_zone_id
    from   pharmacies p
    where  p.slug = v_slug
    limit  1;

    if v_pharm_id is null then
      v_inconnus := v_inconnus || v_slug;
      continue;
    end if;

    select exists (
      select 1
      from   planning_garde
      where  pharmacie_id = v_pharm_id
        and  date_debut   = p_de
        and  date_fin     = p_a
        and  statut       = 'publie'
    ) into v_already_pub;

    if v_already_pub then
      v_deja_pub := v_deja_pub + 1;
      continue;
    end if;

    -- INSERT robuste : ignore proprement si la ligne existe déjà.
    insert into planning_garde
      (pharmacie_id, zone_id, date_debut, date_fin, statut, source)
    values
      (v_pharm_id, v_zone_id, p_de, p_a, 'brouillon', 'api-onpt')
    on conflict (pharmacie_id, date_debut, date_fin) do nothing;

    v_inserees := v_inserees + 1;

  end loop;

  return query select v_inserees, v_deja_pub, v_inconnus;
end;
$$;

revoke execute on function public.importer_garde(date, date, text[]) from public, anon;


-- =====================================================================
-- C. publier_garde_auto — publication + clôture de la semaine précédente
-- =====================================================================
create or replace function public.publier_garde_auto(p_de date, p_a date)
returns table(zone text, pharmacies_publiees int)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_zone_id   uuid;
  v_zone_nom  text;
  v_version   int;
  v_data      jsonb;
  v_updated   int;
  v_count     int;
begin
  -- 0. CLÔTURE des semaines antérieures : dépublie toute garde publiée
  --    commençant avant la nouvelle semaine (évite le cumul au chevauchement).
  --    La semaine en cours (date_debut = p_de) reste intacte.
  update planning_garde
  set    statut = 'brouillon'
  where  statut     = 'publie'
    and  date_debut < p_de;

  -- Boucle sur toutes les zones ayant des entrées source='api-onpt' pour
  -- cette semaine (brouillons OU déjà publiées).
  for v_zone_id in
    select distinct pg.zone_id
    from   planning_garde pg
    where  pg.date_debut = p_de
      and  pg.date_fin   = p_a
      and  pg.source     = 'api-onpt'
    order  by pg.zone_id
  loop

    -- 1. brouillon → publié pour les entrées API de cette zone.
    update planning_garde
    set    statut = 'publie'
    where  zone_id   = v_zone_id
      and  date_debut = p_de
      and  date_fin   = p_a
      and  source     = 'api-onpt'
      and  statut     = 'brouillon';

    get diagnostics v_updated = row_count;

    -- 2. Génère un snapshot uniquement si on vient de publier des lignes.
    if v_updated > 0 then

      select jsonb_build_object(
        'zone', (
          select jsonb_build_object('id', id, 'nom', nom, 'slug', slug)
          from   zones
          where  id = v_zone_id
        ),
        'pharmacies', coalesce((
          select jsonb_agg(jsonb_build_object(
            'id',         ph.id,
            'nom',        ph.nom,
            'adresse',    ph.adresse,
            'telephone',  ph.telephone,
            'latitude',   ph.latitude,
            'longitude',  ph.longitude,
            'zone_id',    ph.zone_id,
            'actif',      ph.actif,
            'created_at', ph.created_at
          ))
          from   planning_garde pg2
          join   pharmacies ph on ph.id = pg2.pharmacie_id
          where  pg2.zone_id   = v_zone_id
            and  pg2.date_debut = p_de
            and  pg2.date_fin   = p_a
            and  pg2.statut     = 'publie'
            and  ph.actif
        ), '[]'::jsonb),
        'numeros_urgence', coalesce((
          select jsonb_agg(jsonb_build_object(
            'id',      id,
            'libelle', libelle,
            'numero',  numero,
            'ordre',   ordre,
            'zone_id', zone_id
          ) order by ordre)
          from   numeros_urgence
          where  zone_id = v_zone_id and actif
        ), '[]'::jsonb),
        'generated_at', now()
      ) into v_data;

      select coalesce(max(version), 0) + 1
      into   v_version
      from   snapshots
      where  zone_id = v_zone_id;

      insert into snapshots (zone_id, version, semaine, published_at, data)
      values (
        v_zone_id,
        v_version,
        to_char(p_de, 'IYYY-"W"IW'),
        now(),
        v_data
      );

    end if;

    -- 3. Compte final des pharmacies publiées pour cette zone+semaine.
    select count(*)
    into   v_count
    from   planning_garde
    where  zone_id   = v_zone_id
      and  date_debut = p_de
      and  date_fin   = p_a
      and  statut     = 'publie';

    select nom into v_zone_nom from zones where id = v_zone_id;

    zone               := v_zone_nom;
    pharmacies_publiees := v_count;
    return next;

  end loop;
end;
$$;

revoke execute on function public.publier_garde_auto(date, date) from public, anon;


-- =====================================================================
-- D. depublier_garde_absents — alignement sur la source (retraits)
-- =====================================================================
-- Supprime les entrées API (source='api-onpt') de la semaine dont la
-- pharmacie n'est plus dans la liste de slugs fournie. Ne touche jamais
-- aux saisies manuelles. Appelée par fetch-garde APRÈS les garde-fous.
create or replace function public.depublier_garde_absents(
  p_de    date,
  p_a     date,
  p_slugs text[]
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_deleted int;
begin
  delete from planning_garde pg
  where pg.date_debut = p_de
    and pg.date_fin   = p_a
    and pg.source     = 'api-onpt'
    and not exists (
      select 1
      from   pharmacies ph
      where  ph.id   = pg.pharmacie_id
        and  ph.slug = any(p_slugs)
    );

  get diagnostics v_deleted = row_count;
  return v_deleted;
end;
$$;

revoke execute on function public.depublier_garde_absents(date, date, text[]) from public, anon;


-- =====================================================================
-- E. Compteur d'utilisateurs anonyme (état FINAL, SECURITY INVOKER)
-- =====================================================================
-- Identifiant anonyme par appareil ; aucune donnée personnelle.
-- Lecture des stats réservée à l'admin. Écritures via fonction contrôlée.

-- Table
create table if not exists public.app_usage (
  anon_id     text primary key,
  platform    text,
  app_version text,
  first_seen  timestamptz not null default now(),
  last_seen   timestamptz not null default now()
);

alter table public.app_usage enable row level security;

-- Lecture réservée à l'admin
drop policy if exists "admin read app_usage" on public.app_usage;
create policy "admin read app_usage" on public.app_usage
  for select using (is_admin());

-- Écriture anonyme (données anonymes, faible sensibilité)
drop policy if exists "anon insert app_usage" on public.app_usage;
create policy "anon insert app_usage" on public.app_usage
  for insert to anon, authenticated
  with check (true);

drop policy if exists "anon update app_usage" on public.app_usage;
create policy "anon update app_usage" on public.app_usage
  for update to anon, authenticated
  using (true) with check (true);

-- Ping anonyme (SECURITY INVOKER)
create or replace function public.ping_usage(
  p_anon_id text,
  p_platform text,
  p_version text
)
returns void
language plpgsql
security invoker
set search_path = public
as $$
begin
  if p_anon_id is null or length(p_anon_id) < 8 then
    return;
  end if;

  insert into public.app_usage (anon_id, platform, app_version, first_seen, last_seen)
  values (p_anon_id, left(p_platform, 16), left(p_version, 32), now(), now())
  on conflict (anon_id) do update
    set last_seen   = now(),
        platform    = excluded.platform,
        app_version = excluded.app_version;
end;
$$;

grant execute on function public.ping_usage(text, text, text) to anon, authenticated;

-- Statistiques agrégées — réservé à l'admin (SECURITY INVOKER)
create or replace function public.stats_usage()
returns json
language plpgsql
security invoker
set search_path = public
as $$
declare
  v json;
begin
  if not is_admin() then
    raise exception 'forbidden';
  end if;

  select json_build_object(
    'total',       count(*),
    'actifs_7j',   count(*) filter (where last_seen  > now() - interval '7 days'),
    'actifs_30j',  count(*) filter (where last_seen  > now() - interval '30 days'),
    'nouveaux_7j', count(*) filter (where first_seen > now() - interval '7 days'),
    'apk',         count(*) filter (where platform = 'apk'),
    'web',         count(*) filter (where platform = 'web'),
    'genere_le',   now()
  ) into v
  from public.app_usage;

  return v;
end;
$$;

revoke execute on function public.stats_usage() from anon, public;
grant  execute on function public.stats_usage() to authenticated;

-- =====================================================================
-- FIN DU RÉCAPITULATIF — 2026-06-22
-- =====================================================================
