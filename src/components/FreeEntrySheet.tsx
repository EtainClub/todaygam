"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useState } from "react";
import { useAppStore } from "@/lib/store";
import type { Strength } from "@/lib/types";
import { CloseIcon } from "./Icons";

export function FreeEntrySheet({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const reduceMotion = useReducedMotion();
  const addFreeEntry = useAppStore((state) => state.addFreeEntry);
  const [text, setText] = useState("");
  const [strength, setStrength] = useState<Strength>("medium");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, open]);

  async function submit() {
    if (!text.trim() || saving) return;
    setSaving(true);
    await addFreeEntry(text, strength);
    setText("");
    setStrength("medium");
    setSaving(false);
    onClose();
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="sheet-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) onClose();
          }}
        >
          <motion.section
            role="dialog"
            aria-modal="true"
            aria-labelledby="free-entry-title"
            className="bottom-sheet"
            initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: "100%", scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: "100%", scale: 0.98 }}
            transition={{ type: "spring", bounce: 0.08, duration: 0.38 }}
          >
            <div className="sheet-handle" aria-hidden="true" />
            <header className="sheet-header">
              <div>
                <span className="section-kicker">자유 감</span>
                <h2 id="free-entry-title">오늘 떠오른 감 적기</h2>
              </div>
              <button type="button" className="icon-button" onClick={onClose} aria-label="닫기"><CloseIcon /></button>
            </header>
            <label className="field-label" htmlFor="free-entry">한 문장으로 남겨보세요</label>
            <div className="text-field-wrap">
              <textarea
                id="free-entry"
                autoFocus
                maxLength={60}
                rows={3}
                value={text}
                onChange={(event) => setText(event.target.value)}
                placeholder="예: 오늘 우연히 오래된 친구를 마주칠 것 같다"
              />
              <span>{text.length}/60</span>
            </div>
            <fieldset className="segmented-field">
              <legend>얼마나 느껴지나요?</legend>
              <div>
                {(["faint", "medium", "strong"] as Strength[]).map((value) => (
                  <button
                    key={value}
                    type="button"
                    className={strength === value ? "is-selected" : ""}
                    onClick={() => setStrength(value)}
                  >
                    {value === "faint" ? "스침" : value === "medium" ? "어느 정도" : "강하게"}
                  </button>
                ))}
              </div>
            </fieldset>
            <button type="button" className="primary-button" disabled={!text.trim() || saving} onClick={() => void submit()}>
              이 감 잠그기
            </button>
            <p className="lock-disclaimer">저장하면 문장과 세기를 수정할 수 없어요.</p>
          </motion.section>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
