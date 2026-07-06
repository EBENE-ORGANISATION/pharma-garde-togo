import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { majCoordsPharmacie } from "@/lib/admin-api";
import { MapPin, Check, X, ExternalLink } from "lucide-react";

type Row = {
  id: string;
  type: "position" | "ferme" | "autre";
  message: string | null;
  lat_suggeree: number | null;
  lng_suggeree: number | null;
  created_at: string;
  pharmacie_id: string;
  pharmacies: { nom: string | null; latitude: number | null; longitude: number | null } | null;
};

const TYPE_LABEL: Record<Row["type"], string> = {
  position: "Localisation incorrecte",
  ferme: "Fermée / déménagée",
  autre: "Autre info incorrecte",
};

function distanceM(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const R = 6371000;
  const dLat = ((bLat - aLat) * Math.PI) / 180;
  const dLng = ((bLng - aLng) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((aLat * Math.PI) / 180) * Math.cos((bLat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return Math.round(R * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s)));
}

function osmLink(lat: number, lng: number) {
  return `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=18/${lat}/${lng}`;
}

export function SignalementsTab() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true); setError(null);
    const { data, error } = await (supabase as any)
      .from("signalements")
      .select("id, type, message, lat_suggeree, lng_suggeree, created_at, pharmacie_id, pharmacies(nom, latitude, longitude)")
      .eq("statut", "nouveau")
      .order("created_at", { ascending: true });
    if (error) setError(error.message);
    else setRows((data ?? []) as Row[]);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  async function setStatut(id: string, statut: "traite" | "rejete") {
    const { error } = await (supabase as any).from("signalements").update({ statut }).eq("id", id);
    if (error) throw error;
  }

  async function approuverPosition(r: Row) {
    if (r.lat_suggeree == null || r.lng_suggeree == null) return;
    setBusy(r.id);
    try {
      const { error } = await majCoordsPharmacie(r.pharmacie_id, r.lat_suggeree, r.lng_suggeree);
      if (error) throw error;
      await setStatut(r.id, "traite");
      await load();
    } catch (e: any) {
      setError(e?.message ?? "Erreur");
    } finally {
      setBusy(null);
    }
  }

  async function resoudre(r: Row, statut: "traite" | "rejete") {
    setBusy(r.id);
    try {
      await setStatut(r.id, statut);
      await load();
    } catch (e: any) {
      setError(e?.message ?? "Erreur");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-bold">
          Signalements en attente {rows.length > 0 && `(${rows.length})`}
        </h3>
        <Button size="sm" variant="outline" onClick={load} disabled={loading}>
          {loading ? "…" : "Rafraîchir"}
        </Button>
      </div>

      {error && <p className="text-sm text-destructive">Erreur : {error}</p>}

      {!loading && rows.length === 0 && (
        <p className="rounded-xl border border-border bg-muted/30 p-6 text-center text-sm text-muted-foreground">
          Aucun signalement en attente. 🎉
        </p>
      )}

      <div className="space-y-3">
        {rows.map((r) => {
          const ph = r.pharmacies;
          const hasCurrent = ph?.latitude != null && ph?.longitude != null;
          const hasSuggested = r.lat_suggeree != null && r.lng_suggeree != null;
          const dist = hasCurrent && hasSuggested
            ? distanceM(ph!.latitude!, ph!.longitude!, r.lat_suggeree!, r.lng_suggeree!)
            : null;
          return (
            <div key={r.id} className="rounded-xl border border-border bg-card p-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="font-semibold">{ph?.nom ?? "Pharmacie inconnue"}</div>
                  <div className="mt-0.5 text-xs font-medium text-primary-dark">{TYPE_LABEL[r.type]}</div>
                </div>
                <div className="text-[11px] text-muted-foreground">
                  {new Date(r.created_at).toLocaleString("fr-FR")}
                </div>
              </div>

              {r.message && <p className="mt-2 text-sm text-muted-foreground">« {r.message} »</p>}

              {r.type === "position" && (
                <div className="mt-3 space-y-1.5 rounded-lg bg-muted/40 p-3 text-xs">
                  <div>
                    Position actuelle :{" "}
                    {hasCurrent ? (
                      <a className="text-primary underline" target="_blank" rel="noopener noreferrer" href={osmLink(ph!.latitude!, ph!.longitude!)}>
                        voir <ExternalLink className="inline h-3 w-3" />
                      </a>
                    ) : (
                      <span className="text-muted-foreground">aucune (à renseigner)</span>
                    )}
                  </div>
                  <div>
                    Position proposée :{" "}
                    {hasSuggested ? (
                      <a className="text-primary underline" target="_blank" rel="noopener noreferrer" href={osmLink(r.lat_suggeree!, r.lng_suggeree!)}>
                        voir sur la carte <ExternalLink className="inline h-3 w-3" />
                      </a>
                    ) : (
                      <span className="text-muted-foreground">non fournie</span>
                    )}
                  </div>
                  {dist != null && <div className="font-medium">Déplacement : {dist} m</div>}
                </div>
              )}

              <div className="mt-3 flex flex-wrap gap-2">
                {r.type === "position" && hasSuggested ? (
                  <Button size="sm" disabled={busy === r.id} onClick={() => approuverPosition(r)}>
                    <MapPin className="mr-1.5 h-4 w-4" /> Approuver la position
                  </Button>
                ) : (
                  <Button size="sm" disabled={busy === r.id} onClick={() => resoudre(r, "traite")}>
                    <Check className="mr-1.5 h-4 w-4" /> Marquer traité
                  </Button>
                )}
                <Button size="sm" variant="outline" disabled={busy === r.id} onClick={() => resoudre(r, "rejete")}>
                  <X className="mr-1.5 h-4 w-4" /> Rejeter
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
