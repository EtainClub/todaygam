import { STRENGTH_LABEL } from "@/lib/catalog";
import type { Strength } from "@/lib/types";

export function StrengthPicker({
  onSelect,
  disabled = false,
}: {
  onSelect: (strength: Strength) => void;
  disabled?: boolean;
}) {
  return (
    <div className="strength-picker">
      <p>얼마나 느껴지나요?</p>
      <div className="strength-picker__options">
        {(Object.keys(STRENGTH_LABEL) as Strength[]).map((strength) => (
          <button
            key={strength}
            type="button"
            className="chip-button"
            disabled={disabled}
            onClick={() => onSelect(strength)}
          >
            {STRENGTH_LABEL[strength]}
          </button>
        ))}
      </div>
      <span className="strength-picker__hint">선택하지 않으면 ‘어느 정도’로 저장돼요</span>
    </div>
  );
}
