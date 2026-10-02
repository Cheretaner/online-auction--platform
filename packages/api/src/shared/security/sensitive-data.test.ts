import { describe, expect, it } from "vitest";
import { decryptSensitive, encryptSensitive, hashSensitive } from "./sensitive-data.js";

describe("sensitive identity data", () => {
  it("encrypts values and preserves legacy plaintext reads during migration", () => {
    const encrypted = encryptSensitive("123456789012");
    expect(encrypted).toMatch(/^enc:v1:/);
    expect(decryptSensitive(encrypted)).toBe("123456789012");
    expect(decryptSensitive("legacy-id")).toBe("legacy-id");
    expect(encryptSensitive(null)).toBeNull();
  });

  it("creates normalized keyed duplicate lookup digests", () => {
    expect(hashSensitive(" ab-123 ")).toBe(hashSensitive("AB123"));
    expect(hashSensitive("")).toBeNull();
  });
});