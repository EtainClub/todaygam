import { createHash } from "node:crypto";
import { getApps, initializeApp } from "firebase-admin/app";
import { getFirestore, Timestamp } from "firebase-admin/firestore";

process.env.FIRESTORE_EMULATOR_HOST ||= "127.0.0.1:8080";
const projectId = "oneulgam-dev";
if (!getApps().length) initializeApp({ projectId });
const db = getFirestore();
const uid = "demo-user";
const questions = [
  { key: "contact_unexpected", label: "예상하지 못한 연락이 올까?", yesLabel: "올 것 같다", noLabel: "아닐 것 같다" },
  { key: "schedule_change", label: "일정 하나가 바뀔까?", yesLabel: "바뀔 것 같다", noLabel: "아닐 것 같다" },
  { key: "rain", label: "비가 올까?", yesLabel: "올 것 같다", noLabel: "아닐 것 같다" },
];
const strength = ["faint", "medium", "strong"];
const now = new Date("2026-07-25T03:00:00.000Z");
const batch = db.batch();
const stats = {
  version: 2,
  updatedAt: Timestamp.fromDate(now),
  totals: { days: 60, created: 180, resolved: 180, hit: 0, miss: 0, uncertain: 0 },
  byQuestion: {},
  byStrength: {
    faint: { hit: 0, total: 0 },
    medium: { hit: 0, total: 0 },
    strong: { hit: 0, total: 0 },
  },
};

batch.set(db.doc(`users/${uid}`), {
  createdAt: Timestamp.fromDate(new Date("2026-05-27T00:00:00.000Z")),
  timezone: "Asia/Seoul",
  onboardedAt: Timestamp.fromDate(new Date("2026-05-27T00:01:00.000Z")),
  authProvider: "anonymous",
  notify: {
    morningEnabled: true,
    morningHHmm: "08:00",
    eveningEnabled: true,
    eveningHHmm: "21:00",
    unresolvedEnabled: true,
  },
  streak: { current: 60, longest: 60, lastCompletedDate: "2026-07-25" },
  linkPromptShownAt: null,
  appVersion: "1.0.0",
  updatedAt: Timestamp.fromDate(now),
});

questions.forEach((question, order) => {
  batch.set(db.doc(`users/${uid}/questions/${question.key}`), {
    ...question,
    order,
    active: true,
    createdAt: Timestamp.fromDate(new Date("2026-05-27T00:01:00.000Z")),
    deactivatedAt: null,
  });
  stats.byQuestion[question.key] = {
    label: question.label,
    yesOccurred: 0,
    yesNotOccurred: 0,
    noOccurred: 0,
    noNotOccurred: 0,
    uncertain: 0,
  };
});

for (let dayIndex = 0; dayIndex < 60; dayIndex += 1) {
  const date = new Date(now.getTime() - (59 - dayIndex) * 86_400_000);
  const dateId = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
  let hitCount = 0;
  questions.forEach((question, questionIndex) => {
    const answer = (dayIndex + questionIndex) % 2 === 0 ? "yes" : "no";
    const threshold = question.key === "contact_unexpected"
      ? answer === "yes" ? 7 : 4
      : question.key === "rain"
        ? 5
        : answer === "yes" ? 6 : 5;
    const occurred = ((dayIndex * 7 + questionIndex * 3) % 10) < threshold;
    const outcome = occurred ? "occurred" : "not_occurred";
    const entryStrength = strength[(dayIndex + questionIndex) % 3];
    const hit = (answer === "yes" && occurred) || (answer === "no" && !occurred);
    if (hit) hitCount += 1;
    stats.totals[hit ? "hit" : "miss"] += 1;
    stats.byStrength[entryStrength].total += 1;
    if (hit) stats.byStrength[entryStrength].hit += 1;
    const table = stats.byQuestion[question.key];
    table[`${answer}${occurred ? "Occurred" : "NotOccurred"}`] += 1;
    const id = `${dateId}-${question.key}`;
    const createdAt = new Date(`${dateId}T08:00:00+09:00`);
    const canonical = JSON.stringify({
      v: 1,
      type: "fixed",
      date: dateId,
      questionKey: question.key,
      answer,
      text: null,
      strength: entryStrength,
      createdAt: createdAt.toISOString(),
    });
    batch.set(db.doc(`users/${uid}/entries/${id}`), {
      id,
      type: "fixed",
      date: dateId,
      timezone: "Asia/Seoul",
      questionKey: question.key,
      questionLabel: question.label,
      answer,
      text: null,
      strength: entryStrength,
      createdAt: Timestamp.fromDate(createdAt),
      lockedAt: Timestamp.fromDate(createdAt),
      contentHash: `sha256:${createHash("sha256").update(canonical).digest("hex")}`,
      remainingMinutes: 960,
      outcome,
      outcomeNote: null,
      resolvedAt: Timestamp.fromDate(new Date(`${dateId}T21:00:00+09:00`)),
      deletedAt: null,
    });
  });
  batch.set(db.doc(`users/${uid}/days/${dateId}`), {
    date: dateId,
    timezone: "Asia/Seoul",
    fixedTotal: 3,
    fixedAnswered: 3,
    freeCount: 0,
    resolvedCount: 3,
    pendingCount: 0,
    hitCount,
    missCount: 3 - hitCount,
    uncertainCount: 0,
    morningCompletedAt: Timestamp.fromDate(new Date(`${dateId}T08:03:00+09:00`)),
    eveningCompletedAt: Timestamp.fromDate(new Date(`${dateId}T21:03:00+09:00`)),
    updatedAt: Timestamp.fromDate(new Date(`${dateId}T21:03:00+09:00`)),
  });
}

batch.set(db.doc(`users/${uid}/stats/rollup`), stats);
await batch.commit();
console.log(`Seeded 60 days / 180 entries for ${uid} at ${process.env.FIRESTORE_EMULATOR_HOST}`);
