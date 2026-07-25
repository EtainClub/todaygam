"use client";

import {
  GoogleAuthProvider,
  linkWithPopup,
  onAuthStateChanged,
  signInWithCredential,
  signInAnonymously,
  type User,
} from "firebase/auth";
import { FirebaseError } from "firebase/app";
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
      linkPromptShownAt: null,
      appVersion: "1.0.0",
      updatedAt: serverTimestamp(),
    });
  }
  return user;
}

export async function connectGoogleAccount(): Promise<{
  user: User;
  mode: "linked" | "signed-in" | "already-linked";
}> {
  const client = getFirebaseClient();
  if (!client?.auth.currentUser) throw new Error("Firebase가 설정되지 않았습니다.");
  if (!client.auth.currentUser.isAnonymous) {
    return { user: client.auth.currentUser, mode: "already-linked" };
  }

  const provider = new GoogleAuthProvider();
  let result;
  let mode: "linked" | "signed-in" = "linked";
  try {
    result = await linkWithPopup(client.auth.currentUser, provider);
  } catch (error) {
    const canSignIn =
      error instanceof FirebaseError &&
      ["auth/credential-already-in-use", "auth/account-exists-with-different-credential"].includes(error.code);
    const credential = error instanceof FirebaseError
      ? GoogleAuthProvider.credentialFromError(error)
      : null;
    if (!canSignIn || !credential) throw error;
    result = await signInWithCredential(client.auth, credential);
    mode = "signed-in";
  }

  await setDoc(
    doc(client.db, `users/${result.user.uid}`),
    {
      authProvider: "google",
      updatedAt: serverTimestamp(),
      ...(mode === "linked" ? {} : { lastSignedInAt: serverTimestamp() }),
    },
    { merge: true },
  );
  return { user: result.user, mode };
}

export function observeAuth(callback: (user: User | null) => void) {
  const client = getFirebaseClient();
  if (!client) return () => undefined;
  return onAuthStateChanged(client.auth, callback);
}
