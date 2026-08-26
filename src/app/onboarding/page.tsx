"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { BrandMark } from "@/components/BrandMark";
import { OnboardingFlow } from "@/components/OnboardingFlow";
import { useAppStore } from "@/lib/store";

/**
 * Standalone onboarding route, kept for the browser/PWA build where
 * /onboarding/ is a real, linkable URL. Nothing navigates here any more —
 * the root page renders <OnboardingFlow /> in place instead (see that
 * component's note on the deployed-only reload loop).
 *
 * Every transition out of this route is an SPA transition, never
 * window.location: Next's client router fetches "<route>/index.txt", a file
 * that exists in the static export, whereas a document request for a
 * directory URL depends on the host resolving it to index.html.
 */
export default function OnboardingPage() {
  const router = useRouter();
  const hydrated = useAppStore((state) => state.hydrated);
  const onboarded = useAppStore((state) => state.onboarded);

  useEffect(() => {
    if (hydrated && onboarded) router.replace("/");
  }, [hydrated, onboarded, router]);

  if (!hydrated || onboarded) {
    return (
      <main className="loading-screen">
        <BrandMark />
        <span className="loading-pulse" />
      </main>
    );
  }

  return <OnboardingFlow onComplete={() => router.replace("/")} />;
}
