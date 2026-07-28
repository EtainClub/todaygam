import type { AccountProfile } from "./types";

interface AccountProfileUser {
  displayName: string | null;
  email: string | null;
  photoURL: string | null;
  providerData: ReadonlyArray<{
    providerId: string;
    displayName: string | null;
    email: string | null;
    photoURL: string | null;
  }>;
}

export function accountProfileFromUser(user: AccountProfileUser): AccountProfile {
  const googleProfile = user.providerData.find(
    (provider) => provider.providerId === "google.com",
  );
  return {
    displayName: user.displayName ?? googleProfile?.displayName ?? null,
    email: user.email ?? googleProfile?.email ?? null,
    photoURL: googleProfile?.photoURL ?? user.photoURL ?? null,
  };
}
