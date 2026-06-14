import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Search } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { useLang } from "@/lib/i18n";
import { useMedicineSearch } from "@/lib/supabase-hooks";

export const Route = createFileRoute("/medicaments")({
  component: MedicamentsPage,
});

function MedicamentsPage() {
  const { t } = useLang();
  const [q, setQ] = useState("");
  const { items: results, loading } = useMedicineSearch(q);

  return (
    <AppShell title={t("medicines")}>
      <div className="px-4 pt-4">
        <label className="block text-sm font-semibold">{t("search_medicine")}</label>
        <div className="relative mt-2">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t("search_placeholder")}
            className="w-full rounded-xl border border-border bg-background py-3 pl-10 pr-3 text-base"
          />
        </div>
        <p className="mt-2 text-xs text-muted-foreground">{t("no_price_note")}</p>

        <ul className="mt-4 space-y-2 pb-4">
          {results.map((m) => (
            <li key={m.id} className="rounded-2xl border border-border bg-card p-4 shadow-card">
              <div className="text-base font-bold">{m.dci}</div>
              <div className="mt-1 grid grid-cols-2 gap-2 text-sm">
                <div>
                  <div className="text-[11px] uppercase text-muted-foreground">{t("form")}</div>
                  <div className="font-medium">{m.forme ?? "—"}</div>
                </div>
                <div>
                  <div className="text-[11px] uppercase text-muted-foreground">{t("dosage")}</div>
                  <div className="font-medium">{m.dosage ?? "—"}</div>
                </div>
              </div>
            </li>
          ))}
          {q && !loading && results.length === 0 && (
            <li className="rounded-2xl border border-dashed p-6 text-center text-sm text-muted-foreground">
              {t("no_results")}
            </li>
          )}
        </ul>
      </div>
    </AppShell>
  );
}
