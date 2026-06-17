import { useEffect, useState } from "react";
import { useJoursFeries } from "@/lib/supabase-hooks";

// Togo = UTC+0 toute l'année (pas de DST, pas de décalage).
// Toutes les comparaisons utilisent les méthodes UTC de Date.

export type ModeOuverture = "jour" | "garde";

function toDateStr(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const j = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${j}`;
}

/**
 * Retourne le mode d'ouverture des pharmacies ordinaires au moment `now`.
 *
 * Règles (heure Togo = UTC) :
 *   Dimanche             → "garde"
 *   Jour férié           → "garde"
 *   Samedi 07h30–13h00  → "jour", sinon "garde"
 *   Lun–ven 07h30–19h00 → "jour", sinon "garde"
 */
export function modeOuverture(
  now: Date,
  joursFeries: Set<string> = new Set(),
): ModeOuverture {
  const dow = now.getUTCDay(); // 0=dim, 1=lun … 6=sam
  const minutes = now.getUTCHours() * 60 + now.getUTCMinutes();

  if (dow === 0) return "garde";

  if (joursFeries.has(toDateStr(now))) return "garde";

  if (dow === 6) {
    return minutes >= 7 * 60 + 30 && minutes < 13 * 60 ? "jour" : "garde";
  }

  // lun–ven
  return minutes >= 7 * 60 + 30 && minutes < 19 * 60 ? "jour" : "garde";
}

/**
 * Libellé court destiné à l'UI indiquant l'état courant.
 *
 * Exemples :
 *   "Ouvertes jusqu'à 19h"   (lundi, 14h)
 *   "Ouvertes jusqu'à 13h"   (samedi, 10h)
 *   "Pharmacies de garde"    (dimanche, nuit, jour férié…)
 */
export function prochainChangement(
  now: Date,
  joursFeries: Set<string> = new Set(),
): string {
  const mode = modeOuverture(now, joursFeries);
  if (mode === "jour") {
    const closeH = now.getUTCDay() === 6 ? 13 : 19;
    return `Ouvertes jusqu'à ${closeH}h`;
  }
  return "Pharmacies de garde";
}

/**
 * Hook React : retourne le mode courant et son libellé.
 * Intègre les jours fériés (via useJoursFeries) et se réévalue toutes les minutes.
 * Signature publique inchangée : () => { mode, libelle }.
 */
export function useModeOuverture() {
  const joursFeries = useJoursFeries();

  const [state, setState] = useState(() => {
    const now = new Date();
    return { mode: modeOuverture(now), libelle: prochainChangement(now) };
  });

  useEffect(() => {
    // Réévalue immédiatement avec les fériés chargés, puis toutes les minutes.
    // L'effet se relance quand joursFeries change (cache puis réseau) afin que
    // l'intervalle ait toujours le Set à jour sans closure périmée.
    const tick = () => {
      const now = new Date();
      setState({ mode: modeOuverture(now, joursFeries), libelle: prochainChangement(now, joursFeries) });
    };
    tick();
    const id = setInterval(tick, 60_000);
    return () => clearInterval(id);
  }, [joursFeries]);

  return state as { mode: ModeOuverture; libelle: string };
}
