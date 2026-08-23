"use client";

/**
 * The Toss build ships firebase/firestore/lite (see next.config.ts), which
 * has no onSnapshot. src/lib/firebase/sync.ts falls back to one-shot reads
 * that re-run whenever a local write happens, instead of a real listener.
 * Writers (entries.ts) call notifyFirestoreWrite() after every successful
 * commit; watchers subscribe with onFirestoreWrite().
 */
const writeListeners = new Set<() => void>();

export function notifyFirestoreWrite() {
  writeListeners.forEach((listener) => listener());
}

export function onFirestoreWrite(listener: () => void) {
  writeListeners.add(listener);
  return () => writeListeners.delete(listener);
}
