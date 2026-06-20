import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  type NumeroUrgence,
  listNumerosUrgence,
  addNumeroUrgence,
  updateNumeroUrgence,
  deleteNumeroUrgence,
} from "@/lib/admin-api";
import type { Zone } from "@/lib/db";

type Draft = { libelle: string; numero: string; ordre: number; zone_id: string | null; actif: boolean };
const emptyDraft: Draft = { libelle: "", numero: "", ordre: 0, zone_id: null, actif: true };

export function NumerosUrgenceTab({ zones }: { zones: Zone[] }) {
  const [items, setItems] = useState<NumeroUrgence[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [creating, setCreating] = useState(false);
  const [newDraft, setNewDraft] = useState<Draft>(emptyDraft);
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    setError(null);
    const { data, error } = await listNumerosUrgence();
    if (error) setError(error.message);
    setItems((data ?? []) as NumeroUrgence[]);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  function zoneName(zoneId: string | null) {
    if (!zoneId) return "National";
    return zones.find((z) => z.id === zoneId)?.nom ?? zoneId;
  }

  function startEdit(n: NumeroUrgence) {
    setEditingId(n.id);
    setDraft({ libelle: n.libelle, numero: n.numero, ordre: n.ordre, zone_id: n.zone_id, actif: n.actif });
  }

  async function saveEdit() {
    if (!editingId) return;
    setSaving(true);
    setError(null);
    const { error } = await updateNumeroUrgence(editingId, draft);
    setSaving(false);
    if (error) { setError(error.message); return; }
    setEditingId(null);
    await load();
  }

  async function create() {
    if (!newDraft.libelle.trim()) { setError("Le libellé est obligatoire."); return; }
    if (!newDraft.numero.trim()) { setError("Le numéro est obligatoire."); return; }
    setSaving(true);
    setError(null);
    const { error } = await addNumeroUrgence(newDraft.libelle.trim(), newDraft.numero.trim(), newDraft.ordre, newDraft.zone_id, newDraft.actif);
    setSaving(false);
    if (error) { setError(error.message); return; }
    setNewDraft(emptyDraft);
    setCreating(false);
    await load();
  }

  async function remove(n: NumeroUrgence) {
    if (!window.confirm(`Supprimer « ${n.libelle} » (${n.numero}) ?`)) return;
    setError(null);
    const { error } = await deleteNumeroUrgence(n.id);
    if (error) { setError(error.message); return; }
    await load();
  }

  function ZoneSelect({ value, onChange }: { value: string | null; onChange: (v: string | null) => void }) {
    return (
      <select
        className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value || null)}
      >
        <option value="">National (toutes zones)</option>
        {zones.map((z) => (
          <option key={z.id} value={z.id}>{z.nom}</option>
        ))}
      </select>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold">Numéros d'urgence</h2>
        <Button size="sm" onClick={() => { setCreating((v) => !v); setError(null); }}>
          {creating ? "Annuler" : "Ajouter un numéro"}
        </Button>
      </div>

      {error && (
        <p className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{error}</p>
      )}

      {creating && (
        <div className="space-y-3 rounded-2xl border border-border bg-card p-4 shadow-card">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="text-xs font-semibold text-muted-foreground">Libellé *</label>
              <Input
                value={newDraft.libelle}
                placeholder="Ex. SAMU"
                onChange={(e) => setNewDraft((d) => ({ ...d, libelle: e.target.value }))}
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground">Numéro *</label>
              <Input
                value={newDraft.numero}
                placeholder="Ex. 115"
                onChange={(e) => setNewDraft((d) => ({ ...d, numero: e.target.value }))}
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground">Ordre</label>
              <Input
                type="number"
                value={newDraft.ordre}
                onChange={(e) => setNewDraft((d) => ({ ...d, ordre: Number(e.target.value) }))}
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground">Zone</label>
              <ZoneSelect value={newDraft.zone_id} onChange={(v) => setNewDraft((d) => ({ ...d, zone_id: v }))} />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              checked={newDraft.actif}
              onCheckedChange={(c) => setNewDraft((d) => ({ ...d, actif: Boolean(c) }))}
            />
            <span className="text-sm">Actif</span>
          </div>
          <Button onClick={create} disabled={saving}>
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
                <TableHead>Libellé</TableHead>
                <TableHead>Numéro</TableHead>
                <TableHead>Ordre</TableHead>
                <TableHead>Zone</TableHead>
                <TableHead>Actif</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((n) =>
                editingId === n.id ? (
                  <TableRow key={n.id}>
                    <TableCell>
                      <Input
                        value={draft.libelle}
                        onChange={(e) => setDraft((d) => ({ ...d, libelle: e.target.value }))}
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        value={draft.numero}
                        onChange={(e) => setDraft((d) => ({ ...d, numero: e.target.value }))}
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        className="w-20"
                        value={draft.ordre}
                        onChange={(e) => setDraft((d) => ({ ...d, ordre: Number(e.target.value) }))}
                      />
                    </TableCell>
                    <TableCell>
                      <ZoneSelect value={draft.zone_id} onChange={(v) => setDraft((d) => ({ ...d, zone_id: v }))} />
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
                  <TableRow key={n.id}>
                    <TableCell className="font-medium">{n.libelle}</TableCell>
                    <TableCell className="font-mono text-sm">{n.numero}</TableCell>
                    <TableCell className="text-sm">{n.ordre}</TableCell>
                    <TableCell className="text-sm">{zoneName(n.zone_id)}</TableCell>
                    <TableCell>
                      {n.actif ? (
                        <span className="rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-semibold text-green-700">actif</span>
                      ) : (
                        <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-semibold text-gray-500">inactif</span>
                      )}
                    </TableCell>
                    <TableCell className="space-x-2 whitespace-nowrap">
                      <Button size="sm" variant="outline" onClick={() => startEdit(n)}>
                        Modifier
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-destructive hover:bg-destructive/10"
                        onClick={() => remove(n)}
                      >
                        Supprimer
                      </Button>
                    </TableCell>
                  </TableRow>
                ),
              )}
              {items.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-sm text-muted-foreground">
                    Aucun numéro d'urgence enregistré.
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
