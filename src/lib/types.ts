export type Answer = "yes" | "no";
export type Strength = "faint" | "medium" | "strong";
export type Outcome = "pending" | "occurred" | "not_occurred" | "uncertain";

export interface Question {
  key: string;
  label: string;
  yesLabel: string;
  noLabel: string;
  defaultSelected: boolean;
  order: number;
  enabled: boolean;
}

export interface Entry {
  id: string;
  type: "fixed" | "free";
  date: string;
  timezone: string;
  questionKey: string | null;
  questionLabel: string | null;
  answer: Answer | null;
  text: string | null;
  strength: Strength;
  createdAt: string;
  lockedAt: string;
  contentHash: string;
  remainingMinutes: number;
  outcome: Outcome;
  outcomeNote: string | null;
  resolvedAt: string | null;
  deletedAt: string | null;
}

export interface NotifySettings {
  morningEnabled: boolean;
  morningHHmm: string;
  eveningEnabled: boolean;
  eveningHHmm: string;
  unresolvedEnabled: boolean;
}

export interface DaySummary {
  date: string;
  fixedTotal: number;
  fixedAnswered: number;
  freeCount: number;
  resolvedCount: number;
  pendingCount: number;
  hitCount: number;
  missCount: number;
  uncertainCount: number;
}

export interface QuestionRollup {
  label: string;
  yesOccurred: number;
  yesNotOccurred: number;
  noOccurred: number;
  noNotOccurred: number;
  uncertain: number;
}

export interface Rollup {
  version: 2;
  totals: {
    days: number;
    created: number;
    resolved: number;
    hit: number;
    miss: number;
    uncertain: number;
  };
  byQuestion: Record<string, QuestionRollup>;
  byStrength: Record<Strength, { hit: number; total: number }>;
}
