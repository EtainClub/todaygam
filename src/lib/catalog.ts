import type { Question } from "./types";

export const QUESTION_CATALOG: Question[] = [
  { key: "contact_unexpected", label: "예상하지 못한 연락이 올까?", yesLabel: "올 것 같다", noLabel: "아닐 것 같다", defaultSelected: true, order: 0, enabled: true },
  { key: "schedule_change", label: "일정 하나가 바뀔까?", yesLabel: "바뀔 것 같다", noLabel: "아닐 것 같다", defaultSelected: true, order: 1, enabled: true },
  { key: "rain", label: "비가 올까?", yesLabel: "올 것 같다", noLabel: "아닐 것 같다", defaultSelected: true, order: 2, enabled: true },
  { key: "good_news", label: "좋은 소식을 들을까?", yesLabel: "들을 것 같다", noLabel: "아닐 것 같다", defaultSelected: false, order: 3, enabled: true },
  { key: "conflict", label: "누군가와 의견이 부딪칠까?", yesLabel: "있을 것 같다", noLabel: "아닐 것 같다", defaultSelected: false, order: 4, enabled: true },
  { key: "find_lost", label: "찾던 것을 발견할까?", yesLabel: "찾을 것 같다", noLabel: "아닐 것 같다", defaultSelected: false, order: 5, enabled: true },
  { key: "plan_cancel", label: "약속이 취소되거나 미뤄질까?", yesLabel: "그럴 것 같다", noLabel: "아닐 것 같다", defaultSelected: false, order: 6, enabled: true },
  { key: "unexpected_spend", label: "예상 밖의 지출이 생길까?", yesLabel: "생길 것 같다", noLabel: "아닐 것 같다", defaultSelected: false, order: 7, enabled: true },
  { key: "long_walk", label: "평소보다 많이 걸을까?", yesLabel: "그럴 것 같다", noLabel: "아닐 것 같다", defaultSelected: false, order: 8, enabled: true },
  { key: "mood_lift", label: "기분이 아침보다 나아질까?", yesLabel: "나아질 것 같다", noLabel: "아닐 것 같다", defaultSelected: false, order: 9, enabled: true },
];

export const DEFAULT_QUESTION_KEYS = QUESTION_CATALOG
  .filter((question) => question.defaultSelected)
  .map((question) => question.key);

export const STRENGTH_LABEL = {
  faint: "스침",
  medium: "어느 정도",
  strong: "강하게",
} as const;
