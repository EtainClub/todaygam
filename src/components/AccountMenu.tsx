"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { logoutGoogleAccount } from "@/lib/firebase/auth";
import { useAppStore } from "@/lib/store";
import { LogoutIcon } from "./Icons";

export function AccountMenu() {
  const router = useRouter();
  const menuId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const logoutRef = useRef<HTMLButtonElement>(null);
  const profile = useAppStore((state) => state.accountProfile);
  const resetAfterLogout = useAppStore((state) => state.resetAfterLogout);
  const [open, setOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    logoutRef.current?.focus();

    function closeOnOutsidePress(event: PointerEvent) {
      if (event.target instanceof Node && !rootRef.current?.contains(event.target)) {
        setOpen(false);
      }
    }

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      setOpen(false);
      triggerRef.current?.focus();
    }

    document.addEventListener("pointerdown", closeOnOutsidePress);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsidePress);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  const accountName = profile?.displayName || profile?.email || "Google 계정";
  const initial = accountName.trim().charAt(0).toUpperCase() || "G";

  async function logout() {
    if (loggingOut) return;
    setLoggingOut(true);
    setError("");
    try {
      await logoutGoogleAccount();
      resetAfterLogout();
      setOpen(false);
      router.replace("/onboarding/");
    } catch {
      setError("로그아웃하지 못했습니다. 잠시 후 다시 시도해 주세요.");
      setLoggingOut(false);
    }
  }

  return (
    <div className="account-menu" ref={rootRef}>
      <button
        ref={triggerRef}
        type="button"
        className="account-menu__trigger"
        aria-label={`${accountName} 계정 메뉴`}
        aria-expanded={open}
        aria-controls={menuId}
        aria-haspopup="dialog"
        onClick={() => {
          setError("");
          setOpen((current) => !current);
        }}
      >
        <span className="account-menu__avatar" aria-hidden="true">
          <span>{initial}</span>
          {profile?.photoURL ? (
            // Google profile image URLs are supplied by Firebase Authentication.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={profile.photoURL}
              alt=""
              width="36"
              height="36"
              referrerPolicy="no-referrer"
              onError={(event) => event.currentTarget.remove()}
            />
          ) : null}
        </span>
      </button>

      {open ? (
        <div id={menuId} className="account-menu__dropdown" role="dialog" aria-label="계정 메뉴">
          <div className="account-menu__profile">
            <strong>{profile?.displayName || "Google 계정"}</strong>
            {profile?.email ? <span>{profile.email}</span> : null}
          </div>
          <button
            ref={logoutRef}
            type="button"
            className="account-menu__logout"
            disabled={loggingOut}
            onClick={logout}
          >
            <LogoutIcon size={18} />
            <span>{loggingOut ? "로그아웃 중…" : "로그아웃"}</span>
          </button>
          {error ? <p className="account-menu__error" role="alert">{error}</p> : null}
        </div>
      ) : null}
    </div>
  );
}
