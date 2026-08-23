import type { Answer, Question } from "./types";

export const QUESTION_CATALOG: Question[] = [
  { key: "contact_unexpected", label: "예상하지 못한 연락이 올까?", defaultSelected: true, order: 0, enabled: true },
  { key: "schedule_change", label: "일정 하나가 바뀔까?", defaultSelected: true, order: 1, enabled: true },
  { key: "rain", label: "비가 올까?", defaultSelected: true, order: 2, enabled: true },
  { key: "good_news", label: "좋은 소식을 들을까?", defaultSelected: false, order: 3, enabled: true },
  { key: "conflict", label: "누군가와 의견이 부딪칠까?", defaultSelected: false, order: 4, enabled: true },
  { key: "find_lost", label: "찾던 것을 발견할까?", defaultSelected: false, order: 5, enabled: true },
  { key: "plan_cancel", label: "약속이 취소되거나 미뤄질까?", defaultSelected: false, order: 6, enabled: true },
  { key: "unexpected_spend", label: "예상 밖의 지출이 생길까?", defaultSelected: false, order: 7, enabled: true },
  { key: "long_walk", label: "평소보다 많이 걸을까?", defaultSelected: false, order: 8, enabled: true },
  { key: "mood_lift", label: "기분이 아침보다 나아질까?", defaultSelected: false, order: 9, enabled: true },
];

export const DEFAULT_QUESTION_KEYS = QUESTION_CATALOG
  .filter((question) => question.defaultSelected)
  .map((question) => question.key);

export const STRENGTH_LABEL = {
  faint: "스침",
  medium: "어느 정도",
  strong: "강하게",
} as const;

// Question text is user-editable (settings), so the answer choices can't be
// phrased around any one question's wording — they have to read naturally
// against whatever the user typed.
export const ANSWER_LABEL: Record<Answer, string> = {
  yes: "일어날 것이다",
  no: "일어나지 않을 것이다",
};

// Same constraint for the stats page's per-question rate rows.
export const ANSWER_FELT_LABEL: Record<Answer, string> = {
  yes: "일어날 거라고 느낀 날",
  no: "일어나지 않을 거라고 느낀 날",
};
