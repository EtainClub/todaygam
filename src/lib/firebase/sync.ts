"use client";

import { httpsCallable, getFunctions } from "firebase/functions";
import { getMessaging, getToken, isSupported } from "firebase/messaging";
import {
  collection,
  doc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  where,
  writeBatch,
  type DocumentData,
  type Timestamp,
} from "firebase/firestore";
import type { DaySummary, Entry, NotifySettings, Question, Rollup } from "../types";
import { getFirebaseClient } from "./client";

function toIso(value: Timestamp | string | null | undefined, fallback: string | null = null) {
  if (typeof value === "string") return value;
  if (value && typeof value.toDate === "function") return value.toDate().toISOString();
  return fallback;
}

function mapEntry(id: string, data: DocumentData): Entry {
  const optimisticNow = new Date().toISOString();
  return {
    ...(data as Entry),
    id,
    createdAt: toIso(data.createdAt, optimisticNow) ?? optimisticNow,
    lockedAt: toIso(data.lockedAt, optimisticNow) ?? optimisticNow,
    resolvedAt: toIso(data.resolvedAt),
    deletedAt: toIso(data.deletedAt),
  };
}

export function observeEntries(uid: string, timezone: string, callback: (entries: Entry[]) => void) {
  const client = getFirebaseClient();
  if (!client) return () => undefined;
  const nowParts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
  }).formatToParts(new Date());
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    nowParts.find((part) => part.type === type)?.value ?? "";
  const firstOfMonth = `${value("year")}-${value("month")}-01`;
  const groups = new Map<string, Entry[]>();
  const emit = () => callback(Array.from(groups.values()).flat());
  const stopMonth = onSnapshot(
    query(collection(client.db, `users/${uid}/entries`), where("date", ">=", firstOfMonth)),
    (snapshot) => {
      groups.set("month", snapshot.docs.map((item) => mapEntry(item.id, item.data())));
      emit();
    },
  );
  const stopUnresolved = onSnapshot(
    query(
      collection(client.db, `users/${uid}/entries`),
      where("outcome", "==", "pending"),
      where("date", "<", firstOfMonth),
    ),
    (snapshot) => {
      groups.set("unresolved", snapshot.docs.map((item) => mapEntry(item.id, item.data())));
      emit();
    },
  );
  return () => {
    stopMonth();
    stopUnresolved();
  };
}

export function observeCurrentMonthDays(
  uid: string,
  timezone: string,
  callback: (days: DaySummary[]) => void,
) {
  const client = getFirebaseClient();
  if (!client) return () => undefined;
  const current = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
  }).formatToParts(new Date());
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    current.find((part) => part.type === type)?.value ?? "";
  const prefix = `${value("year")}-${value("month")}`;
  return onSnapshot(
    query(
      collection(client.db, `users/${uid}/days`),
      where("date", ">=", `${prefix}-01`),
      where("date", "<=", `${prefix}-31`),
    ),
    (snapshot) => callback(snapshot.docs.map((item) => item.data() as DaySummary)),
  );
}

export function observeRollup(uid: string, callback: (rollup: Rollup | null) => void) {
  const client = getFirebaseClient();
  if (!client) return () => undefined;
  return onSnapshot(doc(client.db, `users/${uid}/stats/rollup`), (snapshot) => {
    if (!snapshot.exists()) {
      callback(null);
      return;
    }
    const data = snapshot.data() as Partial<Rollup>;
    callback({
      version: 2,
      totals: {
        days: data.totals?.days ?? 0,
        created: data.totals?.created ?? 0,
        resolved: data.totals?.resolved ?? 0,
        hit: data.totals?.hit ?? 0,
        miss: data.totals?.miss ?? 0,
        uncertain: data.totals?.uncertain ?? 0,
      },
      byQuestion: data.byQuestion ?? {},
      byStrength: {
        faint: data.byStrength?.faint ?? { hit: 0, total: 0 },
        medium: data.byStrength?.medium ?? { hit: 0, total: 0 },
        strong: data.byStrength?.strong ?? { hit: 0, total: 0 },
      },
    });
  });
}

export function observeSystemConfig(callback: (questions: Question[]) => void) {
  const client = getFirebaseClient();
  if (!client) return () => undefined;
  return onSnapshot(doc(client.db, "system/config"), (snapshot) => {
    const catalog = snapshot.data()?.questionCatalog;
    if (Array.isArray(catalog) && catalog.length > 0) {
      callback(
        (catalog as Question[])
          .filter((question) => question.enabled)
          .sort((a, b) => a.order - b.order),
      );
    }
  });
}

export async function syncPreferencesRemote(values: {
  uid: string;
  timezone: string;
  onboarded: boolean;
  notify: NotifySettings;
  selectedQuestionKeys: string[];
  catalog: Question[];
}) {
  const client = getFirebaseClient();
  if (!client) return;
  const { uid, timezone, onboarded, notify, selectedQuestionKeys, catalog } = values;
  const batch = writeBatch(client.db);
  batch.set(
    doc(client.db, `users/${uid}`),
    {
      timezone,
      notify,
      onboardedAt: onboarded ? serverTimestamp() : null,
      appVersion: "1.0.0",
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );
  if (!onboarded) {
    await batch.commit();
    return;
  }

  const current = await getDocs(collection(client.db, `users/${uid}/questions`));
  const existing = new Map(current.docs.map((item) => [item.id, item.data()]));
  const previouslyActive = current.docs
    .filter((item) => item.data().active)
    .sort((a, b) => a.data().order - b.data().order)
    .map((item) => item.id);
  selectedQuestionKeys.forEach((key, order) => {
    const question = catalog.find((item) => item.key === key);
    if (!question) return;
    const previous = existing.get(key);
    batch.set(
      doc(client.db, `users/${uid}/questions/${key}`),
      {
        key,
        label: previous?.label ?? question.label,
        yesLabel: previous?.yesLabel ?? question.yesLabel,
        noLabel: previous?.noLabel ?? question.noLabel,
        order,
        active: true,
        createdAt: previous?.createdAt ?? serverTimestamp(),
        deactivatedAt: null,
      },
      { merge: true },
    );
  });
  current.docs.forEach((item) => {
    if (selectedQuestionKeys.includes(item.id) || item.data().active === false) return;
    batch.update(item.ref, { active: false, deactivatedAt: serverTimestamp() });
  });
  if (
    previouslyActive.length > 0 &&
    previouslyActive.join("|") !== selectedQuestionKeys.join("|")
  ) {
    batch.set(doc(collection(client.db, `users/${uid}/audit`)), {
      action: "question_replaced",
      payload: { before: previouslyActive, after: selectedQuestionKeys },
      createdAt: serverTimestamp(),
    });
  }
  await batch.commit();
}

export async function markLinkPromptShownRemote(uid: string) {
  const client = getFirebaseClient();
  if (!client) return;
  await setDoc(
    doc(client.db, `users/${uid}`),
    { linkPromptShownAt: serverTimestamp(), updatedAt: serverTimestamp() },
    { merge: true },
  );
}

export async function registerMessagingToken(uid: string) {
  const client = getFirebaseClient();
  if (!client || !(await isSupported()) || Notification.permission !== "granted") return;
  const registration = await navigator.serviceWorker.ready;
  const token = await getToken(getMessaging(client.app), {
    vapidKey: process.env.NEXT_PUBLIC_FB_VAPID_KEY,
    serviceWorkerRegistration: registration,
  });
  if (!token) return;
  const isIOS = /iP(hone|ad|od)/.test(navigator.userAgent);
  const isAndroid = /Android/.test(navigator.userAgent);
  await setDoc(
    doc(client.db, `users/${uid}/tokens/${token}`),
    {
      token,
      platform: isIOS ? "ios-pwa" : isAndroid ? "android-pwa" : "web",
      userAgent: navigator.userAgent.slice(0, 500),
      createdAt: serverTimestamp(),
      lastSeenAt: serverTimestamp(),
    },
    { merge: true },
  );
}

export async function deleteUserDataRemote() {
  const client = getFirebaseClient();
  if (!client) return;
  const callable = httpsCallable(getFunctions(client.app, "asia-northeast3"), "deleteUserData");
  await callable();
}

export async function takeQueuedResolutions(): Promise<
  Array<{ id: IDBValidKey; entryId: string; outcome: "occurred" | "not_occurred" }>
> {
  if (!("indexedDB" in window)) return [];
  return new Promise((resolve) => {
    const request = indexedDB.open("oneulgam-sw", 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains("pending")) {
        request.result.createObjectStore("pending", { keyPath: "id", autoIncrement: true });
      }
    };
    request.onerror = () => resolve([]);
    request.onsuccess = () => {
      const database = request.result;
      const transaction = database.transaction("pending", "readwrite");
      const store = transaction.objectStore("pending");
      const all = store.getAll();
      all.onsuccess = () => {
        const values = (all.result ?? []) as Array<{
          id: IDBValidKey;
          entryId: string;
          outcome: "occurred" | "not_occurred";
        }>;
        store.clear();
        transaction.oncomplete = () => resolve(values);
      };
      transaction.onerror = () => resolve([]);
    };
  });
}
