import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

type Stats = {
  total: number; actifs_7j: number; actifs_30j: number;
  nouveaux_7j: number; apk: number; web: number; genere_le: string;
};

type Marketing = {
  appels_7j: number; appels_30j: number;
  itineraires_7j: number; itineraires_30j: number;
  urgences_30j: number; recherches_30j: number;
  utiles_30j: number; actifs_30j: number;
  arrivees_30j: Record<string, number>;
  nouveaux_par_source_30j: Record<string, number>;
};

export function StatsTab() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [mkt, setMkt] = useState<Marketing | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true); setError(null);
    const [usage, marketing] = await Promise.all([
      supabase.rpc("stats_usage"),
      supabase.rpc("stats_marketing"),
    ]);
    if (usage.error) setError(usage.error.message);
    else setStats(usage.data as Stats);
    // Absent tant que la migration 20261025_mesure_marketing n'est pas appliquée.
    setMkt(marketing.error ? null : (marketing.data as Marketing));
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  const Card = ({ label, value }: { label: string; value: number }) => (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="text-2xl font-extrabold text-primary-dark">{value ?? 0}</div>
      <div className="mt-1 text-xs font-semibold text-muted-foreground">{label}</div>
    </div>
  );

  const SourceList = ({ title, data }: { title: string; data: Record<string, number> }) => {
    const rows = Object.entries(data ?? {}).sort((a, b) => b[1] - a[1]);
    return (
      <div className="rounded-xl border border-border bg-card p-4">
        <div className="text-xs font-semibold text-muted-foreground">{title}</div>
        {rows.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">Aucune donnée pour l'instant.</p>
        ) : (
          <ul className="mt-2 space-y-1 text-sm">
            {rows.map(([k, n]) => (
              <li key={k} className="flex justify-between gap-3">
                <span className="truncate">{k}</span>
                <span className="font-bold">{n}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-bold">Utilisateurs (anonyme)</h3>
        <Button size="sm" variant="outline" onClick={load} disabled={loading}>
          {loading ? "…" : "Rafraîchir"}
        </Button>
      </div>
      {error && <p className="text-sm text-destructive">Erreur : {error}</p>}
      {stats && (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <Card label="Utilisateurs (total)" value={stats.total} />
            <Card label="Actifs (7 jours)" value={stats.actifs_7j} />
            <Card label="Actifs (30 jours)" value={stats.actifs_30j} />
            <Card label="Nouveaux (7 jours)" value={stats.nouveaux_7j} />
            <Card label="Sur APK (Android)" value={stats.apk} />
            <Card label="Sur le Web (PWA)" value={stats.web} />
          </div>
          <p className="text-xs text-muted-foreground">
            Données anonymes. Mis à jour le {new Date(stats.genere_le).toLocaleString("fr-FR")}.
          </p>
        </>
      )}
      {mkt && (
        <>
          <h3 className="pt-2 text-base font-bold">Usage utile</h3>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <Card label="Appels (7 jours)" value={mkt.appels_7j} />
            <Card label="Itinéraires (7 jours)" value={mkt.itineraires_7j} />
            <Card label="Appels (30 jours)" value={mkt.appels_30j} />
            <Card label="Itinéraires (30 jours)" value={mkt.itineraires_30j} />
            <Card label="Appels urgences (30 jours)" value={mkt.urgences_30j} />
            <Card label="Recherches médicaments (30 jours)" value={mkt.recherches_30j} />
          </div>
          <p className="text-sm">
            <span className="font-bold">
              {mkt.actifs_30j > 0 ? Math.round((mkt.utiles_30j / mkt.actifs_30j) * 100) : 0} %
            </span>{" "}
            des actifs sur 30 jours ont appelé ou lancé un itinéraire ({mkt.utiles_30j}/{mkt.actifs_30j}).
          </p>
          <SourceList title="Nouveaux par origine (30 jours)" data={mkt.nouveaux_par_source_30j} />
          <SourceList title="Arrivées par lien marqué (30 jours)" data={mkt.arrivees_30j} />
        </>
      )}
    </div>
  );
}
