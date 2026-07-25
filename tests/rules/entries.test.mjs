import assert from "node:assert/strict";
import { after, before, beforeEach, describe, it } from "node:test";
import { readFileSync } from "node:fs";
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
} from "@firebase/rules-unit-testing";
import {
  deleteDoc,
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
  updateDoc,
} from "firebase/firestore";

const projectId = "oneulgam-rules-test";
let environment;

function validEntry(id = "entry-1", patch = {}) {
  return {
    id,
    type: "fixed",
    date: "2026-07-25",
    timezone: "Asia/Seoul",
    questionKey: "rain",
    questionLabel: "비가 올까?",
    answer: "yes",
    text: null,
    strength: "medium",
    createdAt: serverTimestamp(),
    lockedAt: serverTimestamp(),
    contentHash: `sha256:${"a".repeat(64)}`,
    remainingMinutes: 710,
    outcome: "pending",
    outcomeNote: null,
    resolvedAt: null,
    deletedAt: null,
    ...patch,
  };
}

function dbAs(uid) {
  return environment.authenticatedContext(uid).firestore();
}

function entryRef(db, uid = "alice", id = "entry-1") {
  return doc(db, `users/${uid}/entries/${id}`);
}

before(async () => {
  const [host, port] = (process.env.FIRESTORE_EMULATOR_HOST || "127.0.0.1:8080").split(":");
  environment = await initializeTestEnvironment({
    projectId,
    firestore: {
      host,
      port: Number(port),
      rules: readFileSync("firestore.rules", "utf8"),
    },
  });
});

beforeEach(async () => {
  await environment.clearFirestore();
});

after(async () => {
  await environment.cleanup();
});

describe("immutable entries", { concurrency: false }, () => {
  it("1. lets an owner create with server timestamps", async () => {
    const db = dbAs("alice");
    await assertSucceeds(setDoc(entryRef(db), validEntry()));
  });

  it("2. rejects writes into another uid", async () => {
    const db = dbAs("bob");
    await assertFails(setDoc(entryRef(db, "alice"), validEntry()));
  });

  it("3. rejects a past createdAt", async () => {
    const db = dbAs("alice");
    await assertFails(setDoc(entryRef(db), validEntry("entry-1", { createdAt: new Date("2020-01-01") })));
  });

  it("4. rejects a resolved entry at creation", async () => {
    const db = dbAs("alice");
    await assertFails(setDoc(entryRef(db), validEntry("entry-1", { outcome: "occurred" })));
  });

  it("5. freezes text", async () => {
    const db = dbAs("alice");
    await assertSucceeds(setDoc(entryRef(db), validEntry()));
    await assertFails(updateDoc(entryRef(db), { text: "바꾼 문장" }));
  });

  it("6. freezes the answer", async () => {
    const db = dbAs("alice");
    await assertSucceeds(setDoc(entryRef(db), validEntry()));
    await assertFails(updateDoc(entryRef(db), { answer: "no" }));
  });

  it("7. freezes strength", async () => {
    const db = dbAs("alice");
    await assertSucceeds(setDoc(entryRef(db), validEntry()));
    await assertFails(updateDoc(entryRef(db), { strength: "strong" }));
  });

  it("8. permits pending to occurred once", async () => {
    const db = dbAs("alice");
    await assertSucceeds(setDoc(entryRef(db), validEntry()));
    await assertSucceeds(updateDoc(entryRef(db), { outcome: "occurred", outcomeNote: null, resolvedAt: serverTimestamp() }));
  });

  it("9. rejects rejudging occurred to not_occurred", async () => {
    const db = dbAs("alice");
    await assertSucceeds(setDoc(entryRef(db), validEntry()));
    await assertSucceeds(updateDoc(entryRef(db), { outcome: "occurred", outcomeNote: null, resolvedAt: serverTimestamp() }));
    await assertFails(updateDoc(entryRef(db), { outcome: "not_occurred", resolvedAt: serverTimestamp() }));
  });

  it("10. permits editing only the note after resolution", async () => {
    const db = dbAs("alice");
    await assertSucceeds(setDoc(entryRef(db), validEntry()));
    await assertSucceeds(updateDoc(entryRef(db), { outcome: "occurred", outcomeNote: null, resolvedAt: serverTimestamp() }));
    await assertSucceeds(updateDoc(entryRef(db), { outcomeNote: "저녁에 확인" }));
  });

  it("11. rejects deleting a resolved entry", async () => {
    const db = dbAs("alice");
    await assertSucceeds(setDoc(entryRef(db), validEntry()));
    await assertSucceeds(updateDoc(entryRef(db), { outcome: "occurred", outcomeNote: null, resolvedAt: serverTimestamp() }));
    await assertFails(updateDoc(entryRef(db), { deletedAt: serverTimestamp() }));
  });

  it("12. permits soft-deleting a pending entry", async () => {
    const db = dbAs("alice");
    await assertSucceeds(setDoc(entryRef(db), validEntry()));
    await assertSucceeds(updateDoc(entryRef(db), { deletedAt: serverTimestamp() }));
  });

  it("13. rejects physical deletion", async () => {
    const db = dbAs("alice");
    await assertSucceeds(setDoc(entryRef(db), validEntry()));
    await assertFails(deleteDoc(entryRef(db)));
  });

  it("14. rejects client rollup writes", async () => {
    const db = dbAs("alice");
    await assertFails(setDoc(doc(db, "users/alice/stats/rollup"), { version: 2 }));
  });

  it("15. rejects a 61-character free entry", async () => {
    const db = dbAs("alice");
    const value = validEntry("free-1", {
      id: "free-1",
      type: "free",
      questionKey: null,
      questionLabel: null,
      answer: null,
      text: "가".repeat(61),
    });
    await assertFails(setDoc(entryRef(db, "alice", "free-1"), value));
  });

  it("16. rejects text on a fixed entry", async () => {
    const db = dbAs("alice");
    await assertFails(setDoc(entryRef(db), validEntry("entry-1", { text: "있으면 안 됨" })));
  });

  it("17. rejects unauthenticated reads", async () => {
    await environment.withSecurityRulesDisabled(async (context) => {
      await setDoc(entryRef(context.firestore()), { marker: true });
    });
    const db = environment.unauthenticatedContext().firestore();
    await assert.rejects(() => assertSucceeds(getDoc(entryRef(db))));
  });
});
