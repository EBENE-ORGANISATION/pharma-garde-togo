import { createFileRoute } from "@tanstack/react-router";
import { Pill, AlertTriangle, Phone, Globe, BookOpen, Heart } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { translations, useLang } from "@/lib/i18n";
import { getDiag } from "@/lib/usage";

export const Route = createFileRoute("/about")({
  component: AboutPage,
});

const APP_VERSION = "1.0.0";

function AboutPage() {
  const { t, lang, setLang } = useLang();

  const emergencies = [
    { label: t("samu"), num: "111", tone: "emergency" as const },
    { label: t("police"), num: "117", tone: "primary" as const },
    { label: t("firemen"), num: "118", tone: "primary" as const },
  ];

  return (
    <AppShell title={t("about")}>
      {/* Header */}
      <section className="rounded-b-[28px] bg-primary px-4 pt-5 pb-7 text-primary-foreground shadow-soft">
        <div className="flex items-center gap-2.5">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-white text-primary">
            <Pill className="h-5 w-5" strokeWidth={2.5} />
          </div>
          <div>
            <h1 className="text-xl font-extrabold leading-tight">{t("app_name")}</h1>
            <p className="text-xs font-medium text-primary-foreground/80">
              {t("version")} {APP_VERSION}
            </p>
          </div>
        </div>
        <p className="mt-4 text-sm leading-relaxed text-primary-foreground/95">
          {t("about_intro")}
        </p>
      </section>

      {/* Disclaimer */}
      <section className="px-4 pt-6">
        <div className="rounded-[24px] border border-border bg-card p-5 shadow-card">
          <div className="flex items-center gap-2">
            <div className="grid h-8 w-8 place-items-center rounded-xl bg-primary-soft text-primary">
              <AlertTriangle className="h-4 w-4" />
            </div>
            <h2 className="text-sm font-extrabold uppercase tracking-wide text-primary-dark">
              {t("disclaimer_title")}
            </h2>
          </div>
          <p className="mt-3 text-sm leading-relaxed text-foreground">
            {translations.disclaimer[lang]}
          </p>
        </div>
      </section>

      {/* Emergency numbers */}
      <section className="px-4 pt-6">
        <h3 className="text-base font-extrabold text-primary-dark">{t("emergency_numbers")}</h3>
        <div className="mt-3 grid grid-cols-3 gap-2.5">
          {emergencies.map((e) => (
            <a
              key={e.num}
              href={`tel:${e.num}`}
              className={
                "flex flex-col items-center justify-center gap-1 rounded-2xl px-2 py-4 text-center shadow-card active:scale-[0.97] " +
                (e.tone === "emergency"
                  ? "bg-emergency text-emergency-foreground"
                  : "bg-primary-soft text-primary-dark")
              }
            >
              <Phone className="h-4 w-4 opacity-80" />
              <span className="text-xl font-extrabold leading-none">{e.num}</span>
              <span className="text-[11px] font-semibold opacity-90">{e.label}</span>
            </a>
          ))}
        </div>
      </section>

      {/* Language */}
      <section className="px-4 pt-6">
        <div className="rounded-[24px] border border-border bg-card p-4 shadow-card">
          <div className="flex items-center gap-2">
            <div className="grid h-8 w-8 place-items-center rounded-xl bg-primary-soft text-primary">
              <Globe className="h-4 w-4" />
            </div>
            <h3 className="text-sm font-extrabold uppercase tracking-wide text-primary-dark">
              {t("language_choice")}
            </h3>
          </div>
          <div className="mt-3 inline-flex w-full rounded-2xl bg-primary-soft p-1 text-sm font-bold">
            {(["fr", "en"] as const).map((l) => (
              <button
                key={l}
                onClick={() => setLang(l)}
                aria-pressed={lang === l}
                className={
                  "flex-1 rounded-xl px-3 py-2.5 transition-colors " +
                  (lang === l
                    ? "bg-white text-primary-dark shadow-soft"
                    : "text-primary-dark/70")
                }
              >
                {l === "fr" ? "Français" : "English"}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Sources */}
      <section className="px-4 pt-6 pb-8">
        <div className="rounded-[24px] border border-border bg-card p-5 shadow-card">
          <div className="flex items-center gap-2">
            <div className="grid h-8 w-8 place-items-center rounded-xl bg-primary-soft text-primary">
              <BookOpen className="h-4 w-4" />
            </div>
            <h3 className="text-sm font-extrabold uppercase tracking-wide text-primary-dark">
              {t("sources_title")}
            </h3>
          </div>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            {t("sources_text")}
          </p>
        </div>
        <p className="mt-5 flex items-center justify-center gap-1.5 text-xs font-semibold text-muted-foreground">
          <Heart className="h-3.5 w-3.5 text-primary" /> Togo · {t("version")} {APP_VERSION}
        </p>
        <div className="mt-6 rounded-xl border border-dashed border-border bg-muted/40 p-3">
          <p className="text-[11px] font-semibold text-muted-foreground">Diagnostic compteur</p>
          <p className="mt-1 break-all font-mono text-[10px] leading-snug text-muted-foreground">
            {getDiag()}
          </p>
        </div>
      </section>
    </AppShell>
  );
}
