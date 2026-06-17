-- Sécurité : resserre l'exécution des fonctions d'automatisation garde.
-- importer_garde et publier_garde_auto ne sont appelées QUE par l'Edge Function
-- (service_role) ; on retire EXECUTE à anon et authenticated.
-- Décisions volontaires (NON modifiées ici) :
--   * is_admin()     garde EXECUTE pour authenticated : utilisée dans les politiques RLS.
--   * publier_zone() garde EXECUTE pour authenticated : appelée par l'admin connecté.
--   * pg_net reste dans le schéma public : requis par le cron garde (pg_cron + pg_net).
do $$
declare r record;
begin
  for r in
    select p.oid::regprocedure as sig
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in ('importer_garde','publier_garde_auto')
  loop
    execute format('revoke execute on function %s from anon, authenticated;', r.sig);
  end loop;
end $$;
