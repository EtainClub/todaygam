"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import Link from "next/link";
import { useState } from "react";
import { ArrowLeftIcon, BellIcon, CheckIcon, ChevronRightIcon, CloudIcon, DownloadIcon, TrashIcon } from "@/components/Icons";
import { RecoveryKeyDialog } from "@/components/RecoveryKeyDialog";
import {
  deleteUserDataRemote,
  fetchFullExportRemote,
} from "@/lib/firebase/sync";
import { useAppStore } from "@/lib/store";
import { normalizeQuarterHour } from "@/lib/day";

export default function SettingsPage() {
  const reduceMotion = useReducedMotion();
  const {
    notify,
    updateNotify,
    selectedQuestionKeys,
    saveQuestions,
    entries,
    timezone,
    questionCatalog,
    setTimezone,
    firebaseUid,
    recoveryKeyIssuedAt,
    deleteAllData,
  } = useAppStore();
  const [questionEditor, setQuestionEditor] = useState(false);
  const [draftQuestions, setDraftQuestions] = useState(selectedQuestionKeys);
  const [draftQuestionLabels, setDraftQuestionLabels] = useState<Record<string, string>>({});
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [exportMessage, setExportMessage] = useState("");
  const [exporting, setExporting] = useState(false);
  const [recoveryDialog, setRecoveryDialog] = useState<"issue" | "redeem" | null>(null);
  const canSaveQuestions =
    draftQuestions.length === 3 &&
    draftQuestions.every((key) => {
      const question = questionCatalog.find((item) => item.key === key);
      return Boolean((draftQuestionLabels[key] ?? question?.label ?? "").trim());
    });

  function openQuestionEditor() {
    setDraftQuestions(selectedQuestionKeys);
    setDraftQuestionLabels({});
    setQuestionEditor(true);
  }

  function closeQuestionEditor() {
    setQuestionEditor(false);
    setDraftQuestionLabels({});
  }

  function toggleDraftQuestion(key: string) {
    setDraftQuestions((current) => {
      if (current.includes(key)) return current.filter((item) => item !== key);
      return current.length < 3 ? [...current, key] : current;
    });
  }

  function saveQuestionChanges() {
    saveQuestions(draftQuestions, draftQuestionLabels);
    closeQuestionEditor();
  }

  async function toggleNotification(key: "morningEnabled" | "eveningEnabled" | "unresolvedEnabled") {
    if (!notify[key] && key !== "unresolvedEnabled" && "Notification" in window) {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") return;
    }
    updateNotify({ [key]: !notify[key] });
  }

  async function exportData() {
    if (exporting) return;
    setExporting(true);
    setExportMessage("");
    try {
      const remote = firebaseUid ? await fetchFullExportRemote(firebaseUid) : null;
      const mergedEntries = new Map(
        (remote?.entries ?? []).map((entry) => [entry.id, entry]),
      );
      entries.forEach((entry) => mergedEntries.set(entry.id, entry));
      const payload = {
        exportedAt: new Date().toISOString(),
        version: 2,
        source: remote ? "firebase-and-local" : "local",
        timezone,
        questions: selectedQuestionKeys,
        entries: Array.from(mergedEntries.values()),
        remote: remote
          ? {
              profile: remote.profile,
              questions: remote.questions,
              days: remote.days,
              rollup: remote.rollup,
              audit: remote.audit,
            }
          : null,
      };
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `oneulgam-${new Date().toISOString().slice(0, 10)}.json`;
      link.click();
      URL.revokeObjectURL(url);
      setExportMessage(`${mergedEntries.size}개 기록을 내보냈어요.`);
    } catch {
      setExportMessage("전체 기록을 가져오지 못했습니다. 인터넷 연결 후 다시 시도해 주세요.");
    } finally {
      setExporting(false);
    }
  }

  return (
    <main className="page page--settings">
      <header className="settings-heading"><Link href="/stats/" className="icon-button" aria-label="나의 감으로 돌아가기"><ArrowLeftIcon /></Link><h1>설정</h1><span /></header>

      <section className="settings-group">
        <h2>알림</h2>
        <div className="settings-card">
          <div className="settings-row">
            <span className="settings-row__icon"><BellIcon size={19} /></span>
            <label><span><strong>아침 알림</strong><small>오늘의 감을 기록할 시간</small></span><input type="time" step="900" value={notify.morningHHmm} onChange={(event) => updateNotify({ morningHHmm: normalizeQuarterHour(event.target.value, notify.morningHHmm) })} /><button type="button" role="switch" aria-checked={notify.morningEnabled} className={`toggle ${notify.morningEnabled ? "is-on" : ""}`} onClick={() => void toggleNotification("morningEnabled")}><span /></button></label>
          </div>
          <div className="settings-row">
            <span className="settings-row__icon"><BellIcon size={19} /></span>
            <label><span><strong>저녁 알림</strong><small>결과를 확인할 시간</small></span><input type="time" step="900" value={notify.eveningHHmm} onChange={(event) => updateNotify({ eveningHHmm: normalizeQuarterHour(event.target.value, notify.eveningHHmm) })} /><button type="button" role="switch" aria-checked={notify.eveningEnabled} className={`toggle ${notify.eveningEnabled ? "is-on" : ""}`} onClick={() => void toggleNotification("eveningEnabled")}><span /></button></label>
          </div>
          <div className="settings-row">
            <span className="settings-row__icon"><BellIcon size={19} /></span>
            <label><span><strong>미확인 리마인드</strong><small>다음 날 아침 한 번만</small></span><button type="button" role="switch" aria-checked={notify.unresolvedEnabled} className={`toggle ${notify.unresolvedEnabled ? "is-on" : ""}`} onClick={() => void toggleNotification("unresolvedEnabled")}><span /></button></label>
          </div>
        </div>
      </section>

      <section className="settings-group">
        <h2>질문</h2>
        <button type="button" className="settings-link-card" onClick={openQuestionEditor}>
          <span><strong>나의 질문 3개 관리</strong><small>{selectedQuestionKeys.map((key) => questionCatalog.find((item) => item.key === key)?.label.replace(/\?$/, "")).join(" · ")}</small></span>
          <ChevronRightIcon />
        </button>
      </section>

      <section className="settings-group">
        <h2>계정</h2>
        <div className="settings-card">
          <div className="account-row">
            <span className="settings-row__icon"><CloudIcon size={19} /></span>
            <span>
              <strong>{recoveryKeyIssuedAt ? "복구 키로 보호됨" : firebaseUid ? "이 기기에서만 사용 중" : "이 기기에 저장 중"}</strong>
              <small>
                {recoveryKeyIssuedAt
                  ? "복구 키가 있으면 다른 기기에서도 기록을 이어볼 수 있어요."
                  : firebaseUid
                    ? "복구 키를 만들어 두면 기기를 바꿔도 기록을 이어볼 수 있어요."
                    : "Firebase 키가 없어 로컬 모드로 동작합니다."}
              </small>
            </span>
            <button type="button" disabled={!firebaseUid} onClick={() => setRecoveryDialog("issue")}>
              {recoveryKeyIssuedAt ? "새 복구 키 발급" : "복구 키 만들기"}
            </button>
          </div>
        </div>
        <button type="button" className="settings-link-card" disabled={!firebaseUid} onClick={() => setRecoveryDialog("redeem")}>
          <span><strong>다른 기기의 기록 불러오기</strong><small>발급받은 복구 키를 입력하세요.</small></span>
          <ChevronRightIcon />
        </button>
      </section>

      <section className="settings-group">
        <h2>데이터</h2>
        <div className="settings-card">
          <button type="button" className="data-row" disabled={exporting} onClick={() => void exportData()}><DownloadIcon size={19} /><span><strong>{exporting ? "전체 기록 가져오는 중" : "내 기록 내보내기"}</strong><small>JSON 파일 · 서버의 전체 기록 포함</small></span><ChevronRightIcon size={18} /></button>
          {exportMessage && <p className="settings-message">{exportMessage}</p>}
          <button type="button" className="data-row data-row--danger" onClick={() => setDeleteConfirm(true)}><TrashIcon size={19} /><span><strong>모든 기록 삭제</strong><small>{firebaseUid ? "이 기기와 Firebase의 오늘감 데이터를 지웁니다." : "이 기기의 오늘감 데이터를 지웁니다."}</small></span><ChevronRightIcon size={18} /></button>
        </div>
      </section>

      <section className="settings-group">
        <h2>시간대</h2>
        <label className="timezone-card"><span><strong>기록 기준 시간대</strong><small>여행 중에도 자동으로 바뀌지 않아요.</small></span><select value={timezone} onChange={(event) => setTimezone(event.target.value)}><option value="Asia/Seoul">서울 (Asia/Seoul)</option><option value="Asia/Tokyo">도쿄 (Asia/Tokyo)</option><option value="America/Los_Angeles">로스앤젤레스</option><option value="Europe/London">런던</option></select></label>
      </section>
      <footer className="settings-footer"><strong>오늘감</strong><span>버전 1.0.0</span><p>결과가 나오기 전에 기록하고, 우연과 구분되는지 확인하세요.</p></footer>

      <AnimatePresence>
        {questionEditor && (
          <motion.div className="sheet-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <motion.section className="bottom-sheet question-editor" role="dialog" aria-modal="true" initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: "100%" }} animate={{ opacity: 1, y: 0 }} exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: "100%" }} transition={{ type: "spring", bounce: 0.08, duration: 0.38 }}>
              <div className="sheet-handle" /><header className="sheet-header"><div><span className="section-kicker">QUESTIONS</span><h2>나의 질문 3개</h2></div><button type="button" className="text-button" onClick={closeQuestionEditor}>취소</button></header>
              <p className="sheet-copy">3개를 고르고 문구를 직접 수정하세요. 이전 기록과 통계는 그대로 보존됩니다.</p>
              <div className="question-selector">
                {questionCatalog.map((question) => {
                  const checked = draftQuestions.includes(question.key);
                  const label = draftQuestionLabels[question.key] ?? question.label;
                  return (
                    <div key={question.key} className={`question-editor__item ${checked ? "is-selected" : ""}`}>
                      <button
                        type="button"
                        className="question-editor__toggle"
                        aria-label={`${label} ${checked ? "선택 해제" : "선택"}`}
                        aria-pressed={checked}
                        disabled={!checked && draftQuestions.length === 3}
                        onClick={() => toggleDraftQuestion(question.key)}
                      >
                        <span>{checked ? <CheckIcon size={15} /> : null}</span>
                      </button>
                      <input
                        className="question-editor__label"
                        value={label}
                        maxLength={40}
                        aria-label={`${question.label} 문구 수정`}
                        onChange={(event) => setDraftQuestionLabels((current) => ({
                          ...current,
                          [question.key]: event.target.value,
                        }))}
                      />
                    </div>
                  );
                })}
              </div>
              <button
                type="button"
                className="primary-button"
                disabled={!canSaveQuestions}
                onClick={saveQuestionChanges}
              >
                3개 질문 저장
              </button>
            </motion.section>
          </motion.div>
        )}
        {deleteConfirm && (
          <motion.div className="sheet-backdrop sheet-backdrop--center" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <motion.section className="confirm-dialog" role="alertdialog" aria-modal="true" initial={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.94 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.96 }}>
              <span className="danger-icon"><TrashIcon /></span><h2>모든 기록을 삭제할까요?</h2><p>{firebaseUid ? "이 기기와 Firebase에 저장된" : "이 기기에 저장된"} 질문, 감, 통계가 모두 사라집니다. 먼저 JSON으로 내보낼 수 있어요.</p>
              <div><button type="button" className="secondary-button" onClick={() => setDeleteConfirm(false)}>취소</button><button type="button" className="danger-button" onClick={() => { void (async () => { if (firebaseUid) await deleteUserDataRemote(); deleteAllData(); setDeleteConfirm(false); window.location.href = "/onboarding/"; })(); }}>모두 삭제</button></div>
            </motion.section>
          </motion.div>
        )}
      </AnimatePresence>
      {recoveryDialog && (
        <RecoveryKeyDialog mode={recoveryDialog} onClose={() => setRecoveryDialog(null)} />
      )}
    </main>
  );
}
