-- Fonction Postgres : publier_garde_auto
-- Publication automatique de toute la garde d'une semaine importée via l'API ONPT.
--
-- Arguments :
--   p_de  date  : début de semaine  (ex. '2026-06-15')
--   p_a   date  : fin   de semaine  (ex. '2026-06-22')
--
-- Retourne (une ligne par zone publiée) :
--   zone               text  nom de la zone
--   pharmacies_publiees int   nombre de lignes statut='publie' pour la zone+semaine
--
-- Logique (reproduction exacte du chemin admin "Publier la semaine") :
--   1. UPDATE planning_garde brouillon→publie pour les lignes source='api-onpt'
--      de cette semaine.  Ne touche pas aux entrées publiées ni aux saisies admin.
--   2. Génère un snapshot par zone (même logique que publier_zone, mais filtrée
--      sur p_de/p_a plutôt que now() — plus fiable pour une automatisation).
--      Le snapshot n'est créé que si des lignes ont été passées à 'publie' au
--      step 1 (idempotence : un second appel ne génère pas une version inutile).
--   3. Renvoie la liste des zones traitées avec le compte final de pharmacies publiées.
--
-- Différence clé avec publier_zone() :
--   publier_zone() exige is_admin() (auth.uid() != null), incompatible avec
--   service_role sans session. Cette fonction est SECURITY DEFINER et réservée
--   à service_role via REVOKE — le contrôle d'accès est porté par le rôle appelant,
--   pas par is_admin().
--
-- Idempotence :
--   Si tout est déjà publié (second appel), UPDATE affecte 0 lignes → pas de
--   nouveau snapshot. Le compte de pharmacies publiées est quand même renvoyé.
--
-- À exécuter dans le SQL Editor de Supabase (owner / service_role).

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
  -- Boucle sur toutes les zones ayant des entrées source='api-onpt' pour
  -- cette semaine (brouillons OU déjà publiées — pour que le rapport soit
  -- complet même en cas de ré-exécution).
  for v_zone_id in
    select distinct pg.zone_id
    from   planning_garde pg
    where  pg.date_debut = p_de
      and  pg.date_fin   = p_a
      and  pg.source     = 'api-onpt'
    order  by pg.zone_id
  loop

    -- ------------------------------------------------------------------
    -- 1. Passage brouillon → publié pour les entrées API de cette zone.
    --    UPDATE plutôt que DELETE/INSERT : on ne touche pas aux autres
    --    entrées de la zone (saisies admin, source différente, etc.).
    -- ------------------------------------------------------------------
    update planning_garde
    set    statut = 'publie'
    where  zone_id   = v_zone_id
      and  date_debut = p_de
      and  date_fin   = p_a
      and  source     = 'api-onpt'
      and  statut     = 'brouillon';

    get diagnostics v_updated = row_count;

    -- ------------------------------------------------------------------
    -- 2. Génère un snapshot UNIQUEMENT si on vient de passer des lignes
    --    à 'publie' (évite les versions snapshot parasites en ré-exécution).
    --
    --    Logique identique à publier_zone() :
    --    - pharmacies : planning_garde publiées + actives sur p_de/p_a
    --    - numeros_urgence : tous les numéros actifs de la zone
    --    - version = max(version existante) + 1
    --
    --    Différence vs publier_zone() : filtre par p_de/p_a explicitement
    --    au lieu de now() BETWEEN date_debut AND date_fin, pour garantir
    --    la cohérence quelle que soit l'heure d'exécution.
    -- ------------------------------------------------------------------
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
        to_char(p_de, 'IYYY-"W"IW'),   -- semaine ISO de p_de, ex. '2026-W25'
        now(),
        v_data
      );

    end if;

    -- ------------------------------------------------------------------
    -- 3. Compte final des pharmacies publiées pour cette zone+semaine
    --    (brouillons passés à l'instant + éventuellement déjà publiées).
    -- ------------------------------------------------------------------
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

-- Seul service_role peut appeler cette fonction (via l'Edge Function planifiée).
-- "public" englobe anon et authenticated ; on le liste aussi explicitement.
revoke execute on function public.publier_garde_auto(date, date) from public, anon;
