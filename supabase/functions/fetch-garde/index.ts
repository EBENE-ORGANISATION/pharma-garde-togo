// Edge Function : fetch-garde
// Récupère le planning de garde de la semaine courante depuis l'API de l'Ordre
// National des Pharmaciens du Togo (ONPT), l'importe via importer_garde(),
// évalue les garde-fous, puis publie via publier_garde_auto() si les seuils
// sont respectés. Envoie une alerte e-mail (Resend) si une semaine ne peut PAS
// être publiée automatiquement.
//
// Journalisation : à CHAQUE passage, une ligne est écrite dans la table
// garde_runs (statut, nb_importees, nb_inconnues, semaine_publiee, erreur) —
// c'est la source de données de la routine superviseur quotidienne.
//
// Déclenchement : cron planifié (0 6,12,16,20 * * *) ou appel manuel HTTP.
// Méthode : GET (pas de corps attendu).
//
// Variables d'environnement :
//   SUPABASE_URL              (auto) URL du projet
//   SUPABASE_SERVICE_ROLE_KEY (auto) clé service_role (bypasse RLS)
//   RESEND_API_KEY            (secret) clé API Resend pour les alertes e-mail
//   ALERT_EMAIL               (secret) adresse destinataire des alertes

import { createClient } from "jsr:@supabase/supabase-js@2";

const ONPT_API =
  "https://www.pharmaciens.tg/api/pharmacies-de-gardes" +
  "?populate[pharmacies][populate][pharmacie][populate][adresse]=true" +
  "&populate[pharmacies][populate][pharmacie][populate][zone]=true" +
  "&pagination[page]=1&pagination[pageSize]=500";

// Garde-fous de publication automatique.
const MIN_PHARMACIES = 25; // slugs extraits minimum attendus de l'API
const MAX_INCONNUS   = 5;  // slugs absents de notre annuaire tolérés

Deno.serve(async (_req: Request): Promise<Response> => {
  const today = new Date().toISOString().slice(0, 10); // "YYYY-MM-DD"

  // Client Supabase créé tôt : nécessaire pour journaliser TOUS les cas,
  // y compris les échecs précoces (API injoignable, aucune donnée).
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const supabase =
    supabaseUrl && serviceKey
      ? createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } })
      : null;

  // Écrit une ligne dans garde_runs. Ne casse jamais le cron si ça échoue.
  async function journaliser(row: {
    statut: string;
    nb_importees?: number | null;
    nb_inconnues?: number | null;
    semaine_publiee?: string | null;
    erreur?: string | null;
  }): Promise<void> {
    if (!supabase) return;
    try {
      await supabase.from("garde_runs").insert({
        statut:          row.statut,
        nb_importees:    row.nb_importees ?? null,
        nb_inconnues:    row.nb_inconnues ?? null,
        semaine_publiee: row.semaine_publiee ?? null,
        erreur:          row.erreur ?? null,
      });
    } catch (e) {
      console.error(
        `[fetch-garde] journalisation garde_runs échouée : ${e instanceof Error ? e.message : String(e)}`,
      );
    }
  }

  try {
    if (!supabase) {
      await envoyerAlerte(
        "⚠️ PharmaGarde — Configuration Edge Function incomplète",
        "Les variables SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY sont manquantes.",
      );
      return json(
        { ok: false, error: "Variables SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY manquantes." },
        500,
      );
    }

    const apiUrl =
      `${ONPT_API}&filters[a][$gte]=${today}&filters[de][$lte]=${today}`;

    const apiResp = await fetch(apiUrl, {
      headers: { "User-Agent": "pharma-garde-togo-edge/1.0" },
    });

    if (!apiResp.ok) {
      await journaliser({
        statut: "erreur",
        erreur: `API ONPT a répondu ${apiResp.status} ${apiResp.statusText}`,
      });
      await envoyerAlerte(
        "⚠️ PharmaGarde — API ONPT injoignable",
        `Le cron garde du ${today} n'a pas pu récupérer le planning.\n\n` +
          `Réponse API : ${apiResp.status} ${apiResp.statusText}\nURL : ${apiUrl}`,
      );
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
      await journaliser({ statut: "rien" });
      await envoyerAlerte(
        "⚠️ PharmaGarde — Aucun planning de garde trouvé",
        `Le cron garde du ${today} n'a trouvé aucun planning de garde.\n\n` +
          `À vérifier sur pharmaciens.tg ; publie manuellement depuis /admin si nécessaire.`,
      );
      return json({
        ok: true,
        today,
        message: "Aucun planning de garde trouvé pour cette date.",
        semaines: [],
      });
    }

    const resultats = [];

    for (const semaine of semaines as Record<string, unknown>[]) {
      const pDe = semaine.de as string;
      const pA  = semaine.a  as string;

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

      const row            = Array.isArray(importData) ? importData[0] : importData;
      const inserees       = (row?.inserees       ?? 0) as number;
      const deja_publiees  = (row?.deja_publiees  ?? 0) as number;
      const slugs_inconnus = (row?.slugs_inconnus ?? []) as string[];

      console.log(
        `[fetch-garde] ${pDe}→${pA} : importé — ` +
        `${slugs.length} slugs extraits, ${inserees} insérées, ` +
        `${deja_publiees} déjà publiées, ${slugs_inconnus.length} inconnu(s).`,
      );

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

      // Aligner la liste publiée sur la source : retirer les pharmacies qui ne
      // sont plus dans la liste de l'Ordre (sûr : on est déjà après les garde-fous).
      const { error: cleanError } = await supabase.rpc("depublier_garde_absents", {
        p_de:    pDe,
        p_a:     pA,
        p_slugs: slugs,
      });
      if (cleanError) {
        console.error(`[fetch-garde] ${pDe}→${pA} : erreur depublier_garde_absents — ${cleanError.message}`);
        resultats.push({
          de:             pDe,
          a:              pA,
          slugs_extraits: slugs.length,
          inserees,
          deja_publiees,
          slugs_inconnus,
          decision:       "bloquee" as const,
          raison:         `erreur lors de l'alignement : ${cleanError.message}`,
        });
        continue;
      }

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

    // Alerte e-mail si une semaine n'a PAS pu être publiée automatiquement.
    const hasError = resultats.some((r) => "error" in r);

    const problemes = resultats.filter(
      (r) => "error" in r || (r as Record<string, unknown>).decision === "bloquee",
    );

    if (problemes.length > 0) {
      const lignes = problemes
        .map((r) => {
          const o = r as Record<string, unknown>;
          const motif = "error" in o ? `erreur : ${o.error}` : `${o.raison}`;
          const inconnus =
            Array.isArray(o.slugs_inconnus) && o.slugs_inconnus.length > 0
              ? `\n    Slugs inconnus : ${(o.slugs_inconnus as string[]).join(", ")}`
              : "";
          return `• Semaine ${o.de} → ${o.a}\n    ${motif}${inconnus}`;
        })
        .join("\n\n");

      await envoyerAlerte(
        "⚠️ PharmaGarde — Publication garde NON automatique",
        `Le cron garde du ${today} n'a pas pu tout publier automatiquement.\n\n` +
          `${lignes}\n\n` +
          `Action : vérifie le planning sur pharmaciens.tg et publie manuellement depuis /admin.`,
      );
    }

    // Journalise le résumé de ce passage dans garde_runs (une ligne par run).
    const r0 = resultats[0] as Record<string, unknown> | undefined;
    let statutRun = "publiee";
    if (resultats.some((r) => "error" in r)) {
      statutRun = "erreur";
    } else if (resultats.some((r) => (r as Record<string, unknown>).decision === "bloquee")) {
      statutRun = "bloquee";
    }
    const erreurRun =
      statutRun === "erreur"
        ? String((resultats.find((r) => "error" in r) as Record<string, unknown> | undefined)?.error ?? "")
        : statutRun === "bloquee"
          ? String(
              (resultats.find((r) => (r as Record<string, unknown>).decision === "bloquee") as
                | Record<string, unknown>
                | undefined)?.raison ?? "",
            )
          : null;
    const inconnusRun = Array.isArray(r0?.slugs_inconnus)
      ? (r0!.slugs_inconnus as string[]).length
      : null;
    await journaliser({
      statut:          statutRun,
      nb_importees:    (r0?.slugs_extraits as number | undefined) ?? null,
      nb_inconnues:    inconnusRun,
      semaine_publiee: r0 ? `${r0.de} → ${r0.a}` : null,
      erreur:          erreurRun,
    });

    return json({
      ok:       !hasError,
      today,
      semaines: resultats,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await journaliser({ statut: "erreur", erreur: message });
    await envoyerAlerte(
      "⚠️ PharmaGarde — Erreur inattendue du cron garde",
      `Le cron garde a échoué avec une erreur inattendue :\n\n${message}`,
    );
    return json({ ok: false, error: message }, 500);
  }
});

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
}

// Envoie un e-mail d'alerte via Resend. Silencieux/sans crash si la config est
// absente ou si Resend échoue (une alerte ne doit jamais casser le cron).
async function envoyerAlerte(sujet: string, corps: string): Promise<void> {
  const resendKey = Deno.env.get("RESEND_API_KEY");
  const dest      = Deno.env.get("ALERT_EMAIL");

  if (!resendKey || !dest) {
    console.warn("[fetch-garde] RESEND_API_KEY ou ALERT_EMAIL absent — alerte non envoyée.");
    return;
  }

  try {
    const resp = await fetch("https://api.resend.com/emails", {
      method:  "POST",
      headers: {
        "Authorization": `Bearer ${resendKey}`,
        "Content-Type":  "application/json",
      },
      body: JSON.stringify({
        from:    "PharmaGarde <onboarding@resend.dev>",
        to:      [dest],
        subject: sujet,
        text:    corps,
      }),
    });

    if (!resp.ok) {
      console.error(`[fetch-garde] Resend a répondu ${resp.status} : ${await resp.text()}`);
    } else {
      console.log(`[fetch-garde] Alerte e-mail envoyée à ${dest}.`);
    }
  } catch (e) {
    console.error(`[fetch-garde] Échec envoi alerte : ${e instanceof Error ? e.message : String(e)}`);
  }
}
