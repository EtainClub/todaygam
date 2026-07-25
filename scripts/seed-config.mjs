import { applicationDefault, getApps, initializeApp } from "firebase-admin/app";
import { FieldValue, getFirestore } from "firebase-admin/firestore";

const projectId = process.env.GCLOUD_PROJECT || process.env.NEXT_PUBLIC_FB_PROJECT_ID || "oneulgam-dev";
if (!getApps().length) initializeApp({ credential: applicationDefault(), projectId });

const questionCatalog = [
  ["contact_unexpected", "예상하지 못한 연락이 올까?", "올 것 같다", "아닐 것 같다", true],
  ["schedule_change", "일정 하나가 바뀔까?", "바뀔 것 같다", "아닐 것 같다", true],
  ["rain", "비가 올까?", "올 것 같다", "아닐 것 같다", true],
  ["good_news", "좋은 소식을 들을까?", "들을 것 같다", "아닐 것 같다", false],
  ["conflict", "누군가와 의견이 부딪칠까?", "있을 것 같다", "아닐 것 같다", false],
  ["find_lost", "찾던 것을 발견할까?", "찾을 것 같다", "아닐 것 같다", false],
  ["plan_cancel", "약속이 취소되거나 미뤄질까?", "그럴 것 같다", "아닐 것 같다", false],
  ["unexpected_spend", "예상 밖의 지출이 생길까?", "생길 것 같다", "아닐 것 같다", false],
  ["long_walk", "평소보다 많이 걸을까?", "그럴 것 같다", "아닐 것 같다", false],
  ["mood_lift", "기분이 아침보다 나아질까?", "나아질 것 같다", "아닐 것 같다", false],
].map(([key, label, yesLabel, noLabel, defaultSelected], order) => ({
  key,
  label,
  yesLabel,
  noLabel,
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
