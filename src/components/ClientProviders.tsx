"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { accountProfileFromUser } from "@/lib/account-profile";
import { ensureAnonymousUser, observeAuth } from "@/lib/firebase/auth";
import { isFirebaseConfigured } from "@/lib/firebase/client";
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
  const router = useRouter();
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
  const resolveEntry = useAppStore((state) => state.resolveEntry);
  const firebaseConfigured = isFirebaseConfigured();
  const [authReady, setAuthReady] = useState(!firebaseConfigured);
  const [preferencesReadyUid, setPreferencesReadyUid] = useState<string | null>(null);
  const [entriesReadyKey, setEntriesReadyKey] = useState<string | null>(null);

  useEffect(() => {
    if (!firebaseConfigured) return;
    let mounted = true;
    let creatingAnonymousUser = false;
    const unsubscribe = observeAuth((user) => {
      if (!mounted) return;
      if (user) {
        setAuthState(
          user.uid,
          !user.isAnonymous,
          user.isAnonymous ? null : accountProfileFromUser(user),
        );
        setAuthReady(true);
        return;
      }
      if (creatingAnonymousUser) return;
      creatingAnonymousUser = true;
      setAuthReady(false);
      setAuthState(null, false);
      void ensureAnonymousUser(timezone)
        .then((anonymousUser) => {
          if (!mounted) return;
          setAuthState(
            anonymousUser?.uid ?? null,
            Boolean(anonymousUser && !anonymousUser.isAnonymous),
          );
          setAuthReady(true);
        })
        .catch((error) => {
          if (!mounted) return;
          console.error("사용자 세션을 준비하지 못했습니다.", error);
          setAuthReady(true);
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
    const readyKey = `${firebaseUid}:${timezone}`;
    const stopEntries = observeEntries(firebaseUid, timezone, (entries) => {
      mergeRemoteEntries(entries);
      setEntriesReadyKey(readyKey);
    });
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
    void syncPreferencesRemote({
      uid: firebaseUid,
      timezone,
      onboarded,
      notify,
      selectedQuestionKeys,
      questionLabels,
      catalog,
    });
    if (notify.morningEnabled || notify.eveningEnabled) {
      void registerMessagingToken(firebaseUid);
    }
  }, [catalog, firebaseUid, hydrated, notify, onboarded, preferencesReadyUid, questionLabels, selectedQuestionKeys, timezone]);

  useEffect(() => {
    if (!hydrated) return;
    void takeQueuedResolutions().then((queued) => {
      queued.forEach((item) => resolveEntry(item.entryId, item.outcome));
    });
  }, [hydrated, resolveEntry]);

  useEffect(() => {
    if (!("serviceWorker" in navigator) || process.env.NODE_ENV !== "production") return;
    void navigator.serviceWorker.register("/sw.js", { scope: "/" });
  }, []);

  const firebaseReady =
    !firebaseConfigured ||
    (authReady && (!firebaseUid || preferencesReadyUid === firebaseUid));
  const routeReady = hydrated && firebaseReady;
  const onboardingRoute = pathname.startsWith("/onboarding");
  const redirectTarget = routeReady
    ? !onboarded && !onboardingRoute
      ? "/onboarding/"
      : onboarded && onboardingRoute
        ? "/"
        : null
    : null;
  const entriesReady =
    !firebaseUid || entriesReadyKey === `${firebaseUid}:${timezone}`;

  useEffect(() => {
    if (redirectTarget) router.replace(redirectTarget);
  }, [redirectTarget, router]);

  if (
    !routeReady ||
    redirectTarget ||
    (onboarded && !onboardingRoute && !entriesReady)
  ) {
    return null;
  }

  return children;
}
