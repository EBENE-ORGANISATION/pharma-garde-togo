-- Lot B (audit du 06/11/2026)
--   A. publier_garde_auto : nouveau snapshot aussi quand des pharmacies sont
--      retirées (et zone vidée), sans écraser une publication manuelle.
--   B. Amorçage : marque 'source':'auto' sur les derniers snapshots dont la
--      publication automatique est prouvée par garde_runs.
--   C. app_usage : plus d'écriture directe par anon/authenticated (tout passe
--      par ping_usage / ping_usage_v2, SECURITY DEFINER) ; anon_id borné à 64.

-- ---------------------------------------------------------------------------
-- A. publier_garde_auto
-- ---------------------------------------------------------------------------
create or replace function public.publier_garde_auto(p_de date, p_a date)
returns table(zone text, pharmacies_publiees integer)
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_semaine    text := to_char(p_de, 'IYYY-"W"IW');
  v_zone_id    uuid;
  v_zone_nom   text;
  v_version    int;
  v_data       jsonb;
  v_updated    int;
  v_count      int;
  v_last       public.snapshots;
  v_remplacable boolean;
begin
  -- 0. CLÔTURE des semaines antérieures (inchangé).
  update planning_garde
  set    statut = 'brouillon'
  where  statut     = 'publie'
    and  date_debut < p_de;

  -- Zones à traiter : celles qui ont des lignes API pour cette semaine, plus
  -- celles publiées automatiquement cette semaine (elles ont pu être vidées).
  for v_zone_id in
    select pg.zone_id
    from   planning_garde pg
    where  pg.date_debut = p_de
      and  pg.date_fin   = p_a
      and  pg.source     = 'api-onpt'
    union
    select s.zone_id
    from   snapshots s
    where  s.version = (select max(s2.version) from snapshots s2 where s2.zone_id = s.zone_id)
      and  s.semaine = v_semaine
      and  s.data->>'source' = 'auto'
    order  by 1
  loop

    -- 1. brouillon → publié pour les entrées API de cette zone (inchangé).
    update planning_garde
    set    statut = 'publie'
    where  zone_id    = v_zone_id
      and  date_debut = p_de
      and  date_fin   = p_a
      and  source     = 'api-onpt'
      and  statut     = 'brouillon';

    get diagnostics v_updated = row_count;

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
        where  pg2.zone_id    = v_zone_id
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
      'generated_at', now(),
      'source', 'auto'
    ) into v_data;

    select * into v_last
    from   snapshots
    where  zone_id = v_zone_id
    order  by version desc
    limit  1;

    -- Remplaçable : aucun snapshot, snapshot automatique, ou snapshot d'une
    -- semaine antérieure. Un snapshot non marqué de la semaine = manuel, protégé.
    v_remplacable := v_last.zone_id is null
                  or v_last.data->>'source' = 'auto'
                  or v_last.semaine < v_semaine;

    -- 2. Snapshot si on vient de publier des lignes (comportement historique),
    --    ou si la liste publiée a changé (retraits) et que le snapshot est remplaçable.
    if v_updated > 0
       or (v_remplacable and
           coalesce((select array_agg(e->>'id' order by e->>'id')
                     from jsonb_array_elements(coalesce(v_data->'pharmacies', '[]'::jsonb)) e), '{}')
           is distinct from
           coalesce((select array_agg(e->>'id' order by e->>'id')
                     from jsonb_array_elements(coalesce(v_last.data->'pharmacies', '[]'::jsonb)) e), '{}')
          )
    then
      select coalesce(max(version), 0) + 1
      into   v_version
      from   snapshots
      where  zone_id = v_zone_id;

      insert into snapshots (zone_id, version, semaine, published_at, data)
      values (v_zone_id, v_version, v_semaine, now(), v_data);
    end if;

    -- 3. Compte final des pharmacies publiées pour cette zone+semaine (inchangé).
    select count(*)
    into   v_count
    from   planning_garde
    where  zone_id    = v_zone_id
      and  date_debut = p_de
      and  date_fin   = p_a
      and  statut     = 'publie';

    select nom into v_zone_nom from zones where id = v_zone_id;

    zone                := v_zone_nom;
    pharmacies_publiees := v_count;
    return next;

  end loop;
end;
$function$;

revoke execute on function public.publier_garde_auto(date, date) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- B. Amorçage de la provenance : uniquement les derniers snapshots dont la
--    publication automatique est confirmée par le journal du cron.
-- ---------------------------------------------------------------------------
update snapshots s
set    data = s.data || '{"source":"auto"}'::jsonb
where  s.version = (select max(s2.version) from snapshots s2 where s2.zone_id = s.zone_id)
  and  coalesce(s.data->>'source', '') <> 'auto'
  and  exists (
         select 1 from garde_runs r
         where  r.statut = 'publiee'
           and  r.run_at >= s.published_at
           and  r.run_at <= s.published_at + interval '10 seconds'
       );

-- ---------------------------------------------------------------------------
-- C. app_usage : écritures uniquement via les RPC SECURITY DEFINER.
-- ---------------------------------------------------------------------------
drop policy if exists "anon insert app_usage" on public.app_usage;
drop policy if exists "anon update app_usage" on public.app_usage;
revoke insert, update, delete, truncate on public.app_usage from anon, authenticated;

create or replace function public.ping_usage(p_anon_id text, p_platform text, p_version text)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if p_anon_id is null or length(p_anon_id) < 8 or length(p_anon_id) > 64 then
    return;
  end if;

  insert into public.app_usage (anon_id, platform, app_version, first_seen, last_seen)
  values (p_anon_id, left(p_platform, 16), left(p_version, 32), now(), now())
  on conflict (anon_id) do update
    set last_seen   = now(),
        platform    = excluded.platform,
        app_version = excluded.app_version;
end;
$function$;

create or replace function public.ping_usage_v2(p_anon_id text, p_platform text, p_version text, p_source text)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_source text := nullif(lower(left(p_source, 32)), '');
begin
  if p_anon_id is null or length(p_anon_id) < 8 or length(p_anon_id) > 64 then
    return;
  end if;
  if v_source is not null and v_source !~ '^[a-z0-9_-]+$' then
    v_source := null;
  end if;

  insert into public.app_usage (anon_id, platform, app_version, first_seen, last_seen, source)
  values (p_anon_id, left(p_platform, 16), left(p_version, 32), now(), now(), v_source)
  on conflict (anon_id) do update
    set last_seen   = now(),
        platform    = excluded.platform,
        app_version = excluded.app_version,
        source      = coalesce(public.app_usage.source, excluded.source);
end;
$function$;
