"use client";

import { useEffect, useState } from "react";
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
  const timezone = useAppStore((state) => state.timezone);
  const hydrated = useAppStore((state) => state.hydrated);
  const onboarded = useAppStore((state) => state.onboarded);
  const notify = useAppStore((state) => state.notify);
  const selectedQuestionKeys = useAppStore((state) => state.selectedQuestionKeys);
  const catalog = useAppStore((state) => state.questionCatalog);
  const firebaseUid = useAppStore((state) => state.firebaseUid);
  const setAuthState = useAppStore((state) => state.setAuthState);
  const setQuestionCatalog = useAppStore((state) => state.setQuestionCatalog);
  const setRemoteRollup = useAppStore((state) => state.setRemoteRollup);
  const setRemoteDays = useAppStore((state) => state.setRemoteDays);
  const mergeRemoteEntries = useAppStore((state) => state.mergeRemoteEntries);
  const applyRemotePreferences = useAppStore((state) => state.applyRemotePreferences);
  const resolveEntry = useAppStore((state) => state.resolveEntry);
  const [preferencesReadyUid, setPreferencesReadyUid] = useState<string | null>(null);

  useEffect(() => {
    if (!isFirebaseConfigured()) return;
    let mounted = true;
    void ensureAnonymousUser(timezone).then((user) => {
      if (mounted) setAuthState(user?.uid ?? null, Boolean(user && !user.isAnonymous));
    });
    const unsubscribe = observeAuth((user) => {
      if (mounted) setAuthState(user?.uid ?? null, Boolean(user && !user.isAnonymous));
    });
    return () => {
      mounted = false;
      unsubscribe();
    };
  }, [setAuthState, timezone]);

  useEffect(() => {
    if (!firebaseUid) return;
    let mounted = true;
    void loadRemotePreferences(firebaseUid)
      .then((preferences) => {
        if (!mounted) return;
        if (preferences) applyRemotePreferences(preferences);
        setPreferencesReadyUid(firebaseUid);
      })
      .catch((error) => {
        console.error("원격 설정을 불러오지 못했습니다.", error);
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
    void syncPreferencesRemote({
      uid: firebaseUid,
      timezone,
      onboarded,
      notify,
      selectedQuestionKeys,
      catalog,
    });
    if (notify.morningEnabled || notify.eveningEnabled) {
      void registerMessagingToken(firebaseUid);
    }
  }, [catalog, firebaseUid, hydrated, notify, onboarded, preferencesReadyUid, selectedQuestionKeys, timezone]);

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

  return children;
}
