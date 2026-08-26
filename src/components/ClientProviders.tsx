"use client";

import { useEffect, useState } from "react";
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

  // No routing happens here any more. This used to also redirect a
  // never-onboarded session to /onboarding/ with window.location.replace,
  // duplicating the same rule the pages carried — and inside the deployed
  // Toss mini app that document navigation never landed, so the root page
  // just reissued it forever. Onboarding is rendered in place by the root
  // page now (see OnboardingFlow); providers only wire up auth and sync,
  // both of which stay in the background and merge in as they resolve.

  return children;
}
