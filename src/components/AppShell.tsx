import { Link, useRouterState } from "@tanstack/react-router";
import { Home, MapPin, Pill, Phone, Info } from "lucide-react";
import type { ReactNode } from "react";
import { useLang } from "@/lib/i18n";
import { cn } from "@/lib/utils";

function LangSwitch() {
  const { lang, setLang } = useLang();
  return (
    <div className="inline-flex rounded-full border border-border bg-background p-0.5 text-xs font-semibold">
      {(["fr", "en"] as const).map((l) => (
        <button
          key={l}
          onClick={() => setLang(l)}
          className={cn(
            "rounded-full px-3 py-1 transition-colors",
            lang === l ? "bg-primary text-primary-foreground" : "text-muted-foreground",
          )}
          aria-pressed={lang === l}
        >
          {l.toUpperCase()}
        </button>
      ))}
    </div>
  );
}

export function AppShell({ children, title }: { children: ReactNode; title?: string }) {
  const { t } = useLang();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  const nav = [
    { to: "/", icon: Home, label: t("home") },
    { to: "/garde", icon: Pill, label: t("on_duty") },
    { to: "/carte", icon: MapPin, label: t("map") },
    { to: "/urgences", icon: Phone, label: t("emergency_numbers") },
    { to: "/about", icon: Info, label: t("about") },
  ] as const;

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col bg-background">
      <header className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-border bg-background/95 px-4 py-3 backdrop-blur">
        <Link to="/" className="flex min-w-0 items-center gap-2">
          <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-primary text-primary-foreground">
            <Pill className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <div className="truncate text-sm font-bold leading-none">{t("app_name")}</div>
            {title && <div className="truncate text-[11px] text-muted-foreground">{title}</div>}
          </div>
        </Link>
        <LangSwitch />
      </header>

      <main className="flex-1 pb-24">{children}</main>

      <nav className="fixed inset-x-0 bottom-0 z-30 mx-auto max-w-md border-t border-border bg-background">
        <ul className="grid grid-cols-5">
          {nav.map((item) => {
            const active = item.to === "/" ? pathname === "/" : pathname.startsWith(item.to);
            const Icon = item.icon;
            return (
              <li key={item.to}>
                <Link
                  to={item.to}
                  className={cn(
                    "flex flex-col items-center gap-1 px-1 py-2 text-[10px] font-medium transition-colors",
                    active ? "text-primary" : "text-muted-foreground",
                  )}
                >
                  <Icon className={cn("h-5 w-5", active && "stroke-[2.5]")} />
                  <span className="truncate">{item.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}
