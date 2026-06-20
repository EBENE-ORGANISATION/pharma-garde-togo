import { Link, useRouterState } from "@tanstack/react-router";
import { Home, Map, Pill, Info } from "lucide-react";
import type { ReactNode } from "react";
import { useLang } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export function AppShell({
  children,
  hideHeader,
}: {
  children: ReactNode;
  title?: string;
  hideHeader?: boolean;
}) {
  const { t } = useLang();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  const nav = [
    { to: "/", icon: Home, label: t("home") },
    { to: "/carte", icon: Map, label: t("map") },
    { to: "/about", icon: Info, label: t("about") },
  ] as const;

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col bg-background">
      {!hideHeader && (
        <header className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-border bg-background/95 px-4 py-3 backdrop-blur" style={{ paddingTop: "calc(0.75rem + env(safe-area-inset-top, 0px))" }}>
          <Link to="/" className="flex min-w-0 items-center gap-2">
            <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground">
              <Pill className="h-4 w-4" />
            </div>
            <div className="min-w-0 truncate text-base font-extrabold leading-none text-primary-dark">
              {t("app_name")}
            </div>
          </Link>
        </header>
      )}

      <main className="flex-1 pb-24">{children}</main>

      <nav className="fixed inset-x-0 bottom-0 z-30 mx-auto max-w-md border-t border-border bg-background/95 backdrop-blur" style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}>
        <ul className="grid grid-cols-3">
          {nav.map((item) => {
            const active = item.to === "/" ? pathname === "/" : pathname.startsWith(item.to);
            const Icon = item.icon;
            return (
              <li key={item.to}>
                <Link
                  to={item.to}
                  className={cn(
                    "flex flex-col items-center gap-1 px-1 py-2.5 text-[11px] font-semibold transition-colors",
                    active ? "text-primary-dark" : "text-muted-foreground",
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
