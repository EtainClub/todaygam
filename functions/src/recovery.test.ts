import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { generateRecoveryCode, hashRecoveryCode } from "./recovery.js";

describe("recovery key codes", () => {
  it("generates a grouped, unambiguous-alphabet code", () => {
    const code = generateRecoveryCode();
    assert.match(code, /^[A-HJKMNP-Z2-9]{4}-[A-HJKMNP-Z2-9]{4}-[A-HJKMNP-Z2-9]{4}-[A-HJKMNP-Z2-9]{4}$/);
  });

  it("generates codes that are practically unique", () => {
    const codes = new Set(Array.from({ length: 200 }, () => generateRecoveryCode()));
    assert.equal(codes.size, 200);
  });

  it("hashes case- and dash-insensitively to the same value", () => {
    assert.equal(hashRecoveryCode("abcd-efgh-jkmn-pqrs"), hashRecoveryCode("ABCDEFGHJKMNPQRS"));
  });

  it("hashes different codes to different values", () => {
    assert.notEqual(hashRecoveryCode(generateRecoveryCode()), hashRecoveryCode(generateRecoveryCode()));
  });
});
