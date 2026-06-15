-- Phase 3 — Durcissement de securite de l'espace admin
--
-- Deja execute manuellement dans le SQL Editor de Supabase.
-- Ce fichier documente le changement pour garder le depot coherent avec
-- l'etat reel de la base (cf. supabase/migrations/phase3_admin.sql).
--
-- Objectif : retirer tout acces anonyme aux fonctions/policies admin.
-- is_admin() renvoie deja "false" pour un utilisateur anonyme
-- (auth.uid() est null), mais on retire en plus le droit d'EXECUTE
-- accorde au role anon par defense en profondeur, et on restreint
-- explicitement les policies d'ecriture admin au role "authenticated".
--
-- Aucune policy SELECT publique existante n'est modifiee : la lecture
-- anonyme sur zones / pharmacies / numeros_urgence / snapshots continue
-- de fonctionner exactement comme avant.

-- =========================================================
-- 1. Retirer l'execution anonyme des fonctions admin
-- =========================================================
revoke execute on function public.is_admin() from anon;
revoke execute on function public.publier_zone(uuid) from anon;

-- =========================================================
-- 2. Restreindre les policies d'ecriture admin au role authenticated
-- =========================================================

drop policy if exists "admin write pharmacies" on public.pharmacies;
create policy "admin write pharmacies"
  on public.pharmacies
  for all
  to authenticated
  using (is_admin())
  with check (is_admin());

drop policy if exists "admin write numeros_urgence" on public.numeros_urgence;
create policy "admin write numeros_urgence"
  on public.numeros_urgence
  for all
  to authenticated
  using (is_admin())
  with check (is_admin());

drop policy if exists "admin all planning_garde" on public.planning_garde;
create policy "admin all planning_garde"
  on public.planning_garde
  for all
  to authenticated
  using (is_admin())
  with check (is_admin());
