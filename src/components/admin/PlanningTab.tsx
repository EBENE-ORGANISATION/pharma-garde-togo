import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Pharmacy, Zone } from "@/lib/db";
import { publishZone } from "@/lib/admin-api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

type PlanningRow = {
  pharmacie_id: string;
  date_debut: string;
  date_fin: string;
  statut: string;
  source: string | null;
};

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}
function plusDaysISO(days: number) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export function PlanningTab({ zones }: { zones: Zone[] }) {
  const [zoneId, setZoneId] = useState(zones[0]?.id ?? "");
  const [pharmacies, setPharmacies] = useState<Pharmacy[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [dateDebut, setDateDebut] = useState(todayISO());
  const [dateFin, setDateFin] = useState(plusDaysISO(7));
  const [currentStatut, setCurrentStatut] = useState<string | null>(null);
  const [currentSource, setCurrentSource] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState<"brouillon" | "publie" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const autoManaged = currentSource === "api-onpt";

  useEffect(() => {
    if (zones.length > 0 && !zoneId) setZoneId(zones[0].id);
  }, [zones, zoneId]);

  useEffect(() => {
    if (!zoneId) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    setSuccess(null);
    (async () => {
      const today = todayISO();
      const [{ data: pharms, error: pharmsError }, { data: planning, error: planningError }] =
        await Promise.all([
          supabase
            .from("pharmacies")
            .select("*")
            .eq("zone_id", zoneId)
            .eq("actif", true)
            .order("nom", { ascending: true }),
          supabase
            .from("planning_garde")
            .select("pharmacie_id, date_debut, date_fin, statut, source")
            .eq("zone_id", zoneId)
            .lte("date_debut", today)
            .gte("date_fin", today),
        ]);
      if (cancelled) return;
      if (pharmsError) setError(pharmsError.message);
      else if (planningError) setError(planningError.message);

      setPharmacies((pharms ?? []) as Pharmacy[]);

      // On ne garde que la semaine de garde EN COURS (la plus récente couvrant aujourd'hui).
      const allRows = (planning ?? []) as PlanningRow[];
      let rows = allRows;
      if (allRows.length > 0) {
        const maxDebut = allRows.reduce(
          (m, r) => (r.date_debut > m ? r.date_debut : m),
          allRows[0].date_debut,
        );
        rows = allRows.filter((r) => r.date_debut === maxDebut);
      }

      setSelected(new Set(rows.map((r) => r.pharmacie_id)));
      if (rows.length > 0) {
        setDateDebut(rows[0].date_debut.slice(0, 10));
        setDateFin(rows[0].date_fin.slice(0, 10));
        setCurrentStatut(rows[0].statut);
        setCurrentSource(rows[0].source ?? null);
      } else {
        setDateDebut(todayISO());
        setDateFin(plusDaysISO(7));
        setCurrentStatut(null);
        setCurrentSource(null);
      }
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [zoneId]);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function save(statut: "brouillon" | "publie") {
    if (!zoneId || autoManaged) return;
    setSaving(statut);
    setError(null);
    setSuccess(null);

    // Suppression LIMITÉE à la semaine affichée (ne touche plus les autres semaines).
    const { error: deleteError } = await supabase
      .from("planning_garde")
      .delete()
      .eq("zone_id", zoneId)
      .eq("date_debut", dateDebut)
      .eq("date_fin", dateFin);
    if (deleteError) {
      setError(deleteError.message);
      setSaving(null);
      return;
    }

    if (selected.size > 0) {
      const rows = Array.from(selected).map((pharmacie_id) => ({
        pharmacie_id,
        zone_id: zoneId,
        date_debut: dateDebut,
        date_fin: dateFin,
        statut,
        source: "admin",
      }));
      const { error: insertError } = await supabase.from("planning_garde").insert(rows);
      if (insertError) {
        setError(insertError.message);
        setSaving(null);
        return;
      }
    }

    setCurrentStatut(selected.size > 0 ? statut : null);
    setCurrentSource(selected.size > 0 ? "admin" : null);

    if (statut === "publie") {
      const { data, error: publishError } = await publishZone(zoneId);
      if (publishError) {
        setError(`Planning enregistré, mais la publication a échoué : ${publishError.message}`);
        setSaving(null);
        return;
      }
      setSuccess(
        `Zone publiée (version ${data?.version ?? "?"}, ${
          data?.published_at ? new Date(data.published_at).toLocaleString("fr-FR") : ""
        }).`,
      );
    } else {
      setSuccess("Brouillon enregistré.");
    }
    setSaving(null);
  }

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-bold">Planning de garde de la semaine</h2>

      <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs leading-snug text-amber-900">
        <strong>La garde est publiée automatiquement</strong> depuis la liste de l'Ordre, plusieurs fois par jour.
        Cet onglet est un <strong>secours manuel</strong> : ne l'utilise que pour une zone/semaine non couverte
        par l'Ordre. Une modification manuelle remplace la garde <strong>de la semaine affichée</strong> uniquement.
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div>
          <label className="text-xs font-semibold text-muted-foreground">Zone</label>
          <Select value={zoneId} onValueChange={setZoneId}>
            <SelectTrigger><SelectValue placeholder="Choisir une zone" /></SelectTrigger>
            <SelectContent>
              {zones.map((z) => (
                <SelectItem key={z.id} value={z.id}>{z.nom}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="text-xs font-semibold text-muted-foreground">Début</label>
          <Input type="date" value={dateDebut} onChange={(e) => setDateDebut(e.target.value)} disabled={autoManaged} />
        </div>
        <div>
          <label className="text-xs font-semibold text-muted-foreground">Fin</label>
          <Input type="date" value={dateFin} onChange={(e) => setDateFin(e.target.value)} disabled={autoManaged} />
        </div>
      </div>

      {autoManaged && (
        <p className="rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-800">
          ✅ Cette zone est <strong>gérée automatiquement</strong> par l'Ordre pour la semaine en cours
          ({dateDebut} → {dateFin}). L'édition manuelle est désactivée pour ne pas écraser la garde officielle.
        </p>
      )}

      {currentStatut && !autoManaged && (
        <p className="text-xs text-muted-foreground">
          Statut actuel enregistré pour cette zone : <strong>{currentStatut}</strong>
        </p>
      )}
      {error && <p className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}
      {success && <p className="rounded-lg bg-primary-soft p-3 text-sm text-primary-dark">{success}</p>}

      {loading ? (
        <p className="text-sm text-muted-foreground">Chargement…</p>
      ) : (
        <ul className="space-y-2">
          {pharmacies.map((p) => (
            <li key={p.id} className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3 shadow-card">
              <Checkbox checked={selected.has(p.id)} onCheckedChange={() => toggle(p.id)} disabled={autoManaged} />
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-bold">{p.nom}</div>
                {p.adresse && <div className="truncate text-xs text-muted-foreground">{p.adresse}</div>}
              </div>
            </li>
          ))}
          {pharmacies.length === 0 && (
            <li className="rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
              Aucune pharmacie active dans cette zone.
            </li>
          )}
        </ul>
      )}

      <div className="flex flex-wrap gap-2">
        <Button variant="outline" onClick={() => save("brouillon")} disabled={saving !== null || autoManaged}>
          {saving === "brouillon" ? "Enregistrement…" : "Enregistrer le brouillon"}
        </Button>
        <Button onClick={() => save("publie")} disabled={saving !== null || autoManaged}>
          {saving === "publie" ? "Publication…" : "Publier la semaine"}
        </Button>
      </div>
    </div>
  );
}
