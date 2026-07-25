"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo } from "react";
import { BrandMark } from "@/components/BrandMark";
import { CloseIcon, SettingsIcon } from "@/components/Icons";
import { LiftBar } from "@/components/LiftBar";
import { MonthCalendar } from "@/components/MonthCalendar";
import { STRENGTH_LABEL } from "@/lib/catalog";
import { calculateLift, rollupEntries, strengthRate } from "@/lib/stats";
import { useAppStore } from "@/lib/store";
import type { Strength } from "@/lib/types";

export function StatsContent() {
  const router = useRouter();
  const params = useSearchParams();
  const reduceMotion = useReducedMotion();
  const entries = useAppStore((state) => state.entries);
  const timezone = useAppStore((state) => state.timezone);
  const selectedKeys = useAppStore((state) => state.selectedQuestionKeys);
  const questionCatalog = useAppStore((state) => state.questionCatalog);
  const remoteRollup = useAppStore((state) => state.remoteRollup);
  const remoteDays = useAppStore((state) => state.remoteDays);
  const selectedDate = params.get("d");
  const visibleEntries = useMemo(() => entries.filter((entry) => !entry.deletedAt), [entries]);
  const localRollup = useMemo(() => rollupEntries(visibleEntries), [visibleEntries]);
  const rollup = remoteRollup ?? localRollup;
  const dayEntries = selectedDate ? visibleEntries.filter((entry) => entry.date === selectedDate) : [];

  function selectDate(date: string) {
    router.push(`/stats/?d=${date}`, { scroll: false });
  }

  return (
    <main className="page page--stats">
      <header className="mobile-brand stats-mobile-header">
        <BrandMark />
        <Link href="/settings/" className="icon-button" aria-label="설정"><SettingsIcon /></Link>
      </header>
      <header className="stats-heading">
        <div>
          <p className="section-kicker">MY SIGNAL</p>
          <h1>나의 감</h1>
          <p>기록 {rollup.totals.days}일 · 확인한 감 {rollup.totals.resolved}개</p>
        </div>
        <Link href="/settings/" className="settings-link"><SettingsIcon size={19} /> 설정</Link>
      </header>

      <section className="insight-intro">
        <span className="insight-intro__mark">差</span>
        <div><strong>감이 현실과 얼마나 달랐는지 봅니다.</strong><p>전체 적중률 대신, ‘그렇다’고 느낀 날과 아닌 날의 실제 차이를 비교해요.</p></div>
      </section>

      <div className="stats-sections">
        {selectedKeys.map((key) => {
          const catalog = questionCatalog.find((item) => item.key === key);
          if (!catalog) return null;
          const data = rollup.byQuestion[key] ?? {
            label: catalog.label,
            yesOccurred: 0,
            yesNotOccurred: 0,
            noOccurred: 0,
            noNotOccurred: 0,
            uncertain: 0,
          };
          const signal = calculateLift(data);
          const total = signal.nYes + signal.nNo + data.uncertain;
          return (
            <article className="signal-card" key={key}>
              <header><div><span>고정 질문</span><h2>{catalog.label.replace(/\?$/, "")}</h2></div><strong>{total}개</strong></header>
              {signal.state === "insufficient" ? (
                <div className="insufficient-state">
                  <div className="sample-ring" style={{ "--progress": `${Math.min(100, (total / 25) * 100)}%` } as React.CSSProperties}>
                    <span>{total}</span><small>/ 25</small>
                  </div>
                  <div><strong>{signal.message}</strong><p>‘그렇다’와 ‘아니다’가 각각 10개 이상 필요해요.</p></div>
                </div>
              ) : (
                <>
                  <div className="rate-row"><span>{catalog.yesLabel.replace("것 같다", "다고 느낀 날")}</span><strong>{Math.round((signal.pYes ?? 0) * 100)}%</strong><LiftBar value={signal.pYes ?? 0} /></div>
                  <div className="rate-row"><span>{catalog.noLabel.replace("것 같다", "다고 느낀 날")}</span><strong>{Math.round((signal.pNo ?? 0) * 100)}%</strong><LiftBar value={signal.pNo ?? 0} muted /></div>
                  <div className="lift-result"><span>차이</span><strong>{Math.round((signal.lift ?? 0) * 100)}%p</strong><p className={`signal-message signal-message--${signal.state}`}>{signal.message}</p></div>
                </>
              )}
            </article>
          );
        })}
      </div>

      <section className="strength-card">
        <header><p className="section-kicker">STRENGTH</p><h2>감의 세기</h2></header>
        {(["strong", "medium", "faint"] as Strength[]).map((strength) => {
          const value = strengthRate(rollup, strength);
          return (
            <div className="strength-stat" key={strength}>
              <span>{STRENGTH_LABEL[strength]} 느낀 감</span>
              <div className="strength-dots" aria-hidden="true">
                <i /><i className={strength !== "faint" ? "on" : ""} /><i className={strength === "strong" ? "on" : ""} />
              </div>
              <strong>{value.rate === null ? `${value.total}개` : `${value.rate}%`}</strong>
              {value.rate === null && <small>20개부터 비율 표시</small>}
            </div>
          );
        })}
      </section>

      <MonthCalendar timezone={timezone} entries={visibleEntries} days={remoteDays} selectedDate={selectedDate} onSelect={selectDate} />

      <AnimatePresence>
        {selectedDate && (
          <motion.div className="sheet-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <motion.section
              role="dialog"
              aria-modal="true"
              className="bottom-sheet history-sheet"
              initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: "100%" }}
              animate={{ opacity: 1, y: 0 }}
              exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: "100%" }}
              transition={{ type: "spring", bounce: 0.08, duration: 0.38 }}
            >
              <div className="sheet-handle" />
              <header className="sheet-header"><div><span className="section-kicker">HISTORY</span><h2>{selectedDate}</h2></div><button type="button" className="icon-button" onClick={() => router.push("/stats/", { scroll: false })} aria-label="닫기"><CloseIcon /></button></header>
              <div className="history-list">
                {dayEntries.map((entry) => (
                  <article key={entry.id}>
                    <span className={`history-status history-status--${entry.outcome}`} />
                    <div><strong>{entry.questionLabel ?? entry.text}</strong><p>{entry.outcome === "pending" ? "미확인" : entry.outcome === "occurred" ? "일어났어요" : entry.outcome === "not_occurred" ? "일어나지 않았어요" : "판단하기 어려워요"}</p></div>
                  </article>
                ))}
              </div>
            </motion.section>
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  );
}
