import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

type Etat = "chargement" | "aucune" | "brouillon" | "publiee";

interface Props {
  onGoToPlanning: () => void;
}

export function GardeBandeau({ onGoToPlanning }: Props) {
  const [etat, setEtat] = useState<Etat>("chargement");
  const [nbPubliees, setNbPubliees] = useState(0);

  useEffect(() => {
    const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
    supabase
      .from("planning_garde")
      .select("statut, date_debut")
      .lte("date_debut", today)
      .gte("date_fin", today)
      .then(({ data }) => {
        const all = (data ?? []) as { statut: string; date_debut: string }[];
        if (all.length === 0) {
          setEtat("aucune");
          return;
        }
        // Ne garder que la semaine en cours (la plus récente) pour éviter un
        // faux "non publiée" les jours de chevauchement entre deux semaines.
        const maxDebut = all.reduce((m, r) => (r.date_debut > m ? r.date_debut : m), all[0].date_debut);
        const rows = all.filter((r) => r.date_debut === maxDebut);
        const hasBrouillon = rows.some((r) => r.statut === "brouillon");
        if (hasBrouillon) {
          setEtat("brouillon");
        } else {
          setEtat("publiee");
          setNbPubliees(rows.length);
        }
      });
  }, []);

  if (etat === "chargement") return null;

  if (etat === "aucune") {
    return (
      <div className="mb-4 flex items-center gap-2 rounded-lg border border-orange-200 bg-orange-50 px-4 py-2.5 text-sm text-orange-800">
        <span aria-hidden>⚠️</span>
        <span>Aucune garde importée cette semaine.</span>
      </div>
    );
  }

  if (etat === "brouillon") {
    return (
      <div className="mb-4 flex items-center justify-between gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-800">
        <span>
          <span aria-hidden className="mr-1">⚠️</span>
          Garde de la semaine importée mais <strong>NON publiée</strong> — vérification requise.
        </span>
        <button
          onClick={onGoToPlanning}
          className="shrink-0 rounded-md bg-red-100 px-3 py-1 text-xs font-semibold hover:bg-red-200"
        >
          Voir le planning
        </button>
      </div>
    );
  }

  // etat === "publiee"
  return (
    <div className="mb-4 flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 px-4 py-2.5 text-sm text-green-800">
      <span aria-hidden>✓</span>
      <span>
        Garde de la semaine publiée ({nbPubliees} pharmacie{nbPubliees > 1 ? "s" : ""}).
      </span>
    </div>
  );
}
