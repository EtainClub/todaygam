import Image from "next/image";
import styles from "./BrandMark.module.css";

export function BrandMark({ compact = false }: { compact?: boolean }) {
  return (
    <span className={`${styles.root} ${compact ? styles.compact : ""}`} aria-label="오늘감">
      <Image
        className={styles.symbol}
        src="/brand/oneulgam-mark.png"
        alt=""
        width={30}
        height={30}
        aria-hidden="true"
      />
      {!compact && <span className={styles.word}>오늘감</span>}
    </span>
  );
}
