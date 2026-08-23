"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { ensureAnonymousUser, observeAuth } from "@/lib/firebase/auth";
import { isFirebaseConfigured } from "@/lib/firebase/client";
import { IS_TOSS_APP } from "@/lib/platform";
import {
  observeEntries,
  observeCurrentMonthDays,
  observeRollup,
  observeSystemConfig,
  loadRemotePreferences,
  registerMessagingToken,
  syncPreferencesRemote,
  takeQueuedResolutions,
} from "@/lib/firebase/sync";
import { useAppStore } from "@/lib/store";

export function ClientProviders({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const timezone = useAppStore((state) => state.timezone);
  const hydrated = useAppStore((state) => state.hydrated);
  const onboarded = useAppStore((state) => state.onboarded);
  const notify = useAppStore((state) => state.notify);
  const selectedQuestionKeys = useAppStore((state) => state.selectedQuestionKeys);
  const questionLabels = useAppStore((state) => state.questionLabels);
  const catalog = useAppStore((state) => state.questionCatalog);
  const firebaseUid = useAppStore((state) => state.firebaseUid);
  const setAuthState = useAppStore((state) => state.setAuthState);
  const setQuestionCatalog = useAppStore((state) => state.setQuestionCatalog);
  const setRemoteRollup = useAppStore((state) => state.setRemoteRollup);
  const setRemoteDays = useAppStore((state) => state.setRemoteDays);
  const mergeRemoteEntries = useAppStore((state) => state.mergeRemoteEntries);
  const applyRemotePreferences = useAppStore((state) => state.applyRemotePreferences);
  const markQuestionLabelsSynced = useAppStore((state) => state.markQuestionLabelsSynced);
  const resolveEntry = useAppStore((state) => state.resolveEntry);
  const firebaseConfigured = isFirebaseConfigured();
  const [preferencesReadyUid, setPreferencesReadyUid] = useState<string | null>(null);

  useEffect(() => {
    if (!firebaseConfigured) return;
    let mounted = true;
    let creatingAnonymousUser = false;
    const unsubscribe = observeAuth((user) => {
      if (!mounted) return;
      if (user) {
        setAuthState(user.uid);
        return;
      }
      if (creatingAnonymousUser) return;
      creatingAnonymousUser = true;
      setAuthState(null);
      void ensureAnonymousUser(timezone)
        .then((anonymousUser) => {
          if (!mounted) return;
          setAuthState(anonymousUser?.uid ?? null);
        })
        .catch((error) => {
          if (!mounted) return;
          console.error("사용자 세션을 준비하지 못했습니다.", error);
        })
        .finally(() => {
          creatingAnonymousUser = false;
        });
    });
    return () => {
      mounted = false;
      unsubscribe();
    };
  }, [firebaseConfigured, setAuthState, timezone]);

  useEffect(() => {
    if (!firebaseUid) return;
    let mounted = true;
    void loadRemotePreferences(firebaseUid)
      .then((preferences) => {
        if (!mounted) return;
        if (preferences) applyRemotePreferences(preferences);
      })
      .catch((error) => {
        console.error("원격 설정을 불러오지 못했습니다.", error);
      })
      .finally(() => {
        if (mounted) setPreferencesReadyUid(firebaseUid);
      });
    return () => {
      mounted = false;
    };
  }, [applyRemotePreferences, firebaseUid]);

  useEffect(() => {
    if (!firebaseUid) return;
    const stopEntries = observeEntries(firebaseUid, timezone, mergeRemoteEntries);
    const stopRollup = observeRollup(firebaseUid, setRemoteRollup);
    const stopDays = observeCurrentMonthDays(firebaseUid, timezone, setRemoteDays);
    const stopConfig = observeSystemConfig(setQuestionCatalog);
    return () => {
      stopEntries();
      stopRollup();
      stopDays();
      stopConfig();
    };
  }, [firebaseUid, mergeRemoteEntries, setQuestionCatalog, setRemoteDays, setRemoteRollup, timezone]);

  useEffect(() => {
    if (!hydrated || !firebaseUid || preferencesReadyUid !== firebaseUid) return;
    const syncedQuestionLabels = Object.fromEntries(
      selectedQuestionKeys.flatMap((key) =>
        questionLabels[key] ? [[key, questionLabels[key]] as const] : [],
      ),
    );
    void syncPreferencesRemote({
      uid: firebaseUid,
      timezone,
      onboarded,
      notify,
      selectedQuestionKeys,
      questionLabels,
      catalog,
    })
      .then(() => markQuestionLabelsSynced(syncedQuestionLabels))
      .catch((error) => {
        console.error("원격 설정을 저장하지 못했습니다.", error);
      });
    if (notify.morningEnabled || notify.eveningEnabled) {
      void registerMessagingToken(firebaseUid);
    }
  }, [catalog, firebaseUid, hydrated, markQuestionLabelsSynced, notify, onboarded, preferencesReadyUid, questionLabels, selectedQuestionKeys, timezone]);

  useEffect(() => {
    if (!hydrated) return;
    void takeQueuedResolutions().then((queued) => {
      queued.forEach((item) => resolveEntry(item.entryId, item.outcome));
    });
  }, [hydrated, resolveEntry]);

  useEffect(() => {
    // The PWA service worker is browser/installed-app territory: Toss's
    // review device loads the mini app fresh through its own webview shell,
    // which doesn't need (and may sandbox/restrict) SW registration, cache
    // storage, or the cross-origin importScripts() calls sw.js makes for
    // Firebase Messaging. Registering it there risked stalling first load
    // past the 20s budget and made the app read as inaccessible to review.
    if (IS_TOSS_APP) return;
    if (!("serviceWorker" in navigator) || process.env.NODE_ENV !== "production") return;
    void navigator.serviceWorker.register("/sw.js", { scope: "/" });
  }, []);

  // Render as soon as local (persisted) state is hydrated — Firebase auth/sync
  // run in the background and merge in as they resolve. Blocking first paint
  // on those network round-trips left the screen blank for however long
  // Firebase took, which Toss app review flagged as both "app inaccessible"
  // and a 20s+ load time.
  const onboardingRoute = pathname.startsWith("/onboarding");
  const redirectTarget = hydrated
    ? !onboarded && !onboardingRoute
      ? "/onboarding/"
      : onboarded && onboardingRoute
        ? "/"
        : null
    : null;

  useEffect(() => {
    // Next's client-side router needs to fetch the target route's RSC
    // flight payload (out/web/**/index.txt in the static export) before it
    // can transition — on the developer's device this never fires, since
    // onboarding is already persisted from prior testing, but Toss review
    // always opens a fresh, never-onboarded session and hits this redirect
    // on every run. That extra fetch appears to stall or fail inside the
    // Toss webview's resource loader, which is consistent with review
    // reporting both a dead main scheme and a 20s+ load. A full document
    // navigation uses the exact same request path that already
    // successfully loaded the current page, so it's the reliable choice
    // here even though it costs a full reload instead of an SPA transition.
    if (redirectTarget) window.location.replace(redirectTarget);
  }, [redirectTarget]);

  // Never render nothing: a blank frame while waiting on hydration/redirect
  // is exactly what Toss review's "main scheme inaccessible" / 20s+ load
  // checks flag, and a first-time (never-onboarded) session — which is what
  // every review run is — always passes through redirectTarget on its way
  // to /onboarding/. Painting the current route's real content immediately
  // and letting the redirect effect take over in the background means the
  // very first frame is never empty, even during that transition.

  return children;
}
