import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  clearSyncedQuestionLabels,
  mergeQuestionLabels,
  migratePendingQuestionLabels,
} from "../../src/lib/question-preferences.ts";

describe("question label preference merging", () => {
  it("keeps an unsynced local edit over a remote default", () => {
    assert.deepEqual(
      mergeQuestionLabels(
        { rain: "오늘 우산이 필요할까?" },
        { rain: "비가 올까?" },
        { rain: "오늘 우산이 필요할까?" },
      ),
      { rain: "오늘 우산이 필요할까?" },
    );
  });

  it("keeps the latest unsynced edit over an older remote edit", () => {
    assert.deepEqual(
      mergeQuestionLabels(
        { rain: "오후에 우산이 필요할까?" },
        { rain: "오늘 우산이 필요할까?" },
        { rain: "오후에 우산이 필요할까?" },
      ),
      { rain: "오후에 우산이 필요할까?" },
    );
  });

  it("accepts a remote edit when the local value is already synced", () => {
    assert.deepEqual(
      mergeQuestionLabels(
        { rain: "오늘 우산이 필요할까?" },
        { rain: "오후에 비가 올까?" },
        {},
      ),
      { rain: "오후에 비가 올까?" },
    );
  });

  it("keeps local labels that do not exist remotely", () => {
    assert.deepEqual(
      mergeQuestionLabels(
        { schedule_change: "오늘 일정이 바뀔까?" },
        { rain: "비가 올까?" },
        {},
      ),
      {
        rain: "비가 올까?",
        schedule_change: "오늘 일정이 바뀔까?",
      },
    );
  });
});

describe("question label sync acknowledgement", () => {
  it("clears only labels included in a successful sync", () => {
    assert.deepEqual(
      clearSyncedQuestionLabels(
        {
          rain: "오늘 우산이 필요할까?",
          schedule_change: "오늘 일정이 바뀔까?",
        },
        { rain: "오늘 우산이 필요할까?" },
      ),
      { schedule_change: "오늘 일정이 바뀔까?" },
    );
  });

  it("does not clear a newer edit completed while a sync was in flight", () => {
    const pendingLabels = { rain: "오후에 우산이 필요할까?" };
    const remainingLabels = clearSyncedQuestionLabels(
      pendingLabels,
      { rain: "오늘 우산이 필요할까?" },
    );

    assert.equal(remainingLabels, pendingLabels);
  });
});

describe("question label persistence migration", () => {
  it("protects existing version 3 edits until they are synced", () => {
    const questionLabels = { rain: "오늘 우산이 필요할까?" };

    assert.equal(
      migratePendingQuestionLabels(3, questionLabels),
      questionLabels,
    );
  });

  it("restores the explicit pending set from version 4", () => {
    assert.deepEqual(
      migratePendingQuestionLabels(
        4,
        { rain: "오늘 우산이 필요할까?" },
        { schedule_change: "오늘 일정이 바뀔까?" },
      ),
      { schedule_change: "오늘 일정이 바뀔까?" },
    );
  });
});
