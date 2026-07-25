import { getApps, initializeApp } from "firebase-admin/app";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { onDocumentCreated, onDocumentWritten } from "firebase-functions/v2/firestore";
import { expandFieldPaths, isHit, type EntryLike } from "./shared.js";

if (!getApps().length) initializeApp();
const db = getFirestore();

type RollupEntry = EntryLike & {
  strength: "faint" | "medium" | "strong";
  questionKey: string | null;
  questionLabel: string | null;
  deletedAt: unknown | null;
};

async function applyOnce(
  uid: string,
  eventId: string,
  update: Record<string, unknown>,
) {
  const safeEventId = eventId.replace(/[^a-zA-Z0-9_-]/g, "_");
  const eventRef = db.doc(`users/${uid}/statsEvents/${safeEventId}`);
  const rollupRef = db.doc(`users/${uid}/stats/rollup`);
  await db.runTransaction(async (transaction) => {
    const handled = await transaction.get(eventRef);
    if (handled.exists) return;
    transaction.set(eventRef, { handledAt: FieldValue.serverTimestamp() });
    transaction.set(rollupRef, expandFieldPaths(update), { merge: true });
  });
}

export const onEntryWritten = onDocumentWritten(
  "users/{uid}/entries/{entryId}",
  async (event) => {
    const before = event.data?.before.data() as RollupEntry | undefined;
    const after = event.data?.after.data() as RollupEntry | undefined;
    if (!after) return;

    const update: Record<string, unknown> = {
      version: 2,
      updatedAt: FieldValue.serverTimestamp(),
    };

    if (!before) {
      update["totals.created"] = FieldValue.increment(1);
    }

    const wasCounted = Boolean(before && before.outcome !== "pending" && !before.deletedAt);
    const isCounted = after.outcome !== "pending" && !after.deletedAt;
    if (wasCounted === isCounted) {
      if (Object.keys(update).length > 2) {
        await applyOnce(event.params.uid, event.id, update);
      }
      return;
    }

    const sign = isCounted ? 1 : -1;
    const source = isCounted ? after : before ?? after;
    const hit = isHit(source);
    if (hit !== null) {
      update[`byStrength.${source.strength}.total`] = FieldValue.increment(sign);
      if (hit) update[`byStrength.${source.strength}.hit`] = FieldValue.increment(sign);
      update["totals.resolved"] = FieldValue.increment(sign);
      update[hit ? "totals.hit" : "totals.miss"] = FieldValue.increment(sign);
    } else if (source.outcome === "uncertain") {
      update["totals.uncertain"] = FieldValue.increment(sign);
    }

    if (source.type === "fixed" && source.questionKey) {
      const key = source.questionKey;
      update[`byQuestion.${key}.label`] = source.questionLabel;
      if (source.outcome === "uncertain") {
        update[`byQuestion.${key}.uncertain`] = FieldValue.increment(sign);
      } else {
        const arm = source.answer === "yes" ? "yes" : "no";
        const tail = source.outcome === "occurred" ? "Occurred" : "NotOccurred";
        update[`byQuestion.${key}.${arm}${tail}`] = FieldValue.increment(sign);
      }
    }

    await applyOnce(event.params.uid, event.id, update);
  },
);

export const onDayCreated = onDocumentCreated(
  "users/{uid}/days/{date}",
  async (event) => {
    await applyOnce(
      event.params.uid,
      event.id,
      {
        version: 2,
        "totals.days": FieldValue.increment(1),
        updatedAt: FieldValue.serverTimestamp(),
      },
    );
  },
);
