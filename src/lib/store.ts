"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { resolvedEntryCount } from "./account-prompt";
import { DEFAULT_QUESTION_KEYS, QUESTION_CATALOG } from "./catalog";
import { minutesUntilMidnight, todayId } from "./day";
import { createEntryRemote, resolveEntryRemote, softDeleteEntryRemote, updateOutcomeNoteRemote } from "./firebase/entries";
import { computeHash } from "./hash";
import type {
  AccountProfile,
  Answer,
  DaySummary,
  Entry,
  NotifySettings,
  Outcome,
  Question,
  Rollup,
  Strength,
} from "./types";

interface AppState {
  hydrated: boolean;
  onboarded: boolean;
  timezone: string;
  questionCatalog: Question[];
  questionLabels: Record<string, string>;
  selectedQuestionKeys: string[];
  notify: NotifySettings;
  entries: Entry[];
  reviewDates: string[];
  dismissedYesterdayDates: string[];
  firebaseUid: string | null;
  accountLinked: boolean;
  accountProfile: AccountProfile | null;
  linkPromptDismissedAt: string | null;
  linkPromptDismissedResolvedCount: number;
  remoteRollup: Rollup | null;
  remoteDays: DaySummary[];
  setHydrated: (hydrated: boolean) => void;
  setAuthState: (
    uid: string | null,
    accountLinked: boolean,
    accountProfile?: AccountProfile | null,
  ) => void;
  resetAfterLogout: () => void;
  snoozeLinkPrompt: () => void;
  setQuestionCatalog: (catalog: Question[]) => void;
  setRemoteRollup: (rollup: Rollup | null) => void;
  setRemoteDays: (days: DaySummary[]) => void;
  mergeRemoteEntries: (entries: Entry[]) => void;
  applyRemotePreferences: (values: {
    onboarded: boolean;
    timezone: string | null;
    notify: NotifySettings | null;
    selectedQuestionKeys: string[];
    questionLabels: Record<string, string>;
  }) => void;
  completeOnboarding: (keys: string[], notify: NotifySettings) => void;
  addFixedEntry: (questionKey: string, answer: Answer, strength: Strength) => Promise<Entry>;
  addFreeEntry: (text: string, strength: Strength) => Promise<Entry>;
  resolveEntry: (entryId: string, outcome: Exclude<Outcome, "pending">, note?: string | null) => void;
  updateOutcomeNote: (entryId: string, note: string | null) => void;
  softDeleteEntry: (entryId: string) => void;
  openReview: (date: string) => void;
  dismissYesterday: (date: string) => void;
  updateNotify: (patch: Partial<NotifySettings>) => void;
  saveQuestions: (keys: string[], labels: Record<string, string>) => void;
  setTimezone: (timezone: string) => void;
  deleteAllData: () => void;
}

type PersistedAppState = Pick<
  AppState,
  | "onboarded"
  | "timezone"
  | "questionLabels"
  | "selectedQuestionKeys"
  | "notify"
  | "linkPromptDismissedAt"
  | "linkPromptDismissedResolvedCount"
  | "entries"
  | "reviewDates"
  | "dismissedYesterdayDates"
>;

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
  const clientCreatedAt = createdAt;
  const date = todayId(timezone);
  const contentHash = await computeHash({
    v: 1,
    type: values.type,
    date,
    questionKey: values.questionKey,
    answer: values.answer,
    text: values.text,
    strength: values.strength,
    createdAt: clientCreatedAt,
  });
  return {
    id: makeId(),
    date,
    timezone,
    ...values,
    createdAt,
    clientCreatedAt,
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
      questionLabels: {},
      selectedQuestionKeys: DEFAULT_QUESTION_KEYS,
      notify: DEFAULT_NOTIFY,
      entries: [],
      reviewDates: [],
      dismissedYesterdayDates: [],
      firebaseUid: null,
      accountLinked: false,
      accountProfile: null,
      linkPromptDismissedAt: null,
      linkPromptDismissedResolvedCount: 0,
      remoteRollup: null,
      remoteDays: [],
      setHydrated: (hydrated) => set({ hydrated }),
      setAuthState: (firebaseUid, accountLinked, accountProfile = null) =>
        set({ firebaseUid, accountLinked, accountProfile }),
      resetAfterLogout: () =>
        set({
          onboarded: false,
          questionCatalog: QUESTION_CATALOG,
          questionLabels: {},
          selectedQuestionKeys: DEFAULT_QUESTION_KEYS,
          notify: DEFAULT_NOTIFY,
          entries: [],
          reviewDates: [],
          dismissedYesterdayDates: [],
          firebaseUid: null,
          accountLinked: false,
          accountProfile: null,
          linkPromptDismissedAt: null,
          linkPromptDismissedResolvedCount: 0,
          remoteRollup: null,
          remoteDays: [],
        }),
      snoozeLinkPrompt: () =>
        set((state) => ({
          linkPromptDismissedAt: new Date().toISOString(),
          linkPromptDismissedResolvedCount: resolvedEntryCount(state.entries),
        })),
      setQuestionCatalog: (questionCatalog) =>
        set((state) => ({
          questionCatalog: questionCatalog.map((question) => ({
            ...question,
            label: state.questionLabels[question.key] ?? question.label,
          })),
        })),
      setRemoteRollup: (remoteRollup) => set({ remoteRollup }),
      setRemoteDays: (remoteDays) => set({ remoteDays }),
      mergeRemoteEntries: (remoteEntries) =>
        set((state) => {
          const merged = new Map(state.entries.map((entry) => [entry.id, entry]));
          remoteEntries.forEach((entry) => merged.set(entry.id, entry));
          return { entries: Array.from(merged.values()) };
        }),
      applyRemotePreferences: (values) =>
        set((state) => {
          const questionLabels = {
            ...state.questionLabels,
            ...values.questionLabels,
          };
          return {
            onboarded: values.onboarded || state.onboarded,
            timezone: values.timezone || state.timezone,
            notify: values.notify ? { ...state.notify, ...values.notify } : state.notify,
            selectedQuestionKeys:
              values.selectedQuestionKeys.length === 3
                ? values.selectedQuestionKeys
                : state.selectedQuestionKeys,
            questionLabels,
            questionCatalog: state.questionCatalog.map((question) => ({
              ...question,
              label: questionLabels[question.key] ?? question.label,
            })),
          };
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
      saveQuestions: (keys, labels) => {
        if (keys.length !== 3) return;
        const normalizedLabels = Object.fromEntries(
          Object.entries(labels)
            .map(([key, label]) => [key, label.trim().slice(0, 40)])
            .filter(([key, label]) =>
              Boolean(label) && QUESTION_CATALOG.some((question) => question.key === key),
            ),
        );
        set((state) => ({
          selectedQuestionKeys: keys,
          questionLabels: { ...state.questionLabels, ...normalizedLabels },
          questionCatalog: state.questionCatalog.map((question) => ({
            ...question,
            label: normalizedLabels[question.key] ?? question.label,
          })),
        }));
      },
      setTimezone: (timezone) => set({ timezone }),
      deleteAllData: () =>
        set({
          entries: [],
          reviewDates: [],
          dismissedYesterdayDates: [],
          linkPromptDismissedAt: null,
          linkPromptDismissedResolvedCount: 0,
          onboarded: false,
          questionCatalog: QUESTION_CATALOG,
          questionLabels: {},
          selectedQuestionKeys: DEFAULT_QUESTION_KEYS,
          notify: DEFAULT_NOTIFY,
        }),
    }),
    {
      name: "oneulgam-v1",
      version: 3,
      partialize: (state) => ({
        onboarded: state.onboarded,
        timezone: state.timezone,
        questionLabels: state.questionLabels,
        selectedQuestionKeys: state.selectedQuestionKeys,
        notify: state.notify,
        linkPromptDismissedAt: state.linkPromptDismissedAt,
        linkPromptDismissedResolvedCount: state.linkPromptDismissedResolvedCount,
        entries: state.entries,
        reviewDates: state.reviewDates,
        dismissedYesterdayDates: state.dismissedYesterdayDates,
      }),
      migrate: (persistedState, version) => {
        const persisted = persistedState as Partial<PersistedAppState> & {
          linkPromptDismissed?: boolean;
        };
        const entries = persisted.entries ?? [];
        const migrated: PersistedAppState = {
          onboarded: persisted.onboarded ?? false,
          timezone: persisted.timezone ?? "Asia/Seoul",
          questionLabels: persisted.questionLabels ?? {},
          selectedQuestionKeys: persisted.selectedQuestionKeys ?? DEFAULT_QUESTION_KEYS,
          notify: persisted.notify ?? DEFAULT_NOTIFY,
          linkPromptDismissedAt:
            version >= 2
              ? persisted.linkPromptDismissedAt ?? null
              : persisted.linkPromptDismissed
                ? new Date().toISOString()
                : null,
          linkPromptDismissedResolvedCount:
            version >= 2
              ? persisted.linkPromptDismissedResolvedCount ?? 0
              : resolvedEntryCount(entries),
          entries,
          reviewDates: persisted.reviewDates ?? [],
          dismissedYesterdayDates: persisted.dismissedYesterdayDates ?? [],
        };
        return migrated;
      },
      merge: (persistedState, currentState) => {
        const persisted = persistedState as Partial<AppState>;
        return {
          ...currentState,
          ...persisted,
          questionCatalog: currentState.questionCatalog.map((question) => ({
            ...question,
            label: persisted.questionLabels?.[question.key] ?? question.label,
          })),
          entries: (persisted.entries ?? []).map((entry) => ({
            ...entry,
            clientCreatedAt: entry.clientCreatedAt ?? entry.createdAt,
          })),
        };
      },
      onRehydrateStorage: () => (state) => state?.setHydrated(true),
    },
  ),
);
