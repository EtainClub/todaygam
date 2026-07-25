import { Suspense } from "react";
import { StatsContent } from "./stats-content";

export default function StatsPage() {
  return (
    <Suspense fallback={<main className="page"><div className="stats-skeleton" /></main>}>
      <StatsContent />
    </Suspense>
  );
}
