export function mergeQuestionLabels(
  localLabels: Record<string, string>,
  remoteLabels: Record<string, string>,
  pendingLabels: Record<string, string>,
): Record<string, string> {
  return {
    ...localLabels,
    ...remoteLabels,
    ...pendingLabels,
  };
}

export function clearSyncedQuestionLabels(
  pendingLabels: Record<string, string>,
  syncedLabels: Record<string, string>,
): Record<string, string> {
  let remainingLabels = pendingLabels;

  Object.entries(pendingLabels).forEach(([key, label]) => {
    if (syncedLabels[key] !== label) return;
    if (remainingLabels === pendingLabels) remainingLabels = { ...pendingLabels };
    delete remainingLabels[key];
  });

  return remainingLabels;
}

export function migratePendingQuestionLabels(
  version: number,
  questionLabels: Record<string, string>,
  pendingLabels?: Record<string, string>,
): Record<string, string> {
  return version >= 4 ? pendingLabels ?? {} : questionLabels;
}
