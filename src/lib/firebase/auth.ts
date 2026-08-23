"use client";

import {
  onIdTokenChanged,
  signInAnonymously,
  signInWithCustomToken,
  signOut,
  type User,
} from "firebase/auth";
import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import { getFirebaseClient } from "./client";

export async function ensureAnonymousUser(timezone: string): Promise<User | null> {
  const client = getFirebaseClient();
  if (!client) return null;
  const user = client.auth.currentUser ?? (await signInAnonymously(client.auth)).user;
  const ref = doc(client.db, `users/${user.uid}`);
  const snapshot = await getDoc(ref);
  if (!snapshot.exists()) {
    await setDoc(ref, {
      createdAt: serverTimestamp(),
      timezone,
      onboardedAt: null,
      authProvider: "anonymous",
      notify: {
        morningEnabled: false,
        morningHHmm: "08:00",
        eveningEnabled: false,
        eveningHHmm: "21:00",
        unresolvedEnabled: true,
      },
      streak: { current: 0, longest: 0, lastCompletedDate: null },
      appVersion: "1.0.0",
      updatedAt: serverTimestamp(),
    });
  }
  return user;
}

export function observeAuth(callback: (user: User | null) => void) {
  const client = getFirebaseClient();
  if (!client) return () => undefined;
  return onIdTokenChanged(client.auth, callback);
}

export async function signInWithRecoveryToken(token: string): Promise<User> {
  const client = getFirebaseClient();
  if (!client) throw new Error("Firebase가 설정되지 않았습니다.");
  await signOut(client.auth);
  const result = await signInWithCustomToken(client.auth, token);
  return result.user;
}
