import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { expandFieldPaths, isHit, slotFor, todayIdFor } from "./shared.js";

describe("functions shared logic", () => {
  it("treats a no answer followed by no occurrence as a hit", () => {
    assert.equal(isHit({ type: "fixed", answer: "no", outcome: "not_occurred" }), true);
  });

  it("excludes uncertain outcomes", () => {
    assert.equal(isHit({ type: "fixed", answer: "yes", outcome: "uncertain" }), null);
  });

  it("uses the profile timezone", () => {
    const now = new Date("2026-07-25T16:05:00.000Z");
    assert.equal(todayIdFor("Asia/Seoul", now), "2026-07-26");
    assert.equal(slotFor("Asia/Seoul", now), "01:05");
  });

  it("matches unresolved reminder time in each user's local timezone", () => {
    const now = new Date("2026-07-25T16:30:00.000Z");
    assert.equal(slotFor("America/Los_Angeles", now), "09:30");
    assert.equal(slotFor("Asia/Seoul", now), "01:30");
  });

  it("expands Firestore field paths into merge-safe nested maps", () => {
    const increment = { operand: 1 };
    assert.deepEqual(
      expandFieldPaths({
        version: 2,
        "totals.resolved": increment,
        "byQuestion.rain.yesOccurred": increment,
      }),
      {
        version: 2,
        totals: { resolved: increment },
        byQuestion: { rain: { yesOccurred: increment } },
      },
    );
  });
});
