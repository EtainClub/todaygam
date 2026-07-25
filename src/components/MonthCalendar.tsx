"use client";

import { monthRange } from "@/lib/day";
import type { DaySummary, Entry } from "@/lib/types";

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

export function MonthCalendar({
  timezone,
  entries,
  days,
  selectedDate,
  onSelect,
}: {
  timezone: string;
  entries: Entry[];
  days?: DaySummary[];
  selectedDate: string | null;
  onSelect: (date: string) => void;
}) {
  const range = monthRange(timezone);
  const firstWeekday = new Date(Date.UTC(range.year, range.month - 1, 1)).getUTCDay();
  const cells: Array<number | null> = [
    ...Array.from({ length: firstWeekday }, () => null),
    ...Array.from({ length: range.days }, (_, index) => index + 1),
  ];
  const byDate = new Map<string, Entry[]>();
  entries.filter((entry) => !entry.deletedAt).forEach((entry) => {
    const list = byDate.get(entry.date) ?? [];
    list.push(entry);
    byDate.set(entry.date, list);
  });
  const summaryByDate = new Map((days ?? []).map((day) => [day.date, day]));

  return (
    <section className="calendar-card">
      <header><h2>{range.month}월</h2><span>날짜를 눌러 기록 보기</span></header>
      <div className="calendar-grid calendar-grid--weekdays">
        {WEEKDAYS.map((day) => <span key={day}>{day}</span>)}
      </div>
      <div className="calendar-grid">
        {cells.map((day, index) => {
          if (!day) return <span key={`empty-${index}`} />;
          const date = `${range.year}-${String(range.month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
          const dayEntries = byDate.get(date) ?? [];
          const summary = summaryByDate.get(date);
          const hasRecord = Boolean(summary) || dayEntries.length > 0;
          const hasPending = summary ? (summary.pendingCount ?? 0) > 0 : dayEntries.some((entry) => entry.outcome === "pending");
          const complete = hasRecord && !hasPending;
          return (
            <button
              key={date}
              type="button"
              className={`${selectedDate === date ? "is-selected" : ""} ${complete ? "is-complete" : ""} ${hasPending ? "has-pending" : ""}`}
              disabled={!hasRecord}
              onClick={() => onSelect(date)}
              aria-label={`${date}${complete ? ", 기록 완료" : hasPending ? ", 미확인 기록 있음" : ", 기록 없음"}`}
            >
              <span>{day}</span>
              {hasRecord && <i />}
            </button>
          );
        })}
      </div>
      <footer><span><i className="complete" /> 기록 완료</span><span><i className="pending" /> 미확인</span></footer>
    </section>
  );
}
