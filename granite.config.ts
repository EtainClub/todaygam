import { defineConfig } from "@apps-in-toss/web-framework/config";

export default defineConfig({
  // Must exactly match the appName registered in the Apps in Toss console.
  appName: "gam",
  brand: {
    displayName: "오늘감",
    // --accent from src/app/globals.css.
    primaryColor: "#183f36",
    // TODO: confirm this resolves once Hosting is live (or swap in a custom domain).
    icon: "https://today-gam.web.app/icons/icon-512.png",
  },
  web: {
    host: "localhost",
    port: 3000,
    commands: {
      // ait build/dev actually run these commands themselves (verified by
      // running `ait build` and watching it invoke this exact string) — the
      // eval-safe alias in next.config.ts only applies when TOSS_BUILD=1, so
      // this must point at the Toss-flagged scripts, not plain dev/build.
      dev: "pnpm dev:toss",
      build: "pnpm build:toss",
    },
  },
  webViewProps: {
    type: "partner",
    bounces: false,
    pullToRefreshEnabled: false,
  },
  permissions: [],
  // next.config.ts sets output: "export", so `pnpm build:toss` already emits
  // a static site here — no separate prepare-public step needed.
  outdir: "out",
});
