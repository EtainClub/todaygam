"use client";

import { useAppStore } from "@/lib/store";
import { ChevronRightIcon, CloseIcon } from "./Icons";

export function YesterdayBanner({ date, count }: { date: string; count: number }) {
  const openReview = useAppStore((state) => state.openReview);
  const dismissYesterday = useAppStore((state) => state.dismissYesterday);
  return (
    <aside className="yesterday-banner">
      <div>
        <span className="yesterday-banner__dot" />
        <p><strong>어제 확인하지 않은 감 {count}개</strong><span>한 번만 알려드릴게요</span></p>
      </div>
      <div>
        <button type="button" className="banner-action" onClick={() => openReview(date)}>
          지금 정리 <ChevronRightIcon size={15} />
        </button>
        <button type="button" className="banner-close" aria-label="어제 정리 알림 닫기" onClick={() => dismissYesterday(date)}>
          <CloseIcon size={17} />
        </button>
      </div>
    </aside>
  );
}
