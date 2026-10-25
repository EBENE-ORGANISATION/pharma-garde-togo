-- Mesure marketing 2026-10-25 — à appliquer en production (SQL Editor ou supabase db push).
-- Ajoute : l'origine des utilisateurs (?src=…), les gestes utiles (appel, itinéraire,
-- recherche de médicament) et une fonction de statistiques réservée à l'admin.
-- Données anonymes : aucun numéro, aucune position, aucun texte de recherche.

-- 1. Origine du premier contact (first-touch) sur app_usage
alter table public.app_usage add column if not exists source text;

-- 2. Ping avec origine. L'ancienne ping_usage(text, text, text) reste en place pour
--    les APK déjà installés ; pas de valeur par défaut ici, sinon un appel à 3
--    arguments deviendrait ambigu entre les deux fonctions.
--    SECURITY DEFINER comme ping_usage en production : anon n'a pas de lecture sur
--    app_usage, et INSERT ... ON CONFLICT DO UPDATE en a besoin sous RLS.
create or replace function public.ping_usage_v2(
  p_anon_id text,
  p_platform text,
  p_version text,
  p_source text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_source text := nullif(lower(left(p_source, 32)), '');
begin
  if p_anon_id is null or length(p_anon_id) < 8 then
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
$$;

revoke execute on function public.ping_usage_v2(text, text, text, text) from public;
grant execute on function public.ping_usage_v2(text, text, text, text) to anon, authenticated;

-- 3. Événements anonymes
create table if not exists public.app_events (
  id         bigint generated always as identity primary key,
  anon_id    text not null,
  event      text not null,
  detail     text,
  created_at timestamptz not null default now()
);

create index if not exists app_events_created_at_idx on public.app_events (created_at);

alter table public.app_events enable row level security;

drop policy if exists "admin read app_events" on public.app_events;
create policy "admin read app_events" on public.app_events
  for select using (is_admin());

-- Écriture seule, valeurs contrôlées ; pas de lecture ni de modification anonyme.
drop policy if exists "anon insert app_events" on public.app_events;
create policy "anon insert app_events" on public.app_events
  for insert to anon, authenticated
  with check (
    length(anon_id) between 8 and 64
    and event in ('appel', 'appel_urgence', 'itineraire', 'recherche_medicament', 'arrivee')
    and (detail is null or detail ~ '^[a-z0-9_-]{1,32}$')
    and created_at > now() - interval '1 minute'
    and created_at < now() + interval '1 minute'
  );

-- 4. Statistiques marketing — réservé à l'admin (SECURITY INVOKER)
create or replace function public.stats_marketing()
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

  with ev as (
    select * from public.app_events where created_at > now() - interval '30 days'
  ),
  actifs as (
    select count(*) as n from public.app_usage where last_seen > now() - interval '30 days'
  )
  select json_build_object(
    'appels_7j',       (select count(*) from ev where event = 'appel' and created_at > now() - interval '7 days'),
    'appels_30j',      (select count(*) from ev where event = 'appel'),
    'itineraires_7j',  (select count(*) from ev where event = 'itineraire' and created_at > now() - interval '7 days'),
    'itineraires_30j', (select count(*) from ev where event = 'itineraire'),
    'urgences_30j',    (select count(*) from ev where event = 'appel_urgence'),
    'recherches_30j',  (select count(*) from ev where event = 'recherche_medicament'),
    'utiles_30j',      (select count(distinct anon_id) from ev where event in ('appel', 'itineraire')),
    'actifs_30j',      (select n from actifs),
    'arrivees_30j',    coalesce((
      select json_object_agg(detail, n order by n desc)
      from (select detail, count(*) as n from ev
            where event = 'arrivee' and detail is not null
            group by detail) s
    ), '{}'::json),
    'nouveaux_par_source_30j', coalesce((
      select json_object_agg(src, n order by n desc)
      from (select coalesce(source, 'direct') as src, count(*) as n
            from public.app_usage
            where first_seen > now() - interval '30 days'
            group by 1) s
    ), '{}'::json),
    'genere_le',       now()
  ) into v;

  return v;
end;
$$;

revoke execute on function public.stats_marketing() from anon, public;
grant  execute on function public.stats_marketing() to authenticated;
