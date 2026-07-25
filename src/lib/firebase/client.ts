"use client";

import { getApp, getApps, initializeApp, type FirebaseApp } from "firebase/app";
import { initializeAppCheck, ReCaptchaV3Provider } from "firebase/app-check";
import { connectAuthEmulator, getAuth, type Auth } from "firebase/auth";
import {
  connectFirestoreEmulator,
  getFirestore,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  type Firestore,
} from "firebase/firestore";

export interface FirebaseClient {
  app: FirebaseApp;
  auth: Auth;
  db: Firestore;
}

let client: FirebaseClient | null | undefined;
let emulatorsConnected = false;
let appCheckInitialized = false;

export function isFirebaseConfigured() {
  return Boolean(
    process.env.NEXT_PUBLIC_FB_API_KEY &&
      process.env.NEXT_PUBLIC_FB_PROJECT_ID &&
      process.env.NEXT_PUBLIC_FB_APP_ID,
  );
}

export function getFirebaseClient(): FirebaseClient | null {
  if (client !== undefined) return client;
  if (!isFirebaseConfigured() || typeof window === "undefined") {
    client = null;
    return client;
  }

  const config = {
    apiKey: process.env.NEXT_PUBLIC_FB_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FB_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FB_PROJECT_ID,
    storageBucket: process.env.NEXT_PUBLIC_FB_STORAGE_BUCKET,
    messagingSenderId: process.env.NEXT_PUBLIC_FB_MSG_SENDER_ID,
    appId: process.env.NEXT_PUBLIC_FB_APP_ID,
  };
  const app = getApps().length ? getApp() : initializeApp(config);
  let db: Firestore;
  try {
    db = initializeFirestore(app, {
      localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
    });
  } catch {
    db = getFirestore(app);
  }
  const auth = getAuth(app);

  if (process.env.NEXT_PUBLIC_USE_EMULATOR === "true" && !emulatorsConnected) {
    connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
    connectFirestoreEmulator(db, "127.0.0.1", 8080);
    emulatorsConnected = true;
  }

  const recaptchaKey = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY;
  if (recaptchaKey && !appCheckInitialized) {
    if (process.env.NODE_ENV !== "production") {
      Object.assign(globalThis, { FIREBASE_APPCHECK_DEBUG_TOKEN: true });
    }
    initializeAppCheck(app, {
      provider: new ReCaptchaV3Provider(recaptchaKey),
      isTokenAutoRefreshEnabled: true,
    });
    appCheckInitialized = true;
  }

  client = { app, auth, db };
  return client;
}
