"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import Link from "next/link";
import { useState } from "react";
import { ArrowLeftIcon, BellIcon, CheckIcon, ChevronRightIcon, CloudIcon, DownloadIcon, TrashIcon } from "@/components/Icons";
import { connectGoogleAccount } from "@/lib/firebase/auth";
import { isFirebaseConfigured } from "@/lib/firebase/client";
import {
  deleteUserDataRemote,
  fetchFullExportRemote,
  migrateLocalEntriesRemote,
} from "@/lib/firebase/sync";
import { useAppStore } from "@/lib/store";
import { normalizeQuarterHour } from "@/lib/day";

export default function SettingsPage() {
  const reduceMotion = useReducedMotion();
  const {
    notify,
    updateNotify,
    selectedQuestionKeys,
    replaceQuestions,
    entries,
    timezone,
    questionCatalog,
    setTimezone,
    firebaseUid,
    accountLinked,
    deleteAllData,
  } = useAppStore();
  const [questionEditor, setQuestionEditor] = useState(false);
  const [draftQuestions, setDraftQuestions] = useState(selectedQuestionKeys);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [accountMessage, setAccountMessage] = useState("");
  const [exportMessage, setExportMessage] = useState("");
  const [exporting, setExporting] = useState(false);

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

  async function linkAccount() {
    if (!isFirebaseConfigured()) {
      setAccountMessage("Firebase 환경 키를 연결하면 Google 계정으로 전환할 수 있어요.");
      return;
    }
    try {
      const result = await connectGoogleAccount();
      const migrated = await migrateLocalEntriesRemote(result.user.uid, entries);
      setAccountMessage(
        result.mode === "signed-in"
          ? `기존 Google 계정으로 로그인했습니다${migrated ? ` · 이 기기의 기록 ${migrated}개를 옮겼어요` : ""}.`
          : result.mode === "linked"
            ? `Google 계정에 연결했습니다${migrated ? ` · 기록 ${migrated}개를 동기화했어요` : ""}.`
            : migrated
              ? `누락된 기록 ${migrated}개를 동기화했어요.`
              : "Google 계정 동기화가 최신 상태입니다.",
      );
    } catch (error) {
      setAccountMessage(error instanceof Error ? error.message : "계정 연결에 실패했어요.");
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
        <button type="button" className="settings-link-card" onClick={() => setQuestionEditor(true)}>
          <span><strong>나의 질문 3개 관리</strong><small>{selectedQuestionKeys.map((key) => questionCatalog.find((item) => item.key === key)?.label.replace(/\?$/, "")).join(" · ")}</small></span>
          <ChevronRightIcon />
        </button>
      </section>

      <section className="settings-group">
        <h2>계정</h2>
        <div className="settings-card">
          <div className="account-row">
            <span className="settings-row__icon"><CloudIcon size={19} /></span>
            <span><strong>{accountLinked ? "Google 계정으로 동기화 중" : firebaseUid ? "익명으로 동기화 중" : "이 기기에 저장 중"}</strong><small>{firebaseUid ? "Firebase 보안 규칙으로 보호됩니다." : "Firebase 키가 없어 로컬 모드로 동작합니다."}</small></span>
            <button type="button" onClick={() => void linkAccount()}>{accountLinked ? "동기화 확인" : "계정 연결"}</button>
          </div>
          {accountMessage && <p className="settings-message">{accountMessage}</p>}
        </div>
      </section>

      <section className="settings-group">
        <h2>데이터</h2>
        <div className="settings-card">
          <button type="button" className="data-row" disabled={exporting} onClick={() => void exportData()}><DownloadIcon size={19} /><span><strong>{exporting ? "전체 기록 가져오는 중" : "내 기록 내보내기"}</strong><small>JSON 파일 · 서버의 전체 기록 포함</small></span><ChevronRightIcon size={18} /></button>
          {exportMessage && <p className="settings-message">{exportMessage}</p>}
          <button type="button" className="data-row data-row--danger" onClick={() => setDeleteConfirm(true)}><TrashIcon size={19} /><span><strong>모든 기록 삭제</strong><small>이 기기의 오늘감 데이터를 지웁니다.</small></span><ChevronRightIcon size={18} /></button>
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
              <div className="sheet-handle" /><header className="sheet-header"><div><span className="section-kicker">QUESTIONS</span><h2>나의 질문 3개</h2></div><button type="button" className="text-button" onClick={() => setQuestionEditor(false)}>취소</button></header>
              <p className="sheet-copy">교체해도 이전 질문의 통계는 그대로 보존됩니다.</p>
              <div className="question-selector">
                {questionCatalog.map((question) => {
                  const checked = draftQuestions.includes(question.key);
                  return <button type="button" key={question.key} className={checked ? "is-selected" : ""} onClick={() => setDraftQuestions((current) => checked ? current.filter((key) => key !== question.key) : current.length < 3 ? [...current, question.key] : current)}><span>{checked && <CheckIcon size={15} />}</span>{question.label}</button>;
                })}
              </div>
              <button type="button" className="primary-button" disabled={draftQuestions.length !== 3} onClick={() => { replaceQuestions(draftQuestions); setQuestionEditor(false); }}>3개 질문 저장</button>
            </motion.section>
          </motion.div>
        )}
        {deleteConfirm && (
          <motion.div className="sheet-backdrop sheet-backdrop--center" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <motion.section className="confirm-dialog" role="alertdialog" aria-modal="true" initial={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.94 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.96 }}>
              <span className="danger-icon"><TrashIcon /></span><h2>모든 기록을 삭제할까요?</h2><p>이 기기에 저장된 질문, 감, 통계가 모두 사라집니다. 먼저 JSON으로 내보낼 수 있어요.</p>
              <div><button type="button" className="secondary-button" onClick={() => setDeleteConfirm(false)}>취소</button><button type="button" className="danger-button" onClick={() => { void (async () => { if (firebaseUid) await deleteUserDataRemote(); deleteAllData(); setDeleteConfirm(false); window.location.href = "/onboarding/"; })(); }}>모두 삭제</button></div>
            </motion.section>
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  );
}
