"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { DEFAULT_QUESTION_KEYS, QUESTION_CATALOG } from "./catalog";
import { minutesUntilMidnight, todayId } from "./day";
import { createEntryRemote, resolveEntryRemote, softDeleteEntryRemote, updateOutcomeNoteRemote } from "./firebase/entries";
import { computeHash } from "./hash";
import {
  clearSyncedQuestionLabels,
  mergeQuestionLabels,
  migratePendingQuestionLabels,
} from "./question-preferences";
import type {
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
  pendingQuestionLabels: Record<string, string>;
  selectedQuestionKeys: string[];
  notify: NotifySettings;
  entries: Entry[];
  reviewDates: string[];
  dismissedYesterdayDates: string[];
  firebaseUid: string | null;
  recoveryKeyIssuedAt: string | null;
  remoteRollup: Rollup | null;
  remoteDays: DaySummary[];
  setHydrated: (hydrated: boolean) => void;
  setAuthState: (uid: string | null) => void;
  setRecoveryKeyIssuedAt: (issuedAt: string | null) => void;
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
    recoveryKeyIssuedAt: string | null;
  }) => void;
  markQuestionLabelsSynced: (syncedLabels: Record<string, string>) => void;
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
  | "pendingQuestionLabels"
  | "selectedQuestionKeys"
  | "notify"
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
      pendingQuestionLabels: {},
      selectedQuestionKeys: DEFAULT_QUESTION_KEYS,
      notify: DEFAULT_NOTIFY,
      entries: [],
      reviewDates: [],
      dismissedYesterdayDates: [],
      firebaseUid: null,
      recoveryKeyIssuedAt: null,
      remoteRollup: null,
      remoteDays: [],
      setHydrated: (hydrated) => set({ hydrated }),
      setAuthState: (firebaseUid) => set({ firebaseUid }),
      setRecoveryKeyIssuedAt: (recoveryKeyIssuedAt) => set({ recoveryKeyIssuedAt }),
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
          const questionLabels = mergeQuestionLabels(
            state.questionLabels,
            values.questionLabels,
            state.pendingQuestionLabels,
          );
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
            recoveryKeyIssuedAt: values.recoveryKeyIssuedAt,
          };
        }),
      markQuestionLabelsSynced: (syncedLabels) =>
        set((state) => {
          const pendingQuestionLabels = clearSyncedQuestionLabels(
            state.pendingQuestionLabels,
            syncedLabels,
          );
          return pendingQuestionLabels === state.pendingQuestionLabels
            ? state
            : { pendingQuestionLabels };
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
          pendingQuestionLabels: { ...state.pendingQuestionLabels, ...normalizedLabels },
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
          recoveryKeyIssuedAt: null,
          onboarded: false,
          questionCatalog: QUESTION_CATALOG,
          questionLabels: {},
          pendingQuestionLabels: {},
          selectedQuestionKeys: DEFAULT_QUESTION_KEYS,
          notify: DEFAULT_NOTIFY,
        }),
    }),
    {
      name: "oneulgam-v1",
      version: 5,
      partialize: (state) => ({
        onboarded: state.onboarded,
        timezone: state.timezone,
        questionLabels: state.questionLabels,
        pendingQuestionLabels: state.pendingQuestionLabels,
        selectedQuestionKeys: state.selectedQuestionKeys,
        notify: state.notify,
        entries: state.entries,
        reviewDates: state.reviewDates,
        dismissedYesterdayDates: state.dismissedYesterdayDates,
      }),
      migrate: (persistedState, version) => {
        const persisted = persistedState as Partial<PersistedAppState>;
        const entries = persisted.entries ?? [];
        const migrated: PersistedAppState = {
          onboarded: persisted.onboarded ?? false,
          timezone: persisted.timezone ?? "Asia/Seoul",
          questionLabels: persisted.questionLabels ?? {},
          pendingQuestionLabels: migratePendingQuestionLabels(
            version,
            persisted.questionLabels ?? {},
            persisted.pendingQuestionLabels,
          ),
          selectedQuestionKeys: persisted.selectedQuestionKeys ?? DEFAULT_QUESTION_KEYS,
          notify: persisted.notify ?? DEFAULT_NOTIFY,
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
      onRehydrateStorage: () => (state, error) => {
        // If storage access throws (restricted/sandboxed webviews, private
        // mode, etc.) `state` comes back undefined and hydration never
        // resolves — ClientProviders gates its first render on `hydrated`,
        // so that left the app on a permanent blank screen. Always unblock
        // rendering, even when local persistence failed, and fall back to
        // in-memory defaults.
        if (error) {
          console.error("로컬 데이터를 불러오지 못했습니다.", error);
          useAppStore.setState({ hydrated: true });
          return;
        }
        state?.setHydrated(true);
      },
    },
  ),
);

if (typeof window !== "undefined") {
  // Belt-and-suspenders for onRehydrateStorage above: that callback covers a
  // storage access that throws synchronously, but we can't rule out a Toss
  // webview environment where the persist middleware's rehydration promise
  // simply never settles (no error, no resolution) — e.g. a storage API
  // that silently hangs rather than throwing. Without this, `hydrated`
  // stays false forever and every gated screen (see page.tsx) is stuck
  // showing its loading state indefinitely. Force it after a short grace
  // period; this is a no-op in the normal case since rehydration typically
  // completes within milliseconds.
  window.setTimeout(() => {
    if (!useAppStore.getState().hydrated) {
      console.error("스토리지 초기화가 지연되어 강제로 진행합니다.");
      useAppStore.setState({ hydrated: true });
    }
  }, 3000);
}
