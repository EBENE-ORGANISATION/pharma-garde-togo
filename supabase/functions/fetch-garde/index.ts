// Edge Function : fetch-garde
// Récupère le planning de garde de la semaine courante depuis l'API de l'Ordre
// National des Pharmaciens du Togo (ONPT) et l'importe dans la base via
// la fonction Postgres importer_garde().
//
// Déclenchement : cron planifié (ex. chaque lundi matin) ou appel manuel HTTP.
// Méthode : GET (pas de corps attendu).
//
// Variables d'environnement requises (injectées automatiquement par Supabase) :
//   SUPABASE_URL              URL du projet (ex. https://xxx.supabase.co)
//   SUPABASE_SERVICE_ROLE_KEY Clé service_role (bypasse RLS, permet d'appeler
//                             importer_garde qui est révoquée aux autres rôles)

import { createClient } from "jsr:@supabase/supabase-js@2";

const ONPT_API =
  "https://www.pharmaciens.tg/api/pharmacies-de-gardes" +
  "?populate[pharmacies][populate][pharmacie][populate][adresse]=true" +
  "&populate[pharmacies][populate][pharmacie][populate][zone]=true" +
  "&pagination[page]=1&pagination[pageSize]=500";

Deno.serve(async (_req: Request): Promise<Response> => {
  try {
    // -----------------------------------------------------------------------
    // 1. Date du jour en UTC (= heure du Togo : UTC+0 toute l'année, pas de
    //    changement d'heure).
    // -----------------------------------------------------------------------
    const today = new Date().toISOString().slice(0, 10); // "YYYY-MM-DD"

    // -----------------------------------------------------------------------
    // 2. Appel API ONPT — planning de garde de la semaine qui encadre today.
    // -----------------------------------------------------------------------
    const apiUrl =
      `${ONPT_API}&filters[a][$gte]=${today}&filters[de][$lte]=${today}`;

    const apiResp = await fetch(apiUrl, {
      headers: { "User-Agent": "pharma-garde-togo-edge/1.0" },
    });

    if (!apiResp.ok) {
      return json(
        {
          ok: false,
          error: `API ONPT a répondu ${apiResp.status} ${apiResp.statusText}`,
          url: apiUrl,
        },
        502,
      );
    }

    const apiJson = await apiResp.json();
    const semaines: unknown[] = apiJson?.data ?? [];

    if (semaines.length === 0) {
      return json({
        ok: true,
        today,
        message: "Aucun planning de garde trouvé pour cette date.",
        semaines: [],
      });
    }

    // -----------------------------------------------------------------------
    // 3. Client Supabase avec service_role (nécessaire pour appeler
    //    importer_garde, révoquée aux rôles anon / authenticated).
    // -----------------------------------------------------------------------
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !serviceKey) {
      return json(
        { ok: false, error: "Variables SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY manquantes." },
        500,
      );
    }

    const supabase = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false },
    });

    // -----------------------------------------------------------------------
    // 4. Pour chaque planning renvoyé (en pratique : un seul), extraire les
    //    slugs et appeler importer_garde().
    // -----------------------------------------------------------------------
    const resultats = [];

    for (const semaine of semaines as Record<string, unknown>[]) {
      const pDe = semaine.de as string;
      const pA  = semaine.a  as string;

      // Extraire les slugs valides (ignorer entrées sans pharmacie ou sans slug)
      const items = (semaine.pharmacies ?? []) as Record<string, unknown>[];
      const slugs = items
        .map((item) => (item.pharmacie as Record<string, unknown> | null)?.slug as string | undefined)
        .filter((s): s is string => typeof s === "string" && s.length > 0);

      if (slugs.length === 0) {
        resultats.push({
          de: pDe,
          a:  pA,
          slugs_extraits: 0,
          warning: "Aucun slug extrait — vérifier la structure de l'API.",
        });
        continue;
      }

      // Appel RPC importer_garde(p_de, p_a, p_slugs)
      const { data, error } = await supabase.rpc("importer_garde", {
        p_de:    pDe,
        p_a:     pA,
        p_slugs: slugs,
      });

      if (error) {
        resultats.push({
          de:    pDe,
          a:     pA,
          slugs_extraits: slugs.length,
          error: error.message,
        });
        continue;
      }

      // importer_garde retourne une table d'une seule ligne
      const row = Array.isArray(data) ? data[0] : data;

      resultats.push({
        de:              pDe,
        a:               pA,
        slugs_extraits:  slugs.length,
        inserees:        row?.inserees        ?? 0,
        deja_publiees:   row?.deja_publiees   ?? 0,
        slugs_inconnus:  row?.slugs_inconnus  ?? [],
      });
    }

    // -----------------------------------------------------------------------
    // 5. Réponse récapitulative.
    // -----------------------------------------------------------------------
    const hasError = resultats.some((r) => "error" in r);

    return json({
      ok:       !hasError,
      today,
      semaines: resultats,
    });
  } catch (err) {
    return json(
      { ok: false, error: err instanceof Error ? err.message : String(err) },
      500,
    );
  }
});

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
}
