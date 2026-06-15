import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Pharmacy, Zone } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type Draft = {
  nom: string;
  zone_id: string;
  adresse: string;
  telephone: string;
  latitude: string;
  longitude: string;
  actif: boolean;
};

const emptyDraft: Draft = {
  nom: "",
  zone_id: "",
  adresse: "",
  telephone: "",
  latitude: "",
  longitude: "",
  actif: true,
};

function toDraft(p: Pharmacy): Draft {
  return {
    nom: p.nom,
    zone_id: p.zone_id ?? "",
    adresse: p.adresse ?? "",
    telephone: p.telephone ?? "",
    latitude: p.latitude != null ? String(p.latitude) : "",
    longitude: p.longitude != null ? String(p.longitude) : "",
    actif: (p as Pharmacy & { actif?: boolean }).actif ?? true,
  };
}

function fromDraft(d: Draft) {
  return {
    nom: d.nom.trim(),
    zone_id: d.zone_id || null,
    adresse: d.adresse.trim() || null,
    telephone: d.telephone.trim() || null,
    latitude: d.latitude.trim() ? Number(d.latitude) : null,
    longitude: d.longitude.trim() ? Number(d.longitude) : null,
    actif: d.actif,
  };
}

export function AnnuaireTab({ zones }: { zones: Zone[] }) {
  const [pharmacies, setPharmacies] = useState<(Pharmacy & { actif: boolean })[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [creating, setCreating] = useState(false);
  const [newDraft, setNewDraft] = useState<Draft>(emptyDraft);
  const [saving, setSaving] = useState(false);

  const zoneName = (id: string | null) => zones.find((z) => z.id === id)?.nom ?? "—";

  async function load() {
    setLoading(true);
    setError(null);
    const { data, error } = await supabase
      .from("pharmacies")
      .select("*")
      .order("nom", { ascending: true });
    if (error) setError(error.message);
    setPharmacies((data ?? []) as (Pharmacy & { actif: boolean })[]);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  function startEdit(p: Pharmacy & { actif: boolean }) {
    setEditingId(p.id);
    setDraft(toDraft(p));
  }

  async function saveEdit() {
    if (!editingId) return;
    setSaving(true);
    setError(null);
    const { error } = await supabase
      .from("pharmacies")
      .update(fromDraft(draft))
      .eq("id", editingId);
    setSaving(false);
    if (error) {
      setError(error.message);
      return;
    }
    setEditingId(null);
    await load();
  }

  async function createPharmacy() {
    if (!newDraft.nom.trim()) {
      setError("Le nom est obligatoire.");
      return;
    }
    setSaving(true);
    setError(null);
    const { error } = await supabase.from("pharmacies").insert(fromDraft(newDraft));
    setSaving(false);
    if (error) {
      setError(error.message);
      return;
    }
    setNewDraft(emptyDraft);
    setCreating(false);
    await load();
  }

  async function toggleActif(p: Pharmacy & { actif: boolean }) {
    setError(null);
    const { error } = await supabase.from("pharmacies").update({ actif: !p.actif }).eq("id", p.id);
    if (error) {
      setError(error.message);
      return;
    }
    await load();
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold">Annuaire des pharmacies</h2>
        <Button size="sm" onClick={() => setCreating((v) => !v)}>
          {creating ? "Annuler" : "Ajouter une pharmacie"}
        </Button>
      </div>

      {error && (
        <p className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{error}</p>
      )}

      {creating && (
        <div className="space-y-3 rounded-2xl border border-border bg-card p-4 shadow-card">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="text-xs font-semibold text-muted-foreground">Nom *</label>
              <Input
                value={newDraft.nom}
                onChange={(e) => setNewDraft((d) => ({ ...d, nom: e.target.value }))}
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground">Zone</label>
              <Select
                value={newDraft.zone_id}
                onValueChange={(v) => setNewDraft((d) => ({ ...d, zone_id: v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Choisir une zone" />
                </SelectTrigger>
                <SelectContent>
                  {zones.map((z) => (
                    <SelectItem key={z.id} value={z.id}>
                      {z.nom}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground">Adresse</label>
              <Input
                value={newDraft.adresse}
                onChange={(e) => setNewDraft((d) => ({ ...d, adresse: e.target.value }))}
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground">Téléphone</label>
              <Input
                value={newDraft.telephone}
                onChange={(e) => setNewDraft((d) => ({ ...d, telephone: e.target.value }))}
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground">Latitude</label>
              <Input
                value={newDraft.latitude}
                onChange={(e) => setNewDraft((d) => ({ ...d, latitude: e.target.value }))}
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground">Longitude</label>
              <Input
                value={newDraft.longitude}
                onChange={(e) => setNewDraft((d) => ({ ...d, longitude: e.target.value }))}
              />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              checked={newDraft.actif}
              onCheckedChange={(c) => setNewDraft((d) => ({ ...d, actif: Boolean(c) }))}
            />
            <span className="text-sm">Actif</span>
          </div>
          <Button onClick={createPharmacy} disabled={saving}>
            {saving ? "Enregistrement…" : "Créer"}
          </Button>
        </div>
      )}

      {loading ? (
        <p className="text-sm text-muted-foreground">Chargement…</p>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nom</TableHead>
                <TableHead>Zone</TableHead>
                <TableHead>Adresse</TableHead>
                <TableHead>Téléphone</TableHead>
                <TableHead>Actif</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {pharmacies.map((p) =>
                editingId === p.id ? (
                  <TableRow key={p.id}>
                    <TableCell>
                      <Input
                        value={draft.nom}
                        onChange={(e) => setDraft((d) => ({ ...d, nom: e.target.value }))}
                      />
                    </TableCell>
                    <TableCell>
                      <Select
                        value={draft.zone_id}
                        onValueChange={(v) => setDraft((d) => ({ ...d, zone_id: v }))}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Zone" />
                        </SelectTrigger>
                        <SelectContent>
                          {zones.map((z) => (
                            <SelectItem key={z.id} value={z.id}>
                              {z.nom}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <Input
                        value={draft.adresse}
                        onChange={(e) => setDraft((d) => ({ ...d, adresse: e.target.value }))}
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        value={draft.telephone}
                        onChange={(e) => setDraft((d) => ({ ...d, telephone: e.target.value }))}
                      />
                    </TableCell>
                    <TableCell>
                      <Checkbox
                        checked={draft.actif}
                        onCheckedChange={(c) => setDraft((d) => ({ ...d, actif: Boolean(c) }))}
                      />
                    </TableCell>
                    <TableCell className="space-x-2 whitespace-nowrap">
                      <Button size="sm" onClick={saveEdit} disabled={saving}>
                        Enregistrer
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => setEditingId(null)}>
                        Annuler
                      </Button>
                    </TableCell>
                  </TableRow>
                ) : (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">{p.nom}</TableCell>
                    <TableCell>{zoneName(p.zone_id)}</TableCell>
                    <TableCell className="max-w-[200px] truncate">{p.adresse ?? "—"}</TableCell>
                    <TableCell>{p.telephone ?? "—"}</TableCell>
                    <TableCell>
                      <Checkbox checked={p.actif} onCheckedChange={() => toggleActif(p)} />
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      <Button size="sm" variant="outline" onClick={() => startEdit(p)}>
                        Modifier
                      </Button>
                    </TableCell>
                  </TableRow>
                ),
              )}
              {pharmacies.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-sm text-muted-foreground">
                    Aucune pharmacie dans l'annuaire.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
