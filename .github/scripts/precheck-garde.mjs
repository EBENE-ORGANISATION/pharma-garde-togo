#!/usr/bin/env node
// Pré-contrôle déterministe du pipeline de garde, SANS Claude.
//
// Pourquoi : le superviseur Claude (claude -p) consomme le quota de l'abonnement.
// On ne le lance donc que s'il y a réellement quelque chose à analyser. Si les
// 24 dernières heures sont vertes (et que ce n'est pas dimanche), on s'arrête ici.
// Dans le doute (API injoignable, réponse vide, donnée manquante), on lance Claude.
//
// Sortie GitHub Actions : analyse=true | analyse=false (fichier $GITHUB_OUTPUT).
// Les règles reprennent les conditions a–e de .github/routine-superviseur.md.
import { appendFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

const RUNS_ATTENDUS_24H = 4; // a. MANQUANT  : 6h, 12h, 16h, 20h
const SEUIL_INCONNUES = 3; // c. SEUIL FRÔLÉ : nb_inconnues entre 3 et 5
const VARIATION_MAX = 0.3; // d. TENDANCE : variation > 30 % de nb_importees
const HAUSSE_INCONNUES = 2; // d. TENDANCE : nb_inconnues en hausse (24h vs plancher 7 j)

const num = (x) => (typeof x === "number" && Number.isFinite(x) ? x : 0);

/** Retourne "ok" si tout est vert, sinon la raison (texte court) qui justifie l'analyse par Claude. */
export function verdict(runs, maintenant = Date.now()) {
  const depuis24h = maintenant - 24 * 3600e3;
  const recents = runs.filter((r) => Date.parse(r.run_at) >= depuis24h);

  if (recents.length < RUNS_ATTENDUS_24H) {
    return `moins de ${RUNS_ATTENDUS_24H} exécutions sur 24h (${recents.length})`;
  }
  const anormaux = [...new Set(recents.filter((r) => r.statut !== "publiee").map((r) => r.statut))];
  if (anormaux.length) return `statut anormal sur 24h : ${anormaux.join(", ")}`;
  if (recents.some((r) => num(r.nb_inconnues) >= SEUIL_INCONNUES)) {
    return `nb_inconnues >= ${SEUIL_INCONNUES} sur 24h`;
  }

  // Tendance sur 7 jours, uniquement sur les runs publiés (une vieille erreur ne
  // doit pas relancer Claude tous les jours pendant une semaine).
  const publies = runs.filter((r) => r.statut === "publiee");
  const importees = publies.map((r) => num(r.nb_importees));
  const min = Math.min(...importees);
  const max = Math.max(...importees);
  if (min <= 0) return "nb_importees nul ou absent sur 7 jours";
  if (max / min - 1 > VARIATION_MAX) {
    return `variation de nb_importees > ${VARIATION_MAX * 100} % sur 7 jours (${min} → ${max})`;
  }
  const plancherInconnues = Math.min(...publies.map((r) => num(r.nb_inconnues)));
  const picInconnues24h = Math.max(...recents.map((r) => num(r.nb_inconnues)));
  if (picInconnues24h - plancherInconnues >= HAUSSE_INCONNUES) {
    return `nb_inconnues en hausse sur 7 jours (${plancherInconnues} → ${picInconnues24h})`;
  }
  return "ok";
}

function sortie(analyse, raison) {
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `analyse=${analyse}\n`);
  console.log(
    analyse
      ? `→ superviseur Claude requis : ${raison}`
      : `✓ ${raison} — superviseur Claude non lancé`,
  );
}

async function main() {
  if (new Date().getUTCDay() === 0) return sortie(true, "dimanche, bilan hebdomadaire");

  const { SUPABASE_URL, SUPABASE_READONLY_KEY } = process.env;
  if (!SUPABASE_URL || !SUPABASE_READONLY_KEY) return sortie(true, "secrets Supabase absents");

  const depuis7j = new Date(Date.now() - 7 * 86400e3).toISOString();
  const url =
    `${SUPABASE_URL}/rest/v1/garde_runs` +
    `?select=run_at,statut,nb_importees,nb_inconnues&run_at=gte.${depuis7j}&order=run_at.desc&limit=200`;

  let runs;
  try {
    const rep = await fetch(url, {
      headers: { apikey: SUPABASE_READONLY_KEY, Authorization: `Bearer ${SUPABASE_READONLY_KEY}` },
      signal: AbortSignal.timeout(30_000),
    });
    if (!rep.ok) return sortie(true, `garde_runs injoignable (HTTP ${rep.status})`);
    runs = await rep.json();
  } catch (e) {
    return sortie(true, `garde_runs injoignable (${e instanceof Error ? e.message : String(e)})`);
  }
  if (!Array.isArray(runs) || runs.length === 0)
    return sortie(true, "garde_runs vide ou réponse invalide");

  const v = verdict(runs);
  sortie(v !== "ok", v === "ok" ? `tout est vert (${runs.length} exécutions sur 7 jours)` : v);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((e) => {
    // Erreur imprévue du script : on laisse Claude analyser plutôt que de rater une anomalie.
    sortie(true, `pré-contrôle en erreur (${e instanceof Error ? e.message : String(e)})`);
  });
}
