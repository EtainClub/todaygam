"use client";

import { httpsCallable, getFunctions } from "firebase/functions";
import { getMessaging, getToken, isSupported } from "firebase/messaging";
import {
  collection,
  doc,
  getDoc,
  getDocFromServer,
  getDocs,
  getDocsFromServer,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  where,
  writeBatch,
  type DocumentData,
  type DocumentSnapshot,
  type Timestamp,
} from "firebase/firestore";
import type { DaySummary, Entry, NotifySettings, Question, Rollup } from "../types";
import {
  firebaseFunctionsRegion,
  firebaseVapidKey,
  getFirebaseClient,
} from "./client";
import { createEntryRemote, resolveEntryRemote } from "./entries";
import { IS_TOSS_APP } from "../platform";
import { onFirestoreWrite } from "./toss-live";

function toIso(value: Timestamp | string | null | undefined, fallback: string | null = null) {
  if (typeof value === "string") return value;
  if (value && typeof value.toDate === "function") return value.toDate().toISOString();
  return fallback;
}

function mapEntry(id: string, data: DocumentData): Entry {
  const optimisticNow = new Date().toISOString();
  const createdAt = toIso(data.createdAt, optimisticNow) ?? optimisticNow;
  return {
    ...(data as Entry),
    id,
    createdAt,
    clientCreatedAt:
      typeof data.clientCreatedAt === "string" ? data.clientCreatedAt : createdAt,
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
  const emit = () => {
    if (!groups.has("month") || !groups.has("unresolved")) return;
    callback(Array.from(groups.values()).flat());
  };
  const monthQuery = query(collection(client.db, `users/${uid}/entries`), where("date", ">=", firstOfMonth));
  const unresolvedQuery = query(
    collection(client.db, `users/${uid}/entries`),
    where("outcome", "==", "pending"),
    where("date", "<", firstOfMonth),
  );

  if (IS_TOSS_APP) {
    const refetch = () => {
      void Promise.all([getDocs(monthQuery), getDocs(unresolvedQuery)]).then(
        ([monthSnapshot, unresolvedSnapshot]) => {
          groups.set("month", monthSnapshot.docs.map((item) => mapEntry(item.id, item.data())));
          groups.set("unresolved", unresolvedSnapshot.docs.map((item) => mapEntry(item.id, item.data())));
          emit();
        },
      );
    };
    refetch();
    return onFirestoreWrite(refetch);
  }

  const stopMonth = onSnapshot(monthQuery, (snapshot) => {
    groups.set("month", snapshot.docs.map((item) => mapEntry(item.id, item.data())));
    emit();
  });
  const stopUnresolved = onSnapshot(unresolvedQuery, (snapshot) => {
    groups.set("unresolved", snapshot.docs.map((item) => mapEntry(item.id, item.data())));
    emit();
  });
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
  const daysQuery = query(
    collection(client.db, `users/${uid}/days`),
    where("date", ">=", `${prefix}-01`),
    where("date", "<=", `${prefix}-31`),
  );
  const apply = (snapshot: { docs: { data: () => DocumentData }[] }) =>
    callback(snapshot.docs.map((item) => item.data() as DaySummary));
  if (IS_TOSS_APP) {
    const refetch = () => void getDocs(daysQuery).then(apply);
    refetch();
    return onFirestoreWrite(refetch);
  }
  return onSnapshot(daysQuery, apply);
}

export function observeRollup(uid: string, callback: (rollup: Rollup | null) => void) {
  const client = getFirebaseClient();
  if (!client) return () => undefined;
  const ref = doc(client.db, `users/${uid}/stats/rollup`);
  const apply = (snapshot: DocumentSnapshot<DocumentData>) => {
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
  };
  if (IS_TOSS_APP) {
    const refetch = () => void getDoc(ref).then(apply);
    refetch();
    // stats/rollup is written by a Cloud Functions trigger, not by the entry
    // write itself — give the trigger a beat before trusting the refetch.
    return onFirestoreWrite(() => {
      refetch();
      window.setTimeout(refetch, 2000);
    });
  }
  return onSnapshot(ref, apply);
}

export function observeSystemConfig(callback: (questions: Question[]) => void) {
  const client = getFirebaseClient();
  if (!client) return () => undefined;
  const ref = doc(client.db, "system/config");
  const apply = (data: DocumentData | undefined) => {
    const catalog = data?.questionCatalog;
    if (Array.isArray(catalog) && catalog.length > 0) {
      callback(
        (catalog as Question[])
          .filter((question) => question.enabled)
          .sort((a, b) => a.order - b.order),
      );
    }
  };
  if (IS_TOSS_APP) {
    void getDoc(ref).then((snapshot) => apply(snapshot.data()));
    return () => undefined;
  }
  return onSnapshot(ref, (snapshot) => apply(snapshot.data()));
}

export async function loadRemotePreferences(uid: string): Promise<{
  onboarded: boolean;
  timezone: string | null;
  notify: NotifySettings | null;
  selectedQuestionKeys: string[];
  questionLabels: Record<string, string>;
  recoveryKeyIssuedAt: string | null;
} | null> {
  const client = getFirebaseClient();
  if (!client) return null;
  const [profile, questions] = await Promise.all([
    getDoc(doc(client.db, `users/${uid}`)),
    getDocs(collection(client.db, `users/${uid}/questions`)),
  ]);
  if (!profile.exists()) return null;
  const data = profile.data();
  const onboarded = Boolean(data.onboardedAt);
  const selectedQuestionKeys = questions.docs
    .filter((item) => item.data().active === true)
    .sort((a, b) => Number(a.data().order ?? 0) - Number(b.data().order ?? 0))
    .map((item) => item.id)
    .slice(0, 3);
  const questionLabels = Object.fromEntries(
    questions.docs.flatMap((item) => {
      const label = item.data().label;
      return typeof label === "string" && label.trim()
        ? [[item.id, label.trim().slice(0, 40)]]
        : [];
    }),
  );
  return {
    onboarded,
    timezone: onboarded && typeof data.timezone === "string" ? data.timezone : null,
    notify: onboarded ? data.notify as NotifySettings | null : null,
    selectedQuestionKeys: onboarded ? selectedQuestionKeys : [],
    questionLabels: onboarded ? questionLabels : {},
    recoveryKeyIssuedAt: toIso(data.recoveryKeyIssuedAt),
  };
}

export async function syncPreferencesRemote(values: {
  uid: string;
  timezone: string;
  onboarded: boolean;
  notify: NotifySettings;
  selectedQuestionKeys: string[];
  questionLabels: Record<string, string>;
  catalog: Question[];
}) {
  const client = getFirebaseClient();
  if (!client) return;
  const {
    uid,
    timezone,
    onboarded,
    notify,
    selectedQuestionKeys,
    questionLabels,
    catalog,
  } = values;
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
        label: questionLabels[key] ?? previous?.label ?? question.label,
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

export async function migrateLocalEntriesRemote(uid: string, entries: Entry[]): Promise<number> {
  const client = getFirebaseClient();
  if (!client) return 0;
  const remote = await getDocs(collection(client.db, `users/${uid}/entries`));
  const existingIds = new Set(remote.docs.map((item) => item.id));
  let migrated = 0;

  for (const entry of entries) {
    if (existingIds.has(entry.id) || entry.deletedAt) continue;
    const pending: Entry = {
      ...entry,
      clientCreatedAt: entry.clientCreatedAt || entry.createdAt,
      outcome: "pending",
      outcomeNote: null,
      resolvedAt: null,
      deletedAt: null,
    };
    await createEntryRemote(uid, pending);
    if (entry.outcome !== "pending") {
      await resolveEntryRemote(uid, pending, entry.outcome, entry.outcomeNote);
    }
    existingIds.add(entry.id);
    migrated += 1;
  }
  return migrated;
}

function serializeFirestoreValue(value: unknown): unknown {
  if (value && typeof value === "object" && "toDate" in value) {
    const timestamp = value as { toDate: () => Date };
    return timestamp.toDate().toISOString();
  }
  if (Array.isArray(value)) return value.map(serializeFirestoreValue);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, child]) => [key, serializeFirestoreValue(child)]),
    );
  }
  return value;
}

export async function fetchFullExportRemote(uid: string) {
  const client = getFirebaseClient();
  if (!client) return null;
  // firestore/lite (Toss build) has no cache to bypass, and doesn't export
  // the *FromServer variants at all — plain getDoc/getDocs already always
  // hit the network there.
  const readDoc = IS_TOSS_APP ? getDoc : getDocFromServer;
  const readDocs = IS_TOSS_APP ? getDocs : getDocsFromServer;
  const [profile, questions, entries, days, rollup, audit] = await Promise.all([
    readDoc(doc(client.db, `users/${uid}`)),
    readDocs(collection(client.db, `users/${uid}/questions`)),
    readDocs(collection(client.db, `users/${uid}/entries`)),
    readDocs(collection(client.db, `users/${uid}/days`)),
    readDoc(doc(client.db, `users/${uid}/stats/rollup`)),
    readDocs(collection(client.db, `users/${uid}/audit`)),
  ]);
  return {
    profile: profile.exists() ? serializeFirestoreValue(profile.data()) : null,
    questions: questions.docs.map((item) => ({
      id: item.id,
      ...serializeFirestoreValue(item.data()) as Record<string, unknown>,
    })),
    entries: entries.docs.map((item) => mapEntry(item.id, item.data())),
    days: days.docs.map((item) => ({
      id: item.id,
      ...serializeFirestoreValue(item.data()) as Record<string, unknown>,
    })),
    rollup: rollup.exists() ? serializeFirestoreValue(rollup.data()) : null,
    audit: audit.docs.map((item) => ({
      id: item.id,
      ...serializeFirestoreValue(item.data()) as Record<string, unknown>,
    })),
  };
}

export async function generateRecoveryKeyRemote(): Promise<{ code: string }> {
  const client = getFirebaseClient();
  if (!client) throw new Error("Firebase가 설정되지 않았습니다.");
  const callable = httpsCallable<undefined, { code: string }>(
    getFunctions(client.app, firebaseFunctionsRegion),
    "generateRecoveryKey",
  );
  const result = await callable();
  return result.data;
}

export async function redeemRecoveryKeyRemote(code: string): Promise<{ token: string; uid: string }> {
  const client = getFirebaseClient();
  if (!client) throw new Error("Firebase가 설정되지 않았습니다.");
  const callable = httpsCallable<{ code: string }, { token: string; uid: string }>(
    getFunctions(client.app, firebaseFunctionsRegion),
    "redeemRecoveryKey",
  );
  const result = await callable({ code });
  return result.data;
}

export async function registerMessagingToken(uid: string) {
  const client = getFirebaseClient();
  if (
    !client ||
    !firebaseVapidKey ||
    !(await isSupported()) ||
    Notification.permission !== "granted"
  ) return;
  const registration = await navigator.serviceWorker.ready;
  const token = await getToken(getMessaging(client.app), {
    vapidKey: firebaseVapidKey,
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
  const callable = httpsCallable(
    getFunctions(client.app, firebaseFunctionsRegion),
    "deleteUserData",
  );
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
