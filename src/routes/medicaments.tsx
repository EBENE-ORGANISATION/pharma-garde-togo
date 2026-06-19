import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Search, Pill, Info, Loader2, X } from "lucide-react";
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
      {/* Header band */}
      <section className="rounded-b-[28px] bg-primary px-4 pt-5 pb-6 text-primary-foreground shadow-soft">
        <div className="flex items-center gap-2.5">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-white text-primary">
            <Pill className="h-5 w-5" strokeWidth={2.5} />
          </div>
          <div>
            <h1 className="text-xl font-extrabold leading-tight">{t("medicines")}</h1>
            <p className="text-xs font-medium text-primary-foreground/80">
              {t("medicines_subtitle")}
            </p>
          </div>
        </div>

        {/* Search input */}
        <div className="relative mt-4">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-primary" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t("search_medicine_short")}
            className="w-full rounded-2xl border-0 bg-white py-4 pl-12 pr-12 text-base font-semibold text-primary-dark shadow-card outline-none placeholder:font-medium placeholder:text-muted-foreground"
            aria-label={t("search_medicine")}
          />
          {q && (
            <button
              type="button"
              onClick={() => setQ("")}
              aria-label={t("close")}
              className="absolute right-3 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-full bg-primary-soft text-primary-dark active:scale-95"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </section>

      <section className="px-4 pt-5">
        {/* Indicative notice */}
        <div className="flex gap-2 rounded-2xl bg-primary-soft/60 px-3.5 py-3 text-[11px] leading-snug text-primary-dark/80">
          <Info className="h-4 w-4 shrink-0 text-primary" />
          <p>{t("no_price_note")}</p>
        </div>

        {/* States */}
        {loading && (
          <div className="mt-5 flex items-center justify-center gap-2 rounded-2xl border border-dashed border-border bg-card py-8 text-sm font-semibold text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin text-primary" />
            {t("loading")}
          </div>
        )}

        {!loading && !q && (
          <div className="mt-5 rounded-[24px] border border-dashed border-border bg-card p-6 text-center">
            <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-2xl bg-primary-soft text-primary">
              <Search className="h-6 w-6" />
            </div>
            <p className="text-sm font-semibold text-primary-dark">{t("type_to_search")}</p>
          </div>
        )}

        {!loading && q && results.length === 0 && (
          <div className="mt-5 rounded-[24px] border border-dashed border-border bg-card p-6 text-center">
            <p className="text-base font-bold text-primary-dark">{t("no_results")}</p>
            <p className="mt-1 text-xs text-muted-foreground">{t("no_results_hint")}</p>
          </div>
        )}

        {/* Results */}
        {results.length > 0 && (
          <ul className="mt-4 space-y-3 pb-4">
            {results.map((m) => (
              <li
                key={m.id}
                className="flex items-center gap-3 rounded-[24px] border border-border bg-card p-4 shadow-card"
              >
                <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-primary-soft text-primary">
                  <Pill className="h-5 w-5" strokeWidth={2.5} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-base font-extrabold leading-tight text-primary-dark">
                    {m.dci}
                  </div>
                  <div className="mt-0.5 truncate text-sm text-muted-foreground">
                    {[m.forme, m.dosage].filter(Boolean).join(" · ") || "—"}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </AppShell>
  );
}
