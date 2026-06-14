// Guarded service worker registration.
// Only registers in production on the real deployed origin — never in the
// Lovable editor preview, iframe previews, or dev. Supports ?sw=off to
// unregister an existing worker for debugging.

export function registerPWA(): void {
  if (typeof window === "undefined") return;
  if (!("serviceWorker" in navigator)) return;

  const hostname = window.location.hostname;
  const url = new URL(window.location.href);
  const inIframe = window.self !== window.top;
  const killSwitch = url.searchParams.get("sw") === "off";

  const isPreviewHost =
    hostname.startsWith("id-preview--") ||
    hostname.startsWith("preview--") ||
    hostname === "lovableproject.com" ||
    hostname.endsWith(".lovableproject.com") ||
    hostname === "lovableproject-dev.com" ||
    hostname.endsWith(".lovableproject-dev.com") ||
    hostname === "beta.lovable.dev" ||
    hostname.endsWith(".beta.lovable.dev");

  const shouldRefuse = !import.meta.env.PROD || inIframe || isPreviewHost || killSwitch;

  if (shouldRefuse) {
    navigator.serviceWorker
      .getRegistrations()
      .then((regs) => {
        for (const reg of regs) {
          if (reg.active?.scriptURL.endsWith("/sw.js")) {
            reg.unregister();
          }
        }
      })
      .catch(() => {});
    return;
  }

  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch((err) => {
      console.warn("SW registration failed:", err);
    });
  });
}
