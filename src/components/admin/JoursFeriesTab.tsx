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
  type JourFerie,
  listJoursFeries,
  addJourFerie,
  updateJourFerie,
  deleteJourFerie,
} from "@/lib/admin-api";

type Draft = { date: string; nom: string; a_confirmer: boolean };
const emptyDraft: Draft = { date: "", nom: "", a_confirmer: false };

export function JoursFeriesTab() {
  const [jours, setJours] = useState<JourFerie[]>([]);
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
    const { data, error } = await listJoursFeries();
    if (error) setError(error.message);
    setJours((data ?? []) as JourFerie[]);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  function startEdit(j: JourFerie) {
    setEditingId(j.id);
    setDraft({ date: j.date, nom: j.nom, a_confirmer: j.a_confirmer });
  }

  async function saveEdit() {
    if (!editingId) return;
    setSaving(true);
    setError(null);
    const { error } = await updateJourFerie(editingId, draft);
    setSaving(false);
    if (error) { setError(error.message); return; }
    setEditingId(null);
    await load();
  }

  async function create() {
    if (!newDraft.date) { setError("La date est obligatoire."); return; }
    if (!newDraft.nom.trim()) { setError("Le nom est obligatoire."); return; }
    setSaving(true);
    setError(null);
    const { error } = await addJourFerie(newDraft.date, newDraft.nom.trim(), newDraft.a_confirmer);
    setSaving(false);
    if (error) { setError(error.message); return; }
    setNewDraft(emptyDraft);
    setCreating(false);
    await load();
  }

  async function remove(j: JourFerie) {
    if (!window.confirm(`Supprimer « ${j.nom} » (${j.date}) ?`)) return;
    setError(null);
    const { error } = await deleteJourFerie(j.id);
    if (error) { setError(error.message); return; }
    await load();
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold">Jours fériés</h2>
        <Button size="sm" onClick={() => { setCreating((v) => !v); setError(null); }}>
          {creating ? "Annuler" : "Ajouter un jour férié"}
        </Button>
      </div>

      {error && (
        <p className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{error}</p>
      )}

      {creating && (
        <div className="space-y-3 rounded-2xl border border-border bg-card p-4 shadow-card">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="text-xs font-semibold text-muted-foreground">Date *</label>
              <Input
                type="date"
                value={newDraft.date}
                onChange={(e) => setNewDraft((d) => ({ ...d, date: e.target.value }))}
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground">Nom *</label>
              <Input
                value={newDraft.nom}
                placeholder="Ex. Fête nationale"
                onChange={(e) => setNewDraft((d) => ({ ...d, nom: e.target.value }))}
              />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              checked={newDraft.a_confirmer}
              onCheckedChange={(c) => setNewDraft((d) => ({ ...d, a_confirmer: Boolean(c) }))}
            />
            <span className="text-sm">À confirmer</span>
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
                <TableHead>Date</TableHead>
                <TableHead>Nom</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {jours.map((j) =>
                editingId === j.id ? (
                  <TableRow key={j.id}>
                    <TableCell>
                      <Input
                        type="date"
                        value={draft.date}
                        onChange={(e) => setDraft((d) => ({ ...d, date: e.target.value }))}
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        value={draft.nom}
                        onChange={(e) => setDraft((d) => ({ ...d, nom: e.target.value }))}
                      />
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Checkbox
                          checked={draft.a_confirmer}
                          onCheckedChange={(c) => setDraft((d) => ({ ...d, a_confirmer: Boolean(c) }))}
                        />
                        <span className="text-sm">À confirmer</span>
                      </div>
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
                  <TableRow key={j.id}>
                    <TableCell className="font-mono text-sm">{j.date}</TableCell>
                    <TableCell className="font-medium">{j.nom}</TableCell>
                    <TableCell>
                      {j.a_confirmer && (
                        <span className="rounded-full bg-orange-100 px-2.5 py-0.5 text-xs font-semibold text-orange-700">
                          à confirmer
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="space-x-2 whitespace-nowrap">
                      <Button size="sm" variant="outline" onClick={() => startEdit(j)}>
                        Modifier
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-destructive hover:bg-destructive/10"
                        onClick={() => remove(j)}
                      >
                        Supprimer
                      </Button>
                    </TableCell>
                  </TableRow>
                ),
              )}
              {jours.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-sm text-muted-foreground">
                    Aucun jour férié enregistré.
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
