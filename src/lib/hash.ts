import type { Entry } from "./types";

export async function sha256Hex(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export async function computeHash(input: {
  v: 1;
  type: "fixed" | "free";
  date: string;
  questionKey: string | null;
  answer: "yes" | "no" | null;
  text: string | null;
  strength: "faint" | "medium" | "strong";
  createdAt: string;
}): Promise<string> {
  return `sha256:${await sha256Hex(JSON.stringify(input))}`;
}

export async function verifyEntryHash(
  entry: Pick<
    Entry,
    "type" | "date" | "questionKey" | "answer" | "text" | "strength" | "clientCreatedAt" | "contentHash"
  >,
): Promise<boolean> {
  const contentHash = await computeHash({
    v: 1,
    type: entry.type,
    date: entry.date,
    questionKey: entry.questionKey,
    answer: entry.answer,
    text: entry.text,
    strength: entry.strength,
    createdAt: entry.clientCreatedAt,
  });
  return contentHash === entry.contentHash;
}
