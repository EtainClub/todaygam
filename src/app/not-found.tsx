import Link from "next/link";
import { BrandMark } from "@/components/BrandMark";

export default function NotFound() {
  return (
    <main className="not-found">
      <BrandMark />
      <p className="section-kicker">404</p>
      <h1>이 기록은 찾을 수 없어요.</h1>
      <p>오늘의 감으로 돌아가 새 기록을 시작해 보세요.</p>
      <Link href="/" className="primary-button">오늘로 돌아가기</Link>
    </main>
  );
}
