"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BrandMark } from "./BrandMark";
import { StatsIcon, TodayIcon } from "./Icons";

const items = [
  { href: "/", label: "오늘", icon: TodayIcon },
  { href: "/stats/", label: "나의 감", icon: StatsIcon },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  if (pathname.startsWith("/onboarding")) return <>{children}</>;

  return (
    <div className="app-shell">
      <aside className="desktop-rail" aria-label="주요 탐색">
        <Link href="/" className="desktop-rail__brand"><BrandMark /></Link>
        <nav className="desktop-rail__nav">
          {items.map(({ href, label, icon: ItemIcon }) => {
            const active = href === "/" ? pathname === "/" : pathname.startsWith(href.slice(0, -1));
            return (
              <Link key={href} href={href} className={`rail-link ${active ? "is-active" : ""}`}>
                <ItemIcon size={21} />
                <span>{label}</span>
              </Link>
            );
          })}
        </nav>
        <p className="desktop-rail__note">결과가 나오기 전에 기록하고,<br />우연과 구분되는지 확인하세요.</p>
      </aside>
      <div className="app-shell__content">{children}</div>
      <nav className="tab-bar" aria-label="주요 탐색">
        {items.map(({ href, label, icon: ItemIcon }) => {
          const active = href === "/" ? pathname === "/" : pathname.startsWith(href.slice(0, -1));
          return (
            <Link key={href} href={href} className={`tab-bar__item ${active ? "is-active" : ""}`}>
              <ItemIcon size={22} />
              <span>{label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
