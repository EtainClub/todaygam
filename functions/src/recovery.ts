import { createHash, randomBytes } from "node:crypto";
import { getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { HttpsError, onCall } from "firebase-functions/v2/https";

if (!getApps().length) initializeApp();

// Unambiguous alphabet: no 0/O/1/I/L.
const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const CODE_GROUPS = 4;
const CODE_GROUP_LENGTH = 4;

export function generateRecoveryCode(): string {
  const bytes = randomBytes(CODE_GROUPS * CODE_GROUP_LENGTH);
  const chars: string[] = [];
  for (const byte of bytes) {
    chars.push(CODE_ALPHABET[byte % CODE_ALPHABET.length] as string);
  }
  const groups: string[] = [];
  for (let i = 0; i < chars.length; i += CODE_GROUP_LENGTH) {
    groups.push(chars.slice(i, i + CODE_GROUP_LENGTH).join(""));
  }
  return groups.join("-");
}

export function hashRecoveryCode(code: string): string {
  const normalized = code.toUpperCase().replace(/[^A-Z0-9]/g, "");
  return createHash("sha256").update(normalized).digest("hex");
}

export const generateRecoveryKey = onCall(async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "로그인이 필요합니다.");
  const uid = request.auth.uid;
  const db = getFirestore();
  const code = generateRecoveryCode();
  const hash = hashRecoveryCode(code);

  const userRef = db.doc(`users/${uid}`);
  const previous = await userRef.get();
  const previousHash = previous.data()?.recoveryKeyHash as string | undefined;

  const batch = db.batch();
  if (previousHash) batch.delete(db.doc(`recoveryKeys/${previousHash}`));
  batch.set(db.doc(`recoveryKeys/${hash}`), {
    uid,
    createdAt: FieldValue.serverTimestamp(),
  });
  batch.set(
    userRef,
    {
      recoveryKeyHash: hash,
      recoveryKeyIssuedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true },
  );
  await batch.commit();

  return { code };
});

export const redeemRecoveryKey = onCall(async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "로그인이 필요합니다.");
  const code = String(request.data?.code ?? "").trim();
  if (!code) throw new HttpsError("invalid-argument", "복구 키를 입력해 주세요.");

  const db = getFirestore();
  const hash = hashRecoveryCode(code);
  const keyDoc = await db.doc(`recoveryKeys/${hash}`).get();
  if (!keyDoc.exists) {
    throw new HttpsError("not-found", "복구 키를 찾을 수 없어요. 다시 확인해 주세요.");
  }
  const targetUid = keyDoc.data()?.uid as string;

  const callerUid = request.auth.uid;
  const callerIsAnonymous = request.auth.token.firebase?.sign_in_provider === "anonymous";
  if (callerUid !== targetUid && callerIsAnonymous) {
    await getAuth()
      .deleteUser(callerUid)
      .catch(() => undefined);
  }

  const token = await getAuth().createCustomToken(targetUid);
  return { token, uid: targetUid };
});
