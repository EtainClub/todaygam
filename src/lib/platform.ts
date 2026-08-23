/**
 * Whether this bundle is the Apps in Toss (앱인토스) build.
 *
 * Baked in at build time via `build:toss`/`build:ait` (see package.json and
 * next.config.ts) — never detected at runtime. The Toss bundle only ever
 * runs inside Toss, so there's nothing to detect, and a wrong runtime guess
 * would be worse than not guessing.
 *
 * The Toss build aliases `firebase/firestore` to `firebase/firestore/lite`
 * (next.config.ts) to keep review-blocking eval-flagged code out of the
 * bundle. This flag is what the rest of the app uses to route around the
 * APIs `firestore/lite` doesn't have — see src/lib/firebase/client.ts and
 * src/lib/firebase/toss-live.ts.
 */
export const IS_TOSS_APP = process.env.NEXT_PUBLIC_TOSS_APP === "1";
