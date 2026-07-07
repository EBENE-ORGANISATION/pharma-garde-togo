import { useEffect, useState } from "react";
import { useJoursFeries } from "@/lib/supabase-hooks";
import { useLang } from "@/lib/i18n";

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
 *   Samedi 07h00–13h00  → "jour", sinon "garde"
 *   Lun–ven 07h00–20h00 → "jour", sinon "garde"
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
    return minutes >= 7 * 60 && minutes < 13 * 60 ? "jour" : "garde";
  }

  // lun–ven
  return minutes >= 7 * 60 && minutes < 20 * 60 ? "jour" : "garde";
}

/** Heure de fermeture du jour : 13h le samedi, 20h en semaine. */
function heureFermeture(now: Date): number {
  return now.getUTCDay() === 6 ? 13 : 20;
}

/**
 * Hook React : retourne le mode courant et son libellé (traduit FR/EN).
 * Intègre les jours fériés (via useJoursFeries) et se réévalue toutes les minutes.
 * Signature publique inchangée : () => { mode, libelle }.
 */
export function useModeOuverture() {
  const joursFeries = useJoursFeries();
  const { t } = useLang();

  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);

  const mode = modeOuverture(now, joursFeries);
  const libelle =
    mode === "jour"
      ? `${t("mode_open_until")} ${heureFermeture(now)}h`
      : t("on_duty");

  return { mode, libelle } as { mode: ModeOuverture; libelle: string };
}
