import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import type { Zone } from "@/lib/db";
import { checkIsAdmin } from "@/lib/admin-api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AnnuaireTab } from "@/components/admin/AnnuaireTab";
import { PlanningTab } from "@/components/admin/PlanningTab";
import { GardeBandeau } from "@/components/admin/GardeBandeau";
import { JoursFeriesTab } from "@/components/admin/JoursFeriesTab";
import { GeocodageTab } from "@/components/admin/GeocodageTab";
import { NumerosUrgenceTab } from "@/components/admin/NumerosUrgenceTab";
import { StatsTab } from "@/components/admin/StatsTab";
import { SignalementsTab } from "@/components/admin/SignalementsTab";

export const Route = createFileRoute("/admin")({
  ssr: false,
  component: AdminPage,
});

function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) setError(error.message);
  }

  return (
    <div className="grid min-h-screen place-items-center bg-background px-4">
      <form
        onSubmit={onSubmit}
        className="w-full max-w-sm space-y-4 rounded-2xl border border-border bg-card p-6 shadow-card"
      >
        <h1 className="text-lg font-bold">PharmaGarde — Admin</h1>
        <div className="space-y-1">
          <label className="text-xs font-semibold text-muted-foreground">Email</label>
          <Input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoFocus
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-semibold text-muted-foreground">Mot de passe</label>
          <Input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>
        {error && (
          <p className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{error}</p>
        )}
        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? "Connexion…" : "Se connecter"}
        </Button>
      </form>
    </div>
  );
}

function AdminPage() {
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [zones, setZones] = useState<Zone[]>([]);
  const [activeTab, setActiveTab] = useState("planning");

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session) {
      setIsAdmin(null);
      return;
    }
    let cancelled = false;
    checkIsAdmin().then((ok) => {
      if (!cancelled) setIsAdmin(ok);
    });
    return () => {
      cancelled = true;
    };
  }, [session]);

  useEffect(() => {
    if (!isAdmin) return;
    supabase
      .from("zones")
      .select("id, nom, slug, region")
      .order("nom", { ascending: true })
      .then(({ data }) => setZones((data ?? []) as Zone[]));
  }, [isAdmin]);

  if (session === undefined) {
    return (
      <div className="grid min-h-screen place-items-center text-sm text-muted-foreground">
        Chargement…
      </div>
    );
  }

  if (!session) {
    return <LoginForm />;
  }

  if (isAdmin === null) {
    return (
      <div className="grid min-h-screen place-items-center text-sm text-muted-foreground">
        Vérification des droits…
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="grid min-h-screen place-items-center px-4 text-center">
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Ce compte n'a pas les droits administrateur.
          </p>
          <Button variant="outline" onClick={() => supabase.auth.signOut()}>
            Se déconnecter
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-bold">PharmaGarde — Admin</h1>
        <Button variant="outline" size="sm" onClick={() => supabase.auth.signOut()}>
          Se déconnecter
        </Button>
      </div>

      <GardeBandeau onGoToPlanning={() => setActiveTab("planning")} />

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="planning">Planning de la semaine</TabsTrigger>
          <TabsTrigger value="annuaire">Annuaire</TabsTrigger>
          <TabsTrigger value="feries">Jours fériés</TabsTrigger>
          <TabsTrigger value="gps">GPS</TabsTrigger>
          <TabsTrigger value="signalements">Signalements</TabsTrigger>
          <TabsTrigger value="urgences">Numéros d'urgence</TabsTrigger>
          <TabsTrigger value="stats">Statistiques</TabsTrigger>
        </TabsList>
        <TabsContent value="planning" className="mt-4">
          <PlanningTab zones={zones} />
        </TabsContent>
        <TabsContent value="annuaire" className="mt-4">
          <AnnuaireTab zones={zones} />
        </TabsContent>
        <TabsContent value="feries" className="mt-4">
          <JoursFeriesTab />
        </TabsContent>
        <TabsContent value="gps" className="mt-4">
          <GeocodageTab />
        </TabsContent>
        <TabsContent value="signalements" className="mt-4"><SignalementsTab /></TabsContent>
        <TabsContent value="urgences" className="mt-4">
          <NumerosUrgenceTab zones={zones} />
        </TabsContent>
        <TabsContent value="stats" className="mt-4">
          <StatsTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
