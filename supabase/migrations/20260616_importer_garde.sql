-- Fonction Postgres : importer_garde
-- Importe une semaine de garde depuis les slugs fournis par l'API de l'Ordre.
--
-- Arguments :
--   p_de    date     : début de la semaine  (ex. '2026-06-15')
--   p_a     date     : fin   de la semaine  (ex. '2026-06-22')
--   p_slugs text[]   : slugs des pharmacies de garde (depuis fetch-garde.mjs)
--
-- Retourne :
--   inserees      int      nombre de lignes insérées (statut 'brouillon')
--   deja_publiees int      slugs ignorés car déjà en statut 'publie' pour cette semaine
--   slugs_inconnus text[]  slugs absents de notre table pharmacies
--
-- Idempotence :
--   supprime d'abord les brouillons API de cette semaine (source='api-onpt',
--   statut='brouillon') avant de réinsérer — sans toucher aux lignes publiées
--   ni aux saisies manuelles (source <> 'api-onpt' ou statut='publie').
--
-- Sécurité :
--   SECURITY DEFINER : s'exécute avec les droits du propriétaire (service_role).
--   REVOKE en fin de fichier : seul service_role peut l'appeler.
--   À exécuter dans le SQL Editor de Supabase (connecté en tant que owner/service_role).

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
  -- -----------------------------------------------------------------------
  -- 1. Suppression idempotente des brouillons API pour cette semaine.
  --    Ne touche pas aux lignes publiées (statut='publie') ni aux entrées
  --    admin (source='admin' ou source IS NULL).
  -- -----------------------------------------------------------------------
  delete from planning_garde
  where date_debut = p_de
    and date_fin   = p_a
    and source     = 'api-onpt'
    and statut     = 'brouillon';

  -- -----------------------------------------------------------------------
  -- 2. Insertion : une ligne par slug, en résolvant les UUIDs depuis notre
  --    table pharmacies — même logique que les INSERT de garde-semaine.sql.
  -- -----------------------------------------------------------------------
  foreach v_slug in array p_slugs loop

    -- Résoudre pharmacie_id et zone_id depuis notre annuaire (par slug).
    -- SELECT INTO : affecte NULL si aucune ligne trouvée (comportement PL/pgSQL garanti).
    select p.id, p.zone_id
    into   v_pharm_id, v_zone_id
    from   pharmacies p
    where  p.slug = v_slug
    limit  1;

    -- Slug absent de notre annuaire → mémoriser et passer au suivant.
    if v_pharm_id is null then
      v_inconnus := v_inconnus || v_slug;
      continue;
    end if;

    -- Vérifier si cette pharmacie est déjà publiée pour cette semaine.
    -- Dans ce cas on ne réinsère pas un brouillon par-dessus.
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

    -- Insertion au format identique à garde-semaine.sql.
    insert into planning_garde
      (pharmacie_id, zone_id, date_debut, date_fin, statut, source)
    values
      (v_pharm_id, v_zone_id, p_de, p_a, 'brouillon', 'api-onpt');

    v_inserees := v_inserees + 1;

  end loop;

  -- -----------------------------------------------------------------------
  -- 3. Retour du résumé d'exécution.
  -- -----------------------------------------------------------------------
  return query select v_inserees, v_deja_pub, v_inconnus;
end;
$$;

-- -----------------------------------------------------------------------
-- Sécurité : on retire l'accès à tous les rôles non privilégiés.
-- "public" couvre anon et authenticated. On le liste aussi explicitement.
-- Seul service_role (utilisé par l'Edge Function planifiée) peut appeler
-- cette fonction.
-- -----------------------------------------------------------------------
revoke execute on function public.importer_garde(date, date, text[]) from public, anon;
