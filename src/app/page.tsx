"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { BrandMark } from "@/components/BrandMark";
import { FreeEntrySheet } from "@/components/FreeEntrySheet";
import { CheckIcon, PlusIcon } from "@/components/Icons";
import { QuestionCard } from "@/components/QuestionCard";
import { YesterdayBanner } from "@/components/YesterdayBanner";
import { formatKoreanDate, todayId, yesterdayId } from "@/lib/day";
import { isHit } from "@/lib/stats";
import { markLinkPromptShownRemote } from "@/lib/firebase/sync";
import { useAppStore } from "@/lib/store";

export default function TodayPage() {
  const router = useRouter();
  const reduceMotion = useReducedMotion();
  const {
    hydrated,
    onboarded,
    timezone,
    questionCatalog,
    selectedQuestionKeys,
    entries,
    reviewDates,
    dismissedYesterdayDates,
    openReview,
    firebaseUid,
    accountLinked,
    linkPromptDismissed,
    dismissLinkPrompt,
  } = useAppStore();
  const [now, setNow] = useState(() => new Date());
  const [freeSheetOpen, setFreeSheetOpen] = useState(false);
  const date = todayId(timezone, now);
  const yesterday = yesterdayId(timezone, now);

  useEffect(() => {
    if (hydrated && !onboarded) router.replace("/onboarding/");
  }, [hydrated, onboarded, router]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  const visibleEntries = useMemo(
    () => entries.filter((entry) => !entry.deletedAt),
    [entries],
  );
  const yesterdayPending = visibleEntries.filter(
    (entry) => entry.date === yesterday && entry.outcome === "pending",
  );
  const pendingReviewDate = reviewDates.find(
    (reviewDate) =>
      reviewDate < date &&
      visibleEntries.some((entry) => entry.date === reviewDate && entry.outcome === "pending"),
  );
  const activeDate = pendingReviewDate ?? date;
  const activeEntries = visibleEntries
    .filter((entry) => entry.date === activeDate)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const todayEntries = visibleEntries.filter((entry) => entry.date === date);
  const fixedToday = todayEntries.filter((entry) => entry.type === "fixed");
  const freeToday = todayEntries.filter((entry) => entry.type === "free");
  const allFixedAnswered = selectedQuestionKeys.every((key) =>
    fixedToday.some((entry) => entry.questionKey === key),
  );
  const configuredEvening = useAppStore((state) => state.notify.eveningHHmm);
  const currentHHmm = new Intl.DateTimeFormat("en-GB", {
    timeZone: timezone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(now);
  const reviewing = activeDate < date || reviewDates.includes(activeDate) || (allFixedAnswered && currentHHmm >= configuredEvening);
  const activePending = activeEntries.filter((entry) => entry.outcome === "pending");
  const activeComplete = activeEntries.length > 0 && activePending.length === 0;
  const todayComplete = todayEntries.length > 0 && todayEntries.every((entry) => entry.outcome !== "pending");
  const selectedQuestions = selectedQuestionKeys
    .map((key) => questionCatalog.find((question) => question.key === key))
    .filter((question): question is NonNullable<typeof question> => Boolean(question));

  if (!hydrated || !onboarded) {
    return (
      <main className="loading-screen">
        <BrandMark />
        <span className="loading-pulse" />
      </main>
    );
  }

  const hits = activeEntries.filter((entry) => isHit(entry) === true).length;
  const misses = activeEntries.filter((entry) => isHit(entry) === false).length;

  return (
    <main className="page page--today">
      <header className="mobile-brand"><BrandMark /></header>
      {yesterdayPending.length > 0 && !dismissedYesterdayDates.includes(yesterday) && activeDate === date && (
        <YesterdayBanner date={yesterday} count={yesterdayPending.length} />
      )}

      <section className="page-heading">
        <p className="section-kicker">{activeDate < date ? "미완료 기록" : "TODAY"}</p>
        <h1>{activeDate < date ? "어제의 감을 정리해요" : formatKoreanDate(date)}</h1>
        <p>
          {activeDate < date
            ? "남겨둔 판단을 차분히 마무리해 주세요."
            : !allFixedAnswered
              ? "머뭇거리지 말고, 먼저 떠오른 쪽을 골라보세요."
              : reviewing && !activeComplete
                ? `오늘의 결과를 확인해 주세요 · ${activeEntries.length - activePending.length}/${activeEntries.length}`
                : !reviewing
                  ? `오늘의 감 · ${fixedToday.length}개 잠김`
                  : "오늘 기록을 마쳤어요."}
        </p>
      </section>

      <AnimatePresence mode="popLayout">
        {activeComplete ? (
          <motion.section
            key="complete"
            className="completion-card"
            initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: "spring", bounce: 0, duration: 0.4 }}
          >
            <span className="completion-check"><CheckIcon size={27} /></span>
            <h2>{activeDate < date ? "어제 기록을 마쳤어요." : "오늘 기록을 마쳤어요."}</h2>
            <p>맞은 감 {hits} · 다른 감 {misses}</p>
            <div className="completion-streak">
              <span>차곡차곡 쌓이는 중</span>
              <strong>{new Set(visibleEntries.map((entry) => entry.date)).size}일의 기록</strong>
            </div>
            {activeDate < date && !todayComplete ? (
              <button type="button" className="primary-button" onClick={() => window.location.reload()}>
                오늘로 돌아가기
              </button>
            ) : (
              <Link href="/stats/" className="primary-button">나의 감 보기</Link>
            )}
          </motion.section>
        ) : (
          <motion.div key={activeDate} className="question-stack" layout>
            {activeDate === date && !allFixedAnswered
              ? selectedQuestions.map((question) => (
                  <QuestionCard
                    key={question.key}
                    question={question}
                    entry={fixedToday.find((entry) => entry.questionKey === question.key)}
                    reviewing={false}
                  />
                ))
              : activeEntries.map((entry) => (
                  <QuestionCard
                    key={entry.id}
                    question={entry.questionKey ? questionCatalog.find((item) => item.key === entry.questionKey) : undefined}
                    entry={entry}
                    reviewing={reviewing}
                  />
                ))}
          </motion.div>
        )}
      </AnimatePresence>

      {activeDate === date && allFixedAnswered && !reviewing && (
        <section className="locked-summary">
          <div>
            <span className="locked-summary__icon">✓</span>
            <p><strong>{fixedToday.length}개의 감이 잠겼어요</strong><span>결과가 정해질 때까지 그대로 보관됩니다.</span></p>
          </div>
          <button type="button" className="secondary-button" onClick={() => openReview(date)}>지금 결과 확인하기</button>
        </section>
      )}

      {activeDate === date && allFixedAnswered && !reviewing && freeToday.length < 3 && (
        <button type="button" className="add-free-button" onClick={() => setFreeSheetOpen(true)}>
          <PlusIcon size={19} />
          <span>오늘 떠오른 감 적기</span>
          <small>{freeToday.length}/3</small>
        </button>
      )}
      {firebaseUid && !accountLinked && visibleEntries.length >= 15 && !linkPromptDismissed && (
        <aside className="link-account-card">
          <div><strong>기록을 다른 기기에서도 이어가세요.</strong><span>익명 기록을 Google 계정에 안전하게 연결할 수 있어요.</span></div>
          <Link href="/settings/" onClick={() => { dismissLinkPrompt(); void markLinkPromptShownRemote(firebaseUid); }}>계정 연결</Link>
          <button type="button" aria-label="계정 연결 안내 닫기" onClick={() => { dismissLinkPrompt(); void markLinkPromptShownRemote(firebaseUid); }}>나중에</button>
        </aside>
      )}
      <FreeEntrySheet open={freeSheetOpen} onClose={() => setFreeSheetOpen(false)} />
    </main>
  );
}
