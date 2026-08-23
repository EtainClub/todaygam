import { applicationDefault, getApps, initializeApp } from "firebase-admin/app";
import { FieldValue, getFirestore } from "firebase-admin/firestore";

const projectId =
  process.env.GCLOUD_PROJECT ||
  process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ||
  "oneulgam-dev";
if (!getApps().length) initializeApp({ credential: applicationDefault(), projectId });

const questionCatalog = [
  ["contact_unexpected", "예상하지 못한 연락이 올까?", true],
  ["schedule_change", "일정 하나가 바뀔까?", true],
  ["rain", "비가 올까?", true],
  ["good_news", "좋은 소식을 들을까?", false],
  ["conflict", "누군가와 의견이 부딪칠까?", false],
  ["find_lost", "찾던 것을 발견할까?", false],
  ["plan_cancel", "약속이 취소되거나 미뤄질까?", false],
  ["unexpected_spend", "예상 밖의 지출이 생길까?", false],
  ["long_walk", "평소보다 많이 걸을까?", false],
  ["mood_lift", "기분이 아침보다 나아질까?", false],
].map(([key, label, defaultSelected], order) => ({
  key,
  label,
  defaultSelected,
  order,
  enabled: true,
}));

await getFirestore().doc("system/config").set({
  questionCatalog,
  minAppVersion: "1.0.0",
  statsGate: { minPerArm: 10, minTotal: 25 },
  updatedAt: FieldValue.serverTimestamp(),
});

console.log(`Seeded system/config in ${projectId}`);
