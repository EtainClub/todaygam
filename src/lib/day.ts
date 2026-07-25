export function todayId(timeZone: string, now = new Date()): string {
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

export function minutesUntilMidnight(timeZone: string, now = new Date()): number {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(now);
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value ?? 0);
  return 24 * 60 - (value("hour") * 60 + value("minute"));
}

export function yesterdayId(timeZone: string, now = new Date()): string {
  return todayId(timeZone, new Date(now.getTime() - 24 * 60 * 60 * 1000));
}

export function formatKoreanDate(dateId: string): string {
  const date = new Date(`${dateId}T12:00:00`);
  return new Intl.DateTimeFormat("ko-KR", {
    month: "long",
    day: "numeric",
    weekday: "long",
  }).format(date);
}

export function formatKoreanTime(iso: string, withSeconds = false): string {
  return new Intl.DateTimeFormat("ko-KR", {
    hour: "numeric",
    minute: "2-digit",
    second: withSeconds ? "2-digit" : undefined,
    hour12: true,
  }).format(new Date(iso));
}

export function monthRange(timeZone: string, now = new Date()) {
  const id = todayId(timeZone, now);
  const [year, month] = id.split("-").map(Number);
  const days = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return {
    year,
    month,
    first: `${year}-${String(month).padStart(2, "0")}-01`,
    last: `${year}-${String(month).padStart(2, "0")}-${String(days).padStart(2, "0")}`,
    days,
  };
}

export function normalizeQuarterHour(value: string, fallback: string): string {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(value);
  if (!match) return fallback;
  const hour = Number(match[1]);
  const minute = Math.round(Number(match[2]) / 15) * 15;
  const normalizedHour = minute === 60 ? (hour + 1) % 24 : hour;
  return `${String(normalizedHour).padStart(2, "0")}:${String(minute % 60).padStart(2, "0")}`;
}
