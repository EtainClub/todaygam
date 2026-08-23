"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useState } from "react";
import { BrandMark } from "@/components/BrandMark";
import { RecoveryKeyDialog } from "@/components/RecoveryKeyDialog";
import { BellIcon, CheckIcon } from "@/components/Icons";
import { DEFAULT_QUESTION_KEYS } from "@/lib/catalog";
import { normalizeQuarterHour } from "@/lib/day";
import { useAppStore } from "@/lib/store";
import type { NotifySettings } from "@/lib/types";

export default function OnboardingPage() {
  const reduceMotion = useReducedMotion();
  const hydrated = useAppStore((state) => state.hydrated);
  const onboarded = useAppStore((state) => state.onboarded);
  const completeOnboarding = useAppStore((state) => state.completeOnboarding);
  const questionCatalog = useAppStore((state) => state.questionCatalog);
  const firebaseUid = useAppStore((state) => state.firebaseUid);
  const [step, setStep] = useState(1);
  const [selected, setSelected] = useState(DEFAULT_QUESTION_KEYS);
  const [notify, setNotify] = useState<NotifySettings>({
    morningEnabled: false,
    morningHHmm: "08:00",
    eveningEnabled: false,
    eveningHHmm: "21:00",
    unresolvedEnabled: true,
  });
  const [iosGuide, setIosGuide] = useState(false);
  const [recoveryDialog, setRecoveryDialog] = useState(false);

  useEffect(() => {
    // Full document navigation, not router.replace — see ClientProviders.tsx
    // for why the SPA client-router transition is unreliable here.
    if (hydrated && onboarded) window.location.replace("/");
  }, [hydrated, onboarded]);

  function toggleQuestion(key: string) {
    setSelected((current) => {
      if (current.includes(key)) return current.filter((item) => item !== key);
      return current.length < 3 ? [...current, key] : current;
    });
  }

  async function enableNotifications() {
    const isIOS = /iP(hone|ad|od)/.test(navigator.userAgent);
    const standalone = window.matchMedia("(display-mode: standalone)").matches ||
      Boolean((navigator as Navigator & { standalone?: boolean }).standalone);
    if (isIOS && !standalone) {
      setIosGuide(true);
      return;
    }
    let enabled = false;
    if ("Notification" in window) {
      const permission = await Notification.requestPermission();
      enabled = permission === "granted";
    }
    finish({ ...notify, morningEnabled: enabled, eveningEnabled: enabled });
  }

  function finish(value = notify) {
    completeOnboarding(selected, value);
    window.location.replace("/");
  }

  return (
    <main className="onboarding">
      <header><BrandMark /><span>{step} / 3</span></header>
      <div className="onboarding__progress"><span style={{ width: `${(step / 3) * 100}%` }} /></div>
      <AnimatePresence mode="wait">
        <motion.section
          key={step}
          className="onboarding__step"
          initial={reduceMotion ? { opacity: 0 } : { opacity: 0, x: 24 }}
          animate={{ opacity: 1, x: 0 }}
          exit={reduceMotion ? { opacity: 0 } : { opacity: 0, x: -18 }}
          transition={{ type: "spring", bounce: 0, duration: 0.38 }}
        >
          {step === 1 && (
            <>
              <div className="onboarding-visual" aria-hidden="true">
                <span className="visual-card visual-card--back" />
                <span className="visual-card visual-card--front"><i /><i /><i /></span>
                <span className="visual-lock">✓</span>
              </div>
              <p className="section-kicker">먼저 기록하는 습관</p>
              <h1>결과가 나오기 전에<br />당신의 감을 기록합니다.</h1>
              <p className="onboarding__copy">아침에 3번 탭, 저녁에 3번 탭.<br />그게 전부입니다.</p>
              <button type="button" className="primary-button" onClick={() => setStep(2)}>다음</button>
              {firebaseUid && (
                <button type="button" className="text-button onboarding-later" onClick={() => setRecoveryDialog(true)}>
                  복구 키로 이전 기록 불러오기
                </button>
              )}
            </>
          )}
          {step === 2 && (
            <>
              <p className="section-kicker">매일 같은 기준으로</p>
              <h1>매일 답할 질문<br />3개를 고르세요.</h1>
              <p className="onboarding__copy">나중에 바꿀 수 있어요. 이전 기록은 그대로 남습니다.</p>
              <div className="question-selector">
                {questionCatalog.map((question) => {
                  const checked = selected.includes(question.key);
                  return (
                    <button
                      type="button"
                      key={question.key}
                      className={checked ? "is-selected" : ""}
                      onClick={() => toggleQuestion(question.key)}
                      aria-pressed={checked}
                    >
                      <span>{checked && <CheckIcon size={15} />}</span>
                      {question.label}
                    </button>
                  );
                })}
              </div>
              <button type="button" className="primary-button sticky-action" disabled={selected.length !== 3} onClick={() => setStep(3)}>
                {selected.length === 3 ? "3개 선택 완료" : `${selected.length}/3 선택`}
              </button>
            </>
          )}
          {step === 3 && (
            <>
              <div className="notification-visual"><BellIcon size={30} /></div>
              <p className="section-kicker">원할 때만</p>
              <h1>언제 알려드릴까요?</h1>
              <p className="onboarding__copy">알림은 이 단계에서만 요청합니다.<br />설정에서 언제든 끌 수 있어요.</p>
              <div className="time-settings">
                <label><span>아침</span><input type="time" step="900" value={notify.morningHHmm} onChange={(event) => setNotify({ ...notify, morningHHmm: normalizeQuarterHour(event.target.value, notify.morningHHmm) })} /></label>
                <label><span>저녁</span><input type="time" step="900" value={notify.eveningHHmm} onChange={(event) => setNotify({ ...notify, eveningHHmm: normalizeQuarterHour(event.target.value, notify.eveningHHmm) })} /></label>
              </div>
              {iosGuide && (
                <aside className="ios-guide">
                  <strong>먼저 홈 화면에 추가해 주세요</strong>
                  <span>Safari 공유 버튼 → ‘홈 화면에 추가’ 후 앱을 다시 열면 알림을 켤 수 있어요.</span>
                </aside>
              )}
              <button type="button" className="primary-button" onClick={() => void enableNotifications()}>알림 켜기</button>
              <button type="button" className="text-button onboarding-later" onClick={() => finish()}>나중에</button>
            </>
          )}
        </motion.section>
      </AnimatePresence>
      {recoveryDialog && (
        <RecoveryKeyDialog mode="redeem" onClose={() => setRecoveryDialog(false)} />
      )}
    </main>
  );
}
