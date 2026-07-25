export type EntryLike = {
  type: "fixed" | "free";
  answer: "yes" | "no" | null;
  outcome: "pending" | "occurred" | "not_occurred" | "uncertain";
};

// Keep identical to src/lib/stats.ts:isHit.
export function isHit(entry: EntryLike): boolean | null {
  if (entry.outcome === "uncertain" || entry.outcome === "pending") return null;
  if (entry.type === "fixed") {
    return (
      (entry.answer === "yes" && entry.outcome === "occurred") ||
      (entry.answer === "no" && entry.outcome === "not_occurred")
    );
  }
  return entry.outcome === "occurred";
}

export function todayIdFor(timeZone: string, now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";
  return `${value("year")}-${value("month")}-${value("day")}`;
}

export function slotFor(timeZone: string, now = new Date()) {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(now);
}

export function expandFieldPaths(update: Record<string, unknown>) {
  const expanded: Record<string, unknown> = {};
  for (const [path, value] of Object.entries(update)) {
    const parts = path.split(".");
    let target = expanded;
    parts.forEach((part, index) => {
      if (index === parts.length - 1) {
        target[part] = value;
      } else {
        const child = target[part];
        if (!child || typeof child !== "object") target[part] = {};
        target = target[part] as Record<string, unknown>;
      }
    });
  }
  return expanded;
}
