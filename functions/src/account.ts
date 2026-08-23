import { getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { HttpsError, onCall } from "firebase-functions/v2/https";

if (!getApps().length) initializeApp();

export const deleteUserData = onCall(async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "로그인이 필요합니다.");
  const uid = request.auth.uid;
  const db = getFirestore();
  const userDoc = await db.doc(`users/${uid}`).get();
  const recoveryKeyHash = userDoc.data()?.recoveryKeyHash as string | undefined;
  if (recoveryKeyHash) await db.doc(`recoveryKeys/${recoveryKeyHash}`).delete();
  await db.recursiveDelete(db.doc(`users/${uid}`));
  await getAuth().deleteUser(uid);
  return { ok: true };
});
