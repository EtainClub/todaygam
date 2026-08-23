"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { ANSWER_LABEL, STRENGTH_LABEL } from "@/lib/catalog";
import { formatKoreanTime } from "@/lib/day";
import { useAppStore } from "@/lib/store";
import type { Answer, Entry, Question, Strength } from "@/lib/types";
import { CheckIcon, LockIcon } from "./Icons";
import { StrengthPicker } from "./StrengthPicker";

export function QuestionCard({
  question,
  entry,
  reviewing,
}: {
  question?: Question;
  entry?: Entry;
  reviewing: boolean;
}) {
  const reduceMotion = useReducedMotion();
  const addFixedEntry = useAppStore((state) => state.addFixedEntry);
  const resolveEntry = useAppStore((state) => state.resolveEntry);
  const updateOutcomeNote = useAppStore((state) => state.updateOutcomeNote);
  const softDeleteEntry = useAppStore((state) => state.softDeleteEntry);
  const [answer, setAnswer] = useState<Answer | null>(null);
  const [saving, setSaving] = useState(false);
  const [showNote, setShowNote] = useState(false);
  const [note, setNote] = useState(entry?.outcomeNote ?? "");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!answer || entry || !question) return;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      void save("medium");
    }, 3000);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
    // save is intentionally bound to the current answer.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [answer, entry, question]);

  async function save(strength: Strength) {
    if (!answer || !question || saving || entry) return;
    if (timer.current) clearTimeout(timer.current);
    setSaving(true);
    await addFixedEntry(question.key, answer, strength);
  }

  function chooseOutcome(outcome: "occurred" | "not_occurred" | "uncertain") {
    if (!entry || entry.outcome !== "pending") return;
    resolveEntry(entry.id, outcome);
    setShowNote(true);
  }

  if (!entry && question) {
    return (
      <motion.article layout className="question-card" transition={{ type: "spring", bounce: 0, duration: 0.35 }}>
        <h2>{question.label}</h2>
        <div className="answer-row">
          <button
            type="button"
            className={`answer-button ${answer === "yes" ? "is-selected" : ""}`}
            onClick={() => setAnswer("yes")}
            aria-pressed={answer === "yes"}
          >
            {ANSWER_LABEL.yes}{answer === "yes" && <CheckIcon size={16} />}
          </button>
          <button
            type="button"
            className={`answer-button ${answer === "no" ? "is-selected" : ""}`}
            onClick={() => setAnswer("no")}
            aria-pressed={answer === "no"}
          >
            {ANSWER_LABEL.no}{answer === "no" && <CheckIcon size={16} />}
          </button>
        </div>
        <AnimatePresence initial={false}>
          {answer && (
            <motion.div
              initial={reduceMotion ? { opacity: 0 } : { opacity: 0, height: 0, y: -8 }}
              animate={{ opacity: 1, height: "auto", y: 0 }}
              exit={reduceMotion ? { opacity: 0 } : { opacity: 0, height: 0, y: -8 }}
              transition={{ type: "spring", bounce: 0, duration: 0.32 }}
            >
              <StrengthPicker onSelect={(strength) => void save(strength)} disabled={saving} />
            </motion.div>
          )}
        </AnimatePresence>
      </motion.article>
    );
  }

  if (!entry) return null;
  const title = entry.type === "fixed" ? entry.questionLabel : entry.text;
  const lockedAnswer = entry.type === "fixed"
    ? ANSWER_LABEL[entry.answer as Answer]
    : "자유롭게 남긴 감";
  const isResolved = entry.outcome !== "pending";

  return (
    <motion.article
      layout
      className={`question-card question-card--locked ${reviewing ? "is-reviewing" : ""}`}
      initial={false}
      animate={{ rotateY: reviewing ? 0 : 0 }}
      transition={{ type: "spring", bounce: 0, duration: 0.4 }}
    >
      <div className="question-card__eyebrow">
        {isResolved ? <span className="resolved-check"><CheckIcon size={13} /> 확인 완료</span> : <span><LockIcon size={13} /> 잠긴 감</span>}
      </div>
      <h2>{title}</h2>
      <p className="locked-answer">당신의 감 · {lockedAnswer} <span>({STRENGTH_LABEL[entry.strength]})</span></p>

      {reviewing && entry.outcome === "pending" ? (
        <motion.div
          className="outcome-panel"
          initial={reduceMotion ? { opacity: 0 } : { opacity: 0, rotateX: -16, y: 8 }}
          animate={{ opacity: 1, rotateX: 0, y: 0 }}
          transition={{ type: "spring", bounce: 0, duration: 0.42 }}
        >
          <div className="outcome-row">
            <button type="button" onClick={() => chooseOutcome("occurred")}>일어났어요</button>
            <button type="button" onClick={() => chooseOutcome("not_occurred")}>안 일어났어요</button>
          </div>
          <button type="button" className="uncertain-button" onClick={() => chooseOutcome("uncertain")}>
            판단하기 어려워요
          </button>
        </motion.div>
      ) : isResolved ? (
        <div className="resolved-panel">
          <p>
            {entry.outcome === "occurred"
              ? "일어났어요"
              : entry.outcome === "not_occurred"
                ? "일어나지 않았어요"
                : "판단하기 어려워요"}
          </p>
          {showNote || entry.outcomeNote ? (
            <textarea
              value={note}
              maxLength={140}
              rows={2}
              placeholder="기억해 둘 메모가 있나요? (선택)"
              onChange={(event) => setNote(event.target.value)}
              onBlur={() => updateOutcomeNote(entry.id, note.trim() || null)}
            />
          ) : (
            <button type="button" className="text-button" onClick={() => setShowNote(true)}>메모 남기기</button>
          )}
        </div>
      ) : (
        <>
          <div className="lock-meta">
            <span>{formatKoreanTime(entry.lockedAt, true)} · 수정할 수 없습니다</span>
            <code>{entry.contentHash.slice(0, 17)}…</code>
          </div>
          {confirmDelete ? (
            <div className="delete-entry-confirm">
              <span>삭제 기록을 남기고 다시 작성할까요?</span>
              <button type="button" onClick={() => setConfirmDelete(false)}>취소</button>
              <button type="button" onClick={() => softDeleteEntry(entry.id)}>삭제</button>
            </div>
          ) : (
            <button type="button" className="delete-entry-button" onClick={() => setConfirmDelete(true)}>
              삭제하고 다시 기록
            </button>
          )}
        </>
      )}
    </motion.article>
  );
}
