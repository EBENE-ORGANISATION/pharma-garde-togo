import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { translations } from "@/lib/i18n";
import { useLang } from "@/lib/i18n";

export const Route = createFileRoute("/about")({
  component: AboutPage,
});

function AboutPage() {
  const { t } = useLang();
  return (
    <AppShell title={t("about")}>
      <div className="space-y-6 px-4 pt-4 pb-6">
        <section>
          <h1 className="text-xl font-extrabold">{t("app_name")}</h1>
          <p className="mt-2 text-sm text-muted-foreground">{t("about_text")}</p>
        </section>

        <section className="rounded-2xl border border-border bg-primary-soft p-4">
          <h2 className="text-sm font-bold uppercase tracking-wide text-primary-dark">
            {t("disclaimer_title")} — FR
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-primary-dark">
            {translations.disclaimer.fr}
          </p>
        </section>

        <section className="rounded-2xl border border-border bg-primary-soft p-4">
          <h2 className="text-sm font-bold uppercase tracking-wide text-primary-dark">
            {t("disclaimer_title")} — EN
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-primary-dark">
            {translations.disclaimer.en}
          </p>
        </section>
      </div>
    </AppShell>
  );
}
