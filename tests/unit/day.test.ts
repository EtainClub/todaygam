import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { minutesUntilMidnight, normalizeQuarterHour, todayId } from "../../src/lib/day.ts";

describe("timezone day boundaries", () => {
  it("calculates date IDs from the profile timezone", () => {
    const now = new Date("2026-07-25T16:05:00.000Z");
    assert.equal(todayId("Asia/Seoul", now), "2026-07-26");
    assert.equal(todayId("America/Los_Angeles", now), "2026-07-25");
  });

  it("calculates the remaining local minutes", () => {
    assert.equal(minutesUntilMidnight("Asia/Seoul", new Date("2026-07-25T14:58:00.000Z")), 2);
  });

  it("normalizes notification times to 15-minute slots", () => {
    assert.equal(normalizeQuarterHour("08:07", "08:00"), "08:00");
    assert.equal(normalizeQuarterHour("23:58", "21:00"), "00:00");
    assert.equal(normalizeQuarterHour("", "21:00"), "21:00");
  });
});
