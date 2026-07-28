import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { accountProfileFromUser } from "../../src/lib/account-profile.ts";

describe("Google account profile", () => {
  it("uses the Google provider photo when the top-level photo is missing", () => {
    const profile = accountProfileFromUser({
      displayName: null,
      email: "user@example.com",
      photoURL: null,
      providerData: [
        {
          providerId: "google.com",
          displayName: "오늘감 사용자",
          email: "user@gmail.com",
          photoURL: "https://lh3.googleusercontent.com/example",
        },
      ],
    });

    assert.deepEqual(profile, {
      displayName: "오늘감 사용자",
      email: "user@example.com",
      photoURL: "https://lh3.googleusercontent.com/example",
    });
  });

  it("falls back to the top-level profile when provider data is incomplete", () => {
    const profile = accountProfileFromUser({
      displayName: "사용자",
      email: "user@example.com",
      photoURL: "https://example.com/avatar.png",
      providerData: [],
    });

    assert.deepEqual(profile, {
      displayName: "사용자",
      email: "user@example.com",
      photoURL: "https://example.com/avatar.png",
    });
  });
});
