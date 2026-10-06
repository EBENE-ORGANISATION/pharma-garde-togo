-- Audit 2026-10-06 — à appliquer en production (SQL Editor ou supabase db push).

-- 1. depublier_garde_absents supprime des lignes du planning sans contrôle is_admin().
--    Seule l'Edge Function fetch-garde l'appelle (clé service_role) : on retire l'accès
--    aux comptes connectés, sinon n'importe quel inscrit pourrait vider le planning.
revoke execute on function public.depublier_garde_absents(date, date, text[]) from public, anon, authenticated;
grant execute on function public.depublier_garde_absents(date, date, text[]) to service_role;

-- 2. Index sur les clés étrangères (lint unindexed_foreign_keys).
create index if not exists numeros_urgence_zone_id_idx on public.numeros_urgence (zone_id);
create index if not exists pharmacies_zone_id_idx on public.pharmacies (zone_id);
create index if not exists planning_garde_zone_id_idx on public.planning_garde (zone_id);
create index if not exists signalements_pharmacie_id_idx on public.signalements (pharmacie_id);
