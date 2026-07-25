import type { Entry, QuestionRollup, Rollup, Strength } from "./types";

export type SignalState = "insufficient" | "strong" | "weak" | "noise";

export interface LiftResult {
  state: SignalState;
  lift: number | null;
  pYes: number | null;
  pNo: number | null;
  nYes: number;
  nNo: number;
  need: number;
  inverse: boolean;
  message: string;
}

export function isHit(entry: Entry): boolean | null {
  if (entry.outcome === "uncertain" || entry.outcome === "pending" || entry.deletedAt) return null;
  if (entry.type === "fixed") {
    return (
      (entry.answer === "yes" && entry.outcome === "occurred") ||
      (entry.answer === "no" && entry.outcome === "not_occurred")
    );
  }
  return entry.outcome === "occurred";
}

export function calculateLift(
  data: QuestionRollup,
  gate = { minPerArm: 10, minTotal: 25 },
): LiftResult {
  const nYes = data.yesOccurred + data.yesNotOccurred;
  const nNo = data.noOccurred + data.noNotOccurred;
  const total = nYes + nNo;
  const missingForArms = Math.max(0, gate.minPerArm - nYes) + Math.max(0, gate.minPerArm - nNo);
  const need = Math.max(gate.minTotal - total, missingForArms, 0);

  if (nYes < gate.minPerArm || nNo < gate.minPerArm || total < gate.minTotal) {
    return {
      state: "insufficient",
      lift: null,
      pYes: null,
      pNo: null,
      nYes,
      nNo,
      need,
      inverse: false,
      message: `${need}개가 더 모이면 패턴을 보여드릴게요`,
    };
  }

  const pYes = data.yesOccurred / nYes;
  const pNo = data.noOccurred / nNo;
  const lift = pYes - pNo;
  const se = Math.sqrt((pYes * (1 - pYes)) / nYes + (pNo * (1 - pNo)) / nNo);
  const z = se === 0 ? (lift === 0 ? 0 : Number.POSITIVE_INFINITY) : Math.abs(lift) / se;
  const state: SignalState = z >= 1.96 ? "strong" : z >= 1 ? "weak" : "noise";
  const inverse = lift < 0 && state === "strong";
  const message = inverse
    ? "느낌과 반대 방향의 신호가 보입니다"
    : state === "strong"
      ? "✦ 뚜렷한 신호가 보입니다"
      : state === "weak"
        ? "약한 신호가 있습니다"
        : "아직 우연과 구분되지 않습니다";

  return { state, lift, pYes, pNo, nYes, nNo, need: 0, inverse, message };
}

export function rollupEntries(entries: Entry[]): Rollup {
  const result: Rollup = {
    version: 2,
    totals: { days: 0, created: 0, resolved: 0, hit: 0, miss: 0, uncertain: 0 },
    byQuestion: {},
    byStrength: {
      faint: { hit: 0, total: 0 },
      medium: { hit: 0, total: 0 },
      strong: { hit: 0, total: 0 },
    },
  };
  const days = new Set<string>();
  for (const entry of entries) {
    if (entry.deletedAt) continue;
    result.totals.created += 1;
    days.add(entry.date);
    if (entry.outcome === "uncertain") result.totals.uncertain += 1;
    const hit = isHit(entry);
    if (hit !== null) {
      result.totals.resolved += 1;
      result.totals[hit ? "hit" : "miss"] += 1;
      result.byStrength[entry.strength].total += 1;
      if (hit) result.byStrength[entry.strength].hit += 1;
    }
    if (entry.type !== "fixed" || !entry.questionKey) continue;
    const question = result.byQuestion[entry.questionKey] ?? {
      label: entry.questionLabel ?? "",
      yesOccurred: 0,
      yesNotOccurred: 0,
      noOccurred: 0,
      noNotOccurred: 0,
      uncertain: 0,
    };
    if (entry.outcome === "uncertain") question.uncertain += 1;
    if (entry.outcome === "occurred") {
      question[entry.answer === "yes" ? "yesOccurred" : "noOccurred"] += 1;
    }
    if (entry.outcome === "not_occurred") {
      question[entry.answer === "yes" ? "yesNotOccurred" : "noNotOccurred"] += 1;
    }
    result.byQuestion[entry.questionKey] = question;
  }
  result.totals.days = days.size;
  return result;
}

export function strengthRate(rollup: Rollup, strength: Strength) {
  const value = rollup.byStrength[strength];
  return {
    ...value,
    rate: value.total >= 20 ? Math.round((value.hit / value.total) * 100) : null,
  };
}
