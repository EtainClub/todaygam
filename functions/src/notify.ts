import { getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getMessaging } from "firebase-admin/messaging";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { slotFor, todayIdFor } from "./shared.js";

if (!getApps().length) initializeApp();
const db = getFirestore();

export const sendMorning = onSchedule(
  { schedule: "every 15 minutes", timeZone: "Asia/Seoul" },
  async () => dispatch("morning"),
);

export const sendEvening = onSchedule(
  { schedule: "every 15 minutes", timeZone: "Asia/Seoul" },
  async () => dispatch("evening"),
);

export const sendUnresolved = onSchedule(
  { schedule: "every 15 minutes", timeZone: "Etc/UTC" },
  async () => dispatchUnresolved(),
);

async function dispatch(kind: "morning" | "evening") {
  const flag = kind === "morning" ? "notify.morningEnabled" : "notify.eveningEnabled";
  const timeField = kind === "morning" ? "notify.morningHHmm" : "notify.eveningHHmm";
  const users = await db.collection("users").where(flag, "==", true).get();

  for (const user of users.docs) {
    const profile = user.data();
    const timeZone = typeof profile.timezone === "string" ? profile.timezone : "Asia/Seoul";
    if (profile.notify?.[timeField.split(".")[1] ?? ""] !== slotFor(timeZone)) continue;
    const date = todayIdFor(timeZone);
    const day = await db.doc(`users/${user.id}/days/${date}`).get();
    const summary = day.data();
    if (kind === "morning" && summary && summary.fixedAnswered >= 3) continue;
    if (kind === "evening" && (!summary || summary.pendingCount <= 0)) continue;

    const tokenSnapshot = await db.collection(`users/${user.id}/tokens`).get();
    if (tokenSnapshot.empty) continue;
    let entryId = "";
    let preview = "";
    if (kind === "evening") {
      const pending = await db
        .collection(`users/${user.id}/entries`)
        .where("outcome", "==", "pending")
        .where("date", "==", date)
        .limit(1)
        .get();
      const entry = pending.docs[0];
      if (entry) {
        entryId = entry.id;
        preview = entry.data().questionLabel ?? entry.data().text ?? "";
      }
    }
    await getMessaging().sendEachForMulticast({
      tokens: tokenSnapshot.docs.map((token) => token.id),
      data: { kind, date, uid: user.id, deepLink: "/", entryId, preview },
      webpush: { headers: { Urgency: "normal", TTL: "10800" } },
    });
  }
}

async function dispatchUnresolved() {
  const users = await db
    .collection("users")
    .where("notify.unresolvedEnabled", "==", true)
    .get();
  const now = new Date();
  for (const user of users.docs) {
    const timeZone = user.data().timezone || "Asia/Seoul";
    if (slotFor(timeZone, now) !== "09:30") continue;
    const yesterday = todayIdFor(timeZone, new Date(now.getTime() - 24 * 60 * 60 * 1000));
    const day = await db.doc(`users/${user.id}/days/${yesterday}`).get();
    const pending = day.data()?.pendingCount ?? 0;
    if (pending <= 0) continue;
    const tokens = await db.collection(`users/${user.id}/tokens`).get();
    if (tokens.empty) continue;
    const notificationRef = db.doc(
      `users/${user.id}/notificationLog/unresolved-${yesterday}`,
    );
    const claimed = await db.runTransaction(async (transaction) => {
      const existing = await transaction.get(notificationRef);
      if (existing.exists) return false;
      transaction.set(notificationRef, {
        kind: "unresolved",
        date: yesterday,
        claimedAt: new Date(),
      });
      return true;
    });
    if (!claimed) continue;
    await getMessaging().sendEachForMulticast({
      tokens: tokens.docs.map((token) => token.id),
      data: {
        kind: "unresolved",
        date: yesterday,
        uid: user.id,
        deepLink: "/",
        preview: `어제 확인하지 않은 감 ${pending}개가 있어요`,
      },
      webpush: { headers: { Urgency: "normal", TTL: "10800" } },
    });
  }
}
