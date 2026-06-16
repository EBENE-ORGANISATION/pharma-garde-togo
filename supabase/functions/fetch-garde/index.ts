// Edge Function : fetch-garde
// Récupère le planning de garde de la semaine courante depuis l'API de l'Ordre
// National des Pharmaciens du Togo (ONPT), l'importe via importer_garde(),
// évalue les garde-fous, puis publie via publier_garde_auto() si les seuils
// sont respectés.
//
// Déclenchement : cron planifié (ex. chaque lundi matin) ou appel manuel HTTP.
// Méthode : GET (pas de corps attendu).
//
// Variables d'environnement requises (injectées automatiquement par Supabase) :
//   SUPABASE_URL              URL du projet (ex. https://xxx.supabase.co)
//   SUPABASE_SERVICE_ROLE_KEY Clé service_role (bypasse RLS, permet d'appeler
//                             importer_garde et publier_garde_auto)

import { createClient } from "jsr:@supabase/supabase-js@2";

const ONPT_API =
  "https://www.pharmaciens.tg/api/pharmacies-de-gardes" +
  "?populate[pharmacies][populate][pharmacie][populate][adresse]=true" +
  "&populate[pharmacies][populate][pharmacie][populate][zone]=true" +
  "&pagination[page]=1&pagination[pageSize]=500";

// Garde-fous de publication automatique.
// Si l'un des seuils n'est pas respecté, la semaine reste en brouillon ;
// une action manuelle depuis /admin est requise.
const MIN_PHARMACIES = 25; // slugs extraits minimum attendus de l'API
const MAX_INCONNUS   = 5;  // slugs absents de notre annuaire tolérés

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
    //    importer_garde et publier_garde_auto, révoquées aux autres rôles).
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
    // 4. Pour chaque planning renvoyé (en pratique : un seul) :
    //    a. extraire les slugs
    //    b. importer en brouillon via importer_garde()
    //    c. évaluer les garde-fous
    //    d. publier via publier_garde_auto() si les seuils passent
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
        console.warn(`[fetch-garde] ${pDe}→${pA} : aucun slug extrait — vérifier la structure de l'API.`);
        resultats.push({
          de:             pDe,
          a:              pA,
          slugs_extraits: 0,
          decision:       "bloquee" as const,
          raison:         "Aucun slug extrait — vérifier la structure de l'API.",
        });
        continue;
      }

      // -------------------------------------------------------------------
      // 4a. Importer en brouillon (idempotent).
      // -------------------------------------------------------------------
      const { data: importData, error: importError } = await supabase.rpc("importer_garde", {
        p_de:    pDe,
        p_a:     pA,
        p_slugs: slugs,
      });

      if (importError) {
        console.error(`[fetch-garde] ${pDe}→${pA} : erreur importer_garde — ${importError.message}`);
        resultats.push({
          de:             pDe,
          a:              pA,
          slugs_extraits: slugs.length,
          error:          importError.message,
        });
        continue;
      }

      // importer_garde retourne une table d'une seule ligne
      const row            = Array.isArray(importData) ? importData[0] : importData;
      const inserees       = (row?.inserees       ?? 0) as number;
      const deja_publiees  = (row?.deja_publiees  ?? 0) as number;
      const slugs_inconnus = (row?.slugs_inconnus ?? []) as string[];

      console.log(
        `[fetch-garde] ${pDe}→${pA} : importé — ` +
        `${slugs.length} slugs extraits, ${inserees} insérées, ` +
        `${deja_publiees} déjà publiées, ${slugs_inconnus.length} inconnu(s).`,
      );

      // -------------------------------------------------------------------
      // 4b. Évaluation des garde-fous.
      // -------------------------------------------------------------------
      const passeVolume   = slugs.length >= MIN_PHARMACIES;
      const passeInconnus = slugs_inconnus.length <= MAX_INCONNUS;

      if (!passeVolume || !passeInconnus) {
        const raisons: string[] = [];
        if (!passeVolume) {
          raisons.push(`trop peu de pharmacies : ${slugs.length} < ${MIN_PHARMACIES}`);
        }
        if (!passeInconnus) {
          raisons.push(`trop de slugs inconnus : ${slugs_inconnus.length} > ${MAX_INCONNUS}`);
        }
        const raison = raisons.join(" ; ");
        console.warn(`[fetch-garde] ${pDe}→${pA} : publication BLOQUÉE — ${raison}`);
        resultats.push({
          de:             pDe,
          a:              pA,
          slugs_extraits: slugs.length,
          inserees,
          deja_publiees,
          slugs_inconnus,
          decision:       "bloquee" as const,
          raison,
        });
        continue;
      }

      // -------------------------------------------------------------------
      // 4c. Garde-fous OK → publication automatique de toute la semaine.
      // -------------------------------------------------------------------
      const { data: pubData, error: pubError } = await supabase.rpc("publier_garde_auto", {
        p_de: pDe,
        p_a:  pA,
      });

      if (pubError) {
        console.error(`[fetch-garde] ${pDe}→${pA} : erreur publier_garde_auto — ${pubError.message}`);
        resultats.push({
          de:             pDe,
          a:              pA,
          slugs_extraits: slugs.length,
          inserees,
          deja_publiees,
          slugs_inconnus,
          decision:       "bloquee" as const,
          raison:         `erreur lors de la publication : ${pubError.message}`,
        });
        continue;
      }

      const zones_publiees = (pubData ?? []) as Array<{
        zone: string;
        pharmacies_publiees: number;
      }>;

      console.log(
        `[fetch-garde] ${pDe}→${pA} : PUBLIÉ — ` +
        `${zones_publiees.length} zone(s) : ` +
        zones_publiees.map((z) => `${z.zone} (${z.pharmacies_publiees})`).join(", "),
      );

      resultats.push({
        de:             pDe,
        a:              pA,
        slugs_extraits: slugs.length,
        inserees,
        deja_publiees,
        slugs_inconnus,
        decision:       "publiee" as const,
        zones_publiees,
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
