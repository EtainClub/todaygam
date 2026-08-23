import type { Metadata, Viewport } from "next";
import "pretendard/dist/web/variable/pretendardvariable.css";
import { AppShell } from "@/components/AppShell";
import { ClientProviders } from "@/components/ClientProviders";
import { IS_TOSS_APP } from "@/lib/platform";
import "./globals.css";

const siteName = "오늘감";
const siteTitle = "오늘감 | 오늘 벌어질 일을 먼저 감으로 기록하세요";
const siteDescription =
  "오늘 벌어질 일을 결과가 나오기 전에 감으로 기록하고, 나중에 실제 결과와 비교해 내 직감을 확인하세요.";
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://today-gam.web.app";
const shareImage = {
  url: "/og/oneulgam-share.png",
  width: 1200,
  height: 630,
  alt: "오늘 벌어질 일을 결과 전에 감으로 기록하는 오늘감",
};

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: siteTitle,
    template: `%s | ${siteName}`,
  },
  description: siteDescription,
  applicationName: siteName,
  keywords: ["오늘감", "직감 기록", "예측 기록", "오늘 질문", "감 기록"],
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [
      { url: "/icons/favicon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }],
  },
  openGraph: {
    type: "website",
    locale: "ko_KR",
    url: "/",
    siteName,
    title: siteTitle,
    description: siteDescription,
    images: [shareImage],
  },
  twitter: {
    card: "summary_large_image",
    title: siteTitle,
    description: siteDescription,
    images: [shareImage.url],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: siteName,
  },
  formatDetection: { telephone: false },
  robots: { index: true, follow: true },
  category: "lifestyle",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f4f1ea" },
    { media: "(prefers-color-scheme: dark)", color: "#141713" },
  ],
  colorScheme: "light dark",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko" data-toss={IS_TOSS_APP ? "1" : undefined}>
      <body>
        <ClientProviders>
          <AppShell>{children}</AppShell>
        </ClientProviders>
      </body>
    </html>
  );
}
