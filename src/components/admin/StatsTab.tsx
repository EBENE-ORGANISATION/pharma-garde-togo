import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

type Stats = {
  total: number; actifs_7j: number; actifs_30j: number;
  nouveaux_7j: number; apk: number; web: number; genere_le: string;
};

export function StatsTab() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true); setError(null);
    const { data, error } = await supabase.rpc("stats_usage");
    if (error) setError(error.message);
    else setStats(data as Stats);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  const Card = ({ label, value }: { label: string; value: number }) => (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="text-2xl font-extrabold text-primary-dark">{value ?? 0}</div>
      <div className="mt-1 text-xs font-semibold text-muted-foreground">{label}</div>
    </div>
  );

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
    </div>
  );
}
