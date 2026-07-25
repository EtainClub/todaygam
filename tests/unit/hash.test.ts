import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { computeHash, verifyEntryHash } from "../../src/lib/hash.ts";

describe("entry content hash", () => {
  it("remains verifiable when Firestore replaces server timestamps", async () => {
    const clientCreatedAt = "2026-07-25T00:00:00.000Z";
    const contentHash = await computeHash({
      v: 1,
      type: "fixed",
      date: "2026-07-25",
      questionKey: "rain",
      answer: "yes",
      text: null,
      strength: "strong",
      createdAt: clientCreatedAt,
    });

    assert.equal(
      await verifyEntryHash({
        type: "fixed",
        date: "2026-07-25",
        questionKey: "rain",
        answer: "yes",
        text: null,
        strength: "strong",
        clientCreatedAt,
        contentHash,
      }),
      true,
    );
  });

  it("detects a changed locked answer", async () => {
    const clientCreatedAt = "2026-07-25T00:00:00.000Z";
    const contentHash = await computeHash({
      v: 1,
      type: "fixed",
      date: "2026-07-25",
      questionKey: "rain",
      answer: "yes",
      text: null,
      strength: "medium",
      createdAt: clientCreatedAt,
    });

    assert.equal(
      await verifyEntryHash({
        type: "fixed",
        date: "2026-07-25",
        questionKey: "rain",
        answer: "no",
        text: null,
        strength: "medium",
        clientCreatedAt,
        contentHash,
      }),
      false,
    );
  });
});
