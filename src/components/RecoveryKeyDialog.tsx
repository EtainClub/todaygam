"use client";

import { useState } from "react";
import { signInWithRecoveryToken } from "@/lib/firebase/auth";
import {
  generateRecoveryKeyRemote,
  migrateLocalEntriesRemote,
  redeemRecoveryKeyRemote,
} from "@/lib/firebase/sync";
import { useAppStore } from "@/lib/store";

type Mode = "issue" | "redeem";

function errorMessage(mode: Mode, error: unknown) {
  const code = error && typeof error === "object" && "code" in error ? String(error.code) : "";
  if (mode === "redeem" && code === "functions/not-found") {
    return "복구 키를 찾을 수 없어요. 다시 확인해 주세요.";
  }
  return mode === "issue"
    ? "복구 키를 만들지 못했어요. 잠시 후 다시 시도해 주세요."
    : "복구하지 못했어요. 잠시 후 다시 시도해 주세요.";
}

export function RecoveryKeyDialog({ mode, onClose }: { mode: Mode; onClose: () => void }) {
  const entries = useAppStore((state) => state.entries);
  const setRecoveryKeyIssuedAt = useAppStore((state) => state.setRecoveryKeyIssuedAt);
  const [issuedCode, setIssuedCode] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [redeemInput, setRedeemInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function issueKey() {
    if (busy) return;
    setBusy(true);
    setMessage("");
    try {
      const { code } = await generateRecoveryKeyRemote();
      setIssuedCode(code);
      setRecoveryKeyIssuedAt(new Date().toISOString());
    } catch (error) {
      setMessage(errorMessage("issue", error));
    } finally {
      setBusy(false);
    }
  }

  async function copyCode() {
    if (!issuedCode) return;
    try {
      await navigator.clipboard.writeText(issuedCode);
      setCopied(true);
    } catch {
      setMessage("복사하지 못했어요. 직접 적어 두세요.");
    }
  }

  async function redeemKey() {
    if (busy || !redeemInput.trim()) return;
    setBusy(true);
    setMessage("");
    try {
      const localEntries = entries;
      const { token, uid } = await redeemRecoveryKeyRemote(redeemInput.trim());
      await signInWithRecoveryToken(token);
      await migrateLocalEntriesRemote(uid, localEntries);
      onClose();
    } catch (error) {
      setMessage(errorMessage("redeem", error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="sheet-backdrop sheet-backdrop--center" role="presentation" onClick={onClose}>
      <section
        className="confirm-dialog recovery-dialog"
        role="dialog"
        aria-modal="true"
        onClick={(event) => event.stopPropagation()}
      >
        {mode === "issue" && issuedCode && (
          <>
            <h2>복구 키를 저장해 두세요</h2>
            <p>이 화면을 벗어나면 다시 볼 수 없어요. 안전한 곳에 적어 두세요.</p>
            <code className="recovery-dialog__code">{issuedCode}</code>
            {message && <p className="settings-message" role="alert">{message}</p>}
            <div>
              <button type="button" className="secondary-button" onClick={() => void copyCode()}>
                {copied ? "복사했어요" : "복사하기"}
              </button>
              <button type="button" className="primary-button" onClick={onClose}>
                확인했어요
              </button>
            </div>
          </>
        )}
        {mode === "issue" && !issuedCode && (
          <>
            <h2>복구 키 만들기</h2>
            <p>다른 기기나 브라우저에서 지금 기록을 이어보려면 복구 키가 필요해요.</p>
            {message && <p className="settings-message" role="alert">{message}</p>}
            <div>
              <button type="button" className="secondary-button" disabled={busy} onClick={onClose}>
                취소
              </button>
              <button type="button" className="primary-button" disabled={busy} onClick={() => void issueKey()}>
                {busy ? "만드는 중…" : "복구 키 만들기"}
              </button>
            </div>
          </>
        )}
        {mode === "redeem" && (
          <>
            <h2>다른 기기의 기록 불러오기</h2>
            <p>발급받은 복구 키를 입력하면 이 기기의 기록은 그대로 유지한 채 이어서 볼 수 있어요.</p>
            <input
              className="recovery-dialog__input"
              value={redeemInput}
              onChange={(event) => setRedeemInput(event.target.value.toUpperCase())}
              placeholder="XXXX-XXXX-XXXX-XXXX"
              maxLength={19}
              autoCapitalize="characters"
              aria-label="복구 키"
            />
            {message && <p className="settings-message" role="alert">{message}</p>}
            <div>
              <button type="button" className="secondary-button" disabled={busy} onClick={onClose}>
                취소
              </button>
              <button
                type="button"
                className="primary-button"
                disabled={busy || !redeemInput.trim()}
                onClick={() => void redeemKey()}
              >
                {busy ? "불러오는 중…" : "불러오기"}
              </button>
            </div>
          </>
        )}
      </section>
    </div>
  );
}
