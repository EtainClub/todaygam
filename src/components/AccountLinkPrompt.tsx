"use client";

import { FirebaseError } from "firebase/app";
import { useState } from "react";
import { connectGoogleAccount } from "@/lib/firebase/auth";
import {
  markLinkPromptShownRemote,
  migrateLocalEntriesRemote,
} from "@/lib/firebase/sync";
import type { Entry } from "@/lib/types";

function getErrorMessage(error: unknown) {
  if (
    error instanceof FirebaseError &&
    ["auth/popup-closed-by-user", "auth/cancelled-popup-request"].includes(error.code)
  ) {
    return "Google 로그인 창이 닫혔어요. 준비되면 다시 연결해 주세요.";
  }
  return "계정을 연결하지 못했어요. 잠시 후 다시 시도해 주세요.";
}

export function AccountLinkPrompt({
  uid,
  entries,
  onSnooze,
}: {
  uid: string;
  entries: Entry[];
  onSnooze: () => void;
}) {
  const [linking, setLinking] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function linkAccount() {
    setLinking(true);
    setErrorMessage(null);
    try {
      const result = await connectGoogleAccount();
      await migrateLocalEntriesRemote(result.user.uid, entries);
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
      setLinking(false);
    }
  }

  function snooze() {
    onSnooze();
    void markLinkPromptShownRemote(uid).catch((error) => {
      console.error("계정 연결 안내 상태를 저장하지 못했습니다.", error);
    });
  }

  return (
    <aside className="link-account-card">
      <div>
        <strong>쌓인 기록을 Google 계정으로 보호하세요.</strong>
        <span>현재 기록은 그대로 유지되고, 다른 기기에서도 이어볼 수 있어요.</span>
        {errorMessage && <small role="alert">{errorMessage}</small>}
      </div>
      <button
        type="button"
        className="link-account-card__connect"
        disabled={linking}
        onClick={linkAccount}
      >
        {linking ? "연결 중…" : "Google 계정 연결"}
      </button>
      <button
        type="button"
        className="link-account-card__later"
        disabled={linking}
        onClick={snooze}
      >
        14일 뒤에 다시 알려주세요
      </button>
    </aside>
  );
}
