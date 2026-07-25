export function LiftBar({ value, muted = false }: { value: number; muted?: boolean }) {
  const width = Math.min(100, Math.max(2, Math.round(value * 100)));
  return (
    <span className={`lift-bar ${muted ? "is-muted" : ""}`} aria-hidden="true">
      <span style={{ width: `${width}%` }} />
    </span>
  );
}
