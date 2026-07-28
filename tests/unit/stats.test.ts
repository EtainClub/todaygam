import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  calculateLift,
  isHit,
  normalizeQuestionRollup,
  rollupEntries,
  strengthRate,
} from "../../src/lib/stats.ts";
import type { Entry, QuestionRollup, Rollup } from "../../src/lib/types.ts";

function rollup(values: Partial<QuestionRollup>): QuestionRollup {
  return {
    label: "질문",
    yesOccurred: 0,
    yesNotOccurred: 0,
    noOccurred: 0,
    noNotOccurred: 0,
    uncertain: 0,
    ...values,
  };
}

function entry(values: Partial<Entry>): Entry {
  return {
    id: "entry",
    type: "fixed",
    date: "2026-07-25",
    timezone: "Asia/Seoul",
    questionKey: "rain",
    questionLabel: "비가 올까?",
    answer: "yes",
    text: null,
    strength: "medium",
    createdAt: "2026-07-25T00:00:00.000Z",
    clientCreatedAt: "2026-07-25T00:00:00.000Z",
    lockedAt: "2026-07-25T00:00:00.000Z",
    contentHash: `sha256:${"a".repeat(64)}`,
    remainingMinutes: 100,
    outcome: "pending",
    outcomeNote: null,
    resolvedAt: null,
    deletedAt: null,
    ...values,
  };
}

describe("calculateLift", () => {
  it("is insufficient when the yes arm is empty", () => {
    const value = calculateLift(rollup({ noOccurred: 12, noNotOccurred: 13 }));
    assert.equal(value.state, "insufficient");
    assert.equal(value.pYes, null);
  });

  it("finds a strong +50 percentage-point signal", () => {
    const value = calculateLift(rollup({
      yesOccurred: 30,
      yesNotOccurred: 10,
      noOccurred: 10,
      noNotOccurred: 30,
    }));
    assert.equal(value.state, "strong");
    assert.ok(Math.abs((value.lift ?? 0) - 0.5) < 0.000001);
    assert.equal(value.inverse, false);
  });

  it("classifies nearby rates as noise", () => {
    const value = calculateLift(rollup({
      yesOccurred: 20,
      yesNotOccurred: 20,
      noOccurred: 19,
      noNotOccurred: 21,
    }));
    assert.equal(value.state, "noise");
  });

  it("surfaces a strong inverse signal", () => {
    const value = calculateLift(rollup({
      yesOccurred: 10,
      yesNotOccurred: 30,
      noOccurred: 30,
      noNotOccurred: 10,
    }));
    assert.equal(value.state, "strong");
    assert.equal(value.inverse, true);
    assert.equal(value.message, "느낌과 반대 방향의 신호가 보입니다");
  });

  it("keeps a total of 24 behind the sample gate", () => {
    const value = calculateLift(rollup({
      yesOccurred: 6,
      yesNotOccurred: 6,
      noOccurred: 6,
      noNotOccurred: 6,
    }));
    assert.equal(value.state, "insufficient");
    assert.equal(value.need, 1);
  });

  it("treats missing remote counters as zero instead of NaN", () => {
    const sparse = {
      label: "비가 올까?",
      yesOccurred: 1,
    } as QuestionRollup;
    const normalized = normalizeQuestionRollup(sparse);
    const value = calculateLift(sparse);

    assert.deepEqual(normalized, rollup({ yesOccurred: 1, label: "비가 올까?" }));
    assert.equal(value.state, "insufficient");
    assert.equal(value.nYes, 1);
    assert.equal(value.nNo, 0);
    assert.equal(value.need, 24);
    assert.equal(Number.isNaN(value.need), false);
  });
});

describe("hit and rollup logic", () => {
  it("counts a no prediction followed by non-occurrence as a hit", () => {
    assert.equal(isHit(entry({ answer: "no", outcome: "not_occurred" })), true);
  });

  it("excludes pending, uncertain, and deleted entries", () => {
    assert.equal(isHit(entry({ outcome: "pending" })), null);
    assert.equal(isHit(entry({ outcome: "uncertain" })), null);
    assert.equal(isHit(entry({ outcome: "occurred", deletedAt: "2026-07-25T10:00:00Z" })), null);
  });

  it("produces the expected 2x2 question table", () => {
    const result = rollupEntries([
      entry({ id: "1", answer: "yes", outcome: "occurred" }),
      entry({ id: "2", answer: "yes", outcome: "not_occurred" }),
      entry({ id: "3", answer: "no", outcome: "occurred" }),
      entry({ id: "4", answer: "no", outcome: "not_occurred" }),
    ]);
    assert.deepEqual(result.byQuestion.rain, {
      label: "비가 올까?",
      yesOccurred: 1,
      yesNotOccurred: 1,
      noOccurred: 1,
      noNotOccurred: 1,
      uncertain: 0,
    });
    assert.equal(result.totals.hit, 2);
    assert.equal(result.totals.miss, 2);
  });

  it("treats a missing strength hit counter as zero", () => {
    const result = rollupEntries([]);
    result.byStrength.medium = { total: 20 } as Rollup["byStrength"]["medium"];

    assert.deepEqual(strengthRate(result, "medium"), {
      hit: 0,
      total: 20,
      rate: 0,
    });
  });
});
