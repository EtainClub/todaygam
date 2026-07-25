import styles from "./BrandMark.module.css";

export function BrandMark({ compact = false }: { compact?: boolean }) {
  return (
    <span className={`${styles.root} ${compact ? styles.compact : ""}`} aria-label="오늘감">
      <span className={styles.symbol} aria-hidden="true">
        <span />
        <span />
      </span>
      {!compact && <span className={styles.word}>오늘감</span>}
    </span>
  );
}
