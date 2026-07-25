"use client";

import {
  collection,
  doc,
  increment,
  serverTimestamp,
  writeBatch,
} from "firebase/firestore";
import type { Entry } from "../types";
import { isHit } from "../stats";
import { getFirebaseClient } from "./client";

export async function createEntryRemote(uid: string, entry: Entry) {
  const client = getFirebaseClient();
  if (!client) return;
  const entryRef = doc(client.db, `users/${uid}/entries/${entry.id}`);
  const dayRef = doc(client.db, `users/${uid}/days/${entry.date}`);
  const batch = writeBatch(client.db);
  const dayData: Record<string, unknown> = {
    date: entry.date,
    timezone: entry.timezone,
    fixedTotal: entry.type === "fixed" ? 3 : 0,
    fixedAnswered: increment(entry.type === "fixed" ? 1 : 0),
    freeCount: increment(entry.type === "free" ? 1 : 0),
    pendingCount: increment(1),
    updatedAt: serverTimestamp(),
  };
  if (entry.type === "fixed") dayData.morningCompletedAt = serverTimestamp();
  batch.set(entryRef, {
    ...entry,
    createdAt: serverTimestamp(),
    lockedAt: serverTimestamp(),
    resolvedAt: null,
  });
  batch.set(
    dayRef,
    dayData,
    { merge: true },
  );
  await batch.commit();
}

export async function resolveEntryRemote(
  uid: string,
  entry: Entry,
  outcome: Exclude<Entry["outcome"], "pending">,
  note: string | null,
) {
  const client = getFirebaseClient();
  if (!client) return;
  const batch = writeBatch(client.db);
  const resolved = { ...entry, outcome };
  const hit = isHit(resolved);
  batch.update(doc(client.db, `users/${uid}/entries/${entry.id}`), {
    outcome,
    outcomeNote: note,
    resolvedAt: serverTimestamp(),
  });
  batch.set(
    doc(client.db, `users/${uid}/days/${entry.date}`),
    {
      resolvedCount: increment(1),
      pendingCount: increment(-1),
      hitCount: increment(hit === true ? 1 : 0),
      missCount: increment(hit === false ? 1 : 0),
      uncertainCount: increment(outcome === "uncertain" ? 1 : 0),
      eveningCompletedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );
  await batch.commit();
}

export async function updateOutcomeNoteRemote(uid: string, entryId: string, note: string | null) {
  const client = getFirebaseClient();
  if (!client) return;
  const batch = writeBatch(client.db);
  batch.update(doc(client.db, `users/${uid}/entries/${entryId}`), { outcomeNote: note });
  await batch.commit();
}

export async function softDeleteEntryRemote(uid: string, entry: Entry) {
  const client = getFirebaseClient();
  if (!client) return;
  const batch = writeBatch(client.db);
  batch.update(doc(client.db, `users/${uid}/entries/${entry.id}`), {
    deletedAt: serverTimestamp(),
  });
  batch.set(doc(collection(client.db, `users/${uid}/audit`)), {
    action: "entry_deleted",
    entryId: entry.id,
    createdAt: serverTimestamp(),
  });
  await batch.commit();
}
