import { describe, expect, it } from "vitest";
import { err, fromPromise, isErr, isOk, map, ok, unwrap, unwrapOr } from "./Result.js";

describe("Result", () => {
  it("maps successful values", () => {
    const result = map(ok(2), (value) => value * 2);
    expect(isOk(result)).toBe(true);
    expect(unwrap(result)).toBe(4);
  });

  it("preserves errors", () => {
    const result = map(err(new Error("nope")), (value: number) => value * 2);
    expect(isErr(result)).toBe(true);
    expect(unwrapOr(result, 0)).toBe(0);
  });

  it("captures rejected promises", async () => {
    const result = await fromPromise(Promise.reject(new Error("boom")));
    expect(result.ok).toBe(false);
  });
});
