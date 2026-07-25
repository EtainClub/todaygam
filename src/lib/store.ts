"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { DEFAULT_QUESTION_KEYS, QUESTION_CATALOG } from "./catalog";
import { minutesUntilMidnight, todayId } from "./day";
import { createEntryRemote, resolveEntryRemote, softDeleteEntryRemote, updateOutcomeNoteRemote } from "./firebase/entries";
import { computeHash } from "./hash";
import type { Answer, DaySummary, Entry, NotifySettings, Outcome, Question, Rollup, Strength } from "./types";

interface AppState {
  hydrated: boolean;
  onboarded: boolean;
  timezone: string;
  questionCatalog: Question[];
  selectedQuestionKeys: string[];
  notify: NotifySettings;
  entries: Entry[];
  reviewDates: string[];
  dismissedYesterdayDates: string[];
  firebaseUid: string | null;
  accountLinked: boolean;
  linkPromptDismissed: boolean;
  remoteRollup: Rollup | null;
  remoteDays: DaySummary[];
  setHydrated: (hydrated: boolean) => void;
  setAuthState: (uid: string | null, accountLinked: boolean) => void;
  dismissLinkPrompt: () => void;
  setQuestionCatalog: (catalog: Question[]) => void;
  setRemoteRollup: (rollup: Rollup | null) => void;
  setRemoteDays: (days: DaySummary[]) => void;
  mergeRemoteEntries: (entries: Entry[]) => void;
  completeOnboarding: (keys: string[], notify: NotifySettings) => void;
  addFixedEntry: (questionKey: string, answer: Answer, strength: Strength) => Promise<Entry>;
  addFreeEntry: (text: string, strength: Strength) => Promise<Entry>;
  resolveEntry: (entryId: string, outcome: Exclude<Outcome, "pending">, note?: string | null) => void;
  updateOutcomeNote: (entryId: string, note: string | null) => void;
  softDeleteEntry: (entryId: string) => void;
  openReview: (date: string) => void;
  dismissYesterday: (date: string) => void;
  updateNotify: (patch: Partial<NotifySettings>) => void;
  replaceQuestions: (keys: string[]) => void;
  setTimezone: (timezone: string) => void;
  deleteAllData: () => void;
}

const DEFAULT_NOTIFY: NotifySettings = {
  morningEnabled: false,
  morningHHmm: "08:00",
  eveningEnabled: false,
  eveningHHmm: "21:00",
  unresolvedEnabled: true,
};

function makeId() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

async function makeEntry(
  timezone: string,
  values: Pick<Entry, "type" | "questionKey" | "questionLabel" | "answer" | "text" | "strength">,
): Promise<Entry> {
  const createdAt = new Date().toISOString();
  const date = todayId(timezone);
  const contentHash = await computeHash({
    v: 1,
    type: values.type,
    date,
    questionKey: values.questionKey,
    answer: values.answer,
    text: values.text,
    strength: values.strength,
    createdAt,
  });
  return {
    id: makeId(),
    date,
    timezone,
    ...values,
    createdAt,
    lockedAt: createdAt,
    contentHash,
    remainingMinutes: minutesUntilMidnight(timezone),
    outcome: "pending",
    outcomeNote: null,
    resolvedAt: null,
    deletedAt: null,
  };
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      hydrated: false,
      onboarded: false,
      timezone: "Asia/Seoul",
      questionCatalog: QUESTION_CATALOG,
      selectedQuestionKeys: DEFAULT_QUESTION_KEYS,
      notify: DEFAULT_NOTIFY,
      entries: [],
      reviewDates: [],
      dismissedYesterdayDates: [],
      firebaseUid: null,
      accountLinked: false,
      linkPromptDismissed: false,
      remoteRollup: null,
      remoteDays: [],
      setHydrated: (hydrated) => set({ hydrated }),
      setAuthState: (firebaseUid, accountLinked) => set({ firebaseUid, accountLinked }),
      dismissLinkPrompt: () => set({ linkPromptDismissed: true }),
      setQuestionCatalog: (questionCatalog) => set({ questionCatalog }),
      setRemoteRollup: (remoteRollup) => set({ remoteRollup }),
      setRemoteDays: (remoteDays) => set({ remoteDays }),
      mergeRemoteEntries: (remoteEntries) =>
        set((state) => {
          const merged = new Map(state.entries.map((entry) => [entry.id, entry]));
          remoteEntries.forEach((entry) => merged.set(entry.id, entry));
          return { entries: Array.from(merged.values()) };
        }),
      completeOnboarding: (selectedQuestionKeys, notify) =>
        set({ onboarded: true, selectedQuestionKeys, notify }),
      addFixedEntry: async (questionKey, answer, strength) => {
        const state = get();
        const question = state.questionCatalog.find((item) => item.key === questionKey);
        if (!question) throw new Error("질문을 찾을 수 없습니다.");
        const entry = await makeEntry(state.timezone, {
          type: "fixed",
          questionKey,
          questionLabel: question.label,
          answer,
          text: null,
          strength,
        });
        set((current) => ({ entries: [...current.entries, entry] }));
        if (state.firebaseUid) void createEntryRemote(state.firebaseUid, entry);
        return entry;
      },
      addFreeEntry: async (text, strength) => {
        const state = get();
        const entry = await makeEntry(state.timezone, {
          type: "free",
          questionKey: null,
          questionLabel: null,
          answer: null,
          text: text.trim().slice(0, 60),
          strength,
        });
        set((current) => ({ entries: [...current.entries, entry] }));
        if (state.firebaseUid) void createEntryRemote(state.firebaseUid, entry);
        return entry;
      },
      resolveEntry: (entryId, outcome, note = null) => {
        const state = get();
        const entry = state.entries.find((item) => item.id === entryId);
        if (!entry || entry.outcome !== "pending" || entry.deletedAt) return;
        const resolvedAt = new Date().toISOString();
        set((current) => ({
          entries: current.entries.map((item) =>
            item.id === entryId ? { ...item, outcome, outcomeNote: note, resolvedAt } : item,
          ),
        }));
        if (state.firebaseUid) void resolveEntryRemote(state.firebaseUid, entry, outcome, note);
      },
      updateOutcomeNote: (entryId, note) => {
        const state = get();
        const entry = state.entries.find((item) => item.id === entryId);
        if (!entry || entry.outcome === "pending") return;
        set((current) => ({
          entries: current.entries.map((item) =>
            item.id === entryId ? { ...item, outcomeNote: note } : item,
          ),
        }));
        if (state.firebaseUid) void updateOutcomeNoteRemote(state.firebaseUid, entryId, note);
      },
      softDeleteEntry: (entryId) => {
        const state = get();
        const entry = state.entries.find((item) => item.id === entryId);
        if (!entry || entry.outcome !== "pending" || entry.deletedAt) return;
        set((current) => ({
          entries: current.entries.map((item) =>
            item.id === entryId ? { ...item, deletedAt: new Date().toISOString() } : item,
          ),
        }));
        if (state.firebaseUid) void softDeleteEntryRemote(state.firebaseUid, entry);
      },
      openReview: (date) =>
        set((state) => ({
          reviewDates: state.reviewDates.includes(date) ? state.reviewDates : [...state.reviewDates, date],
        })),
      dismissYesterday: (date) =>
        set((state) => ({
          dismissedYesterdayDates: state.dismissedYesterdayDates.includes(date)
            ? state.dismissedYesterdayDates
            : [...state.dismissedYesterdayDates, date],
        })),
      updateNotify: (patch) => set((state) => ({ notify: { ...state.notify, ...patch } })),
      replaceQuestions: (keys) => {
        if (keys.length === 3) set({ selectedQuestionKeys: keys });
      },
      setTimezone: (timezone) => set({ timezone }),
      deleteAllData: () =>
        set({
          entries: [],
          reviewDates: [],
          dismissedYesterdayDates: [],
          linkPromptDismissed: false,
          onboarded: false,
          selectedQuestionKeys: DEFAULT_QUESTION_KEYS,
          notify: DEFAULT_NOTIFY,
        }),
    }),
    {
      name: "oneulgam-v1",
      version: 1,
      partialize: (state) => ({
        onboarded: state.onboarded,
        timezone: state.timezone,
        selectedQuestionKeys: state.selectedQuestionKeys,
        notify: state.notify,
        linkPromptDismissed: state.linkPromptDismissed,
        entries: state.entries,
        reviewDates: state.reviewDates,
        dismissedYesterdayDates: state.dismissedYesterdayDates,
      }),
      onRehydrateStorage: () => (state) => state?.setHydrated(true),
    },
  ),
);
