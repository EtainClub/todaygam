import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  ACCOUNT_PROMPT_REPROMPT_RESOLVED,
  shouldShowAccountPrompt,
} from "../../src/lib/account-prompt.ts";
import type { Entry } from "../../src/lib/types.ts";

function entry(index: number, date: string, outcome: Entry["outcome"] = "occurred"): Entry {
  const createdAt = `${date}T00:00:00.000Z`;
  return {
    id: `entry-${index}`,
    type: "fixed",
    date,
    timezone: "Asia/Seoul",
    questionKey: "rain",
    questionLabel: "비가 올까?",
    answer: "yes",
    text: null,
    strength: "medium",
    createdAt,
    clientCreatedAt: createdAt,
    lockedAt: createdAt,
    contentHash: `sha256:${"a".repeat(64)}`,
    remainingMinutes: 100,
    outcome,
    outcomeNote: null,
    resolvedAt: outcome === "pending" ? null : createdAt,
    deletedAt: null,
  };
}

function resolvedEntries(count: number) {
  const dates = ["2026-07-24", "2026-07-25", "2026-07-26"];
  return Array.from({ length: count }, (_, index) => entry(index, dates[index % dates.length]));
}

const now = new Date("2026-07-27T00:00:00.000Z");

function shouldShow(
  entries: Entry[],
  overrides: Partial<Parameters<typeof shouldShowAccountPrompt>[0]> = {},
) {
  return shouldShowAccountPrompt({
    entries,
    firebaseUid: "anonymous-uid",
    accountLinked: false,
    dismissedAt: null,
    dismissedResolvedCount: 0,
    now,
    ...overrides,
  });
}

describe("account link prompt", () => {
  it("waits until six resolved records across three days", () => {
    assert.equal(shouldShow(resolvedEntries(5)), false);
    assert.equal(
      shouldShow(Array.from({ length: 6 }, (_, index) => entry(index, "2026-07-26"))),
      false,
    );
    assert.equal(shouldShow(resolvedEntries(6)), true);
  });

  it("does not show without Firebase or after linking", () => {
    assert.equal(shouldShow(resolvedEntries(6), { firebaseUid: null }), false);
    assert.equal(shouldShow(resolvedEntries(6), { accountLinked: true }), false);
  });

  it("snoozes until fourteen days pass", () => {
    assert.equal(
      shouldShow(resolvedEntries(6), {
        dismissedAt: "2026-07-20T00:00:00.000Z",
        dismissedResolvedCount: 6,
      }),
      false,
    );
    assert.equal(
      shouldShow(resolvedEntries(6), {
        dismissedAt: "2026-07-13T00:00:00.000Z",
        dismissedResolvedCount: 6,
      }),
      true,
    );
  });

  it("shows again after twelve more resolved records", () => {
    const dismissedResolvedCount = 6;
    assert.equal(
      shouldShow(resolvedEntries(dismissedResolvedCount + ACCOUNT_PROMPT_REPROMPT_RESOLVED), {
        dismissedAt: "2026-07-26T00:00:00.000Z",
        dismissedResolvedCount,
      }),
      true,
    );
  });
});
