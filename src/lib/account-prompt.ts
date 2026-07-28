import type { Entry } from "./types";

export const ACCOUNT_PROMPT_MIN_RESOLVED = 6;
export const ACCOUNT_PROMPT_MIN_DAYS = 3;
export const ACCOUNT_PROMPT_SNOOZE_DAYS = 14;
export const ACCOUNT_PROMPT_REPROMPT_RESOLVED = 12;

const DAY_IN_MS = 24 * 60 * 60 * 1_000;

export function resolvedEntryCount(entries: Entry[]) {
  return entries.filter((entry) => !entry.deletedAt && entry.outcome !== "pending").length;
}

export function shouldShowAccountPrompt({
  entries,
  firebaseUid,
  accountLinked,
  dismissedAt,
  dismissedResolvedCount,
  now,
}: {
  entries: Entry[];
  firebaseUid: string | null;
  accountLinked: boolean;
  dismissedAt: string | null;
  dismissedResolvedCount: number;
  now: Date;
}) {
  if (!firebaseUid || accountLinked) return false;

  const resolvedEntries = entries.filter(
    (entry) => !entry.deletedAt && entry.outcome !== "pending",
  );
  const resolvedDays = new Set(resolvedEntries.map((entry) => entry.date)).size;

  if (
    resolvedEntries.length < ACCOUNT_PROMPT_MIN_RESOLVED ||
    resolvedDays < ACCOUNT_PROMPT_MIN_DAYS
  ) {
    return false;
  }
  if (!dismissedAt) return true;

  const dismissedAtMs = Date.parse(dismissedAt);
  if (Number.isNaN(dismissedAtMs)) return true;

  const snoozeExpired =
    now.getTime() - dismissedAtMs >= ACCOUNT_PROMPT_SNOOZE_DAYS * DAY_IN_MS;
  const enoughNewRecords =
    resolvedEntries.length - dismissedResolvedCount >= ACCOUNT_PROMPT_REPROMPT_RESOLVED;

  return snoozeExpired || enoughNewRecords;
}
