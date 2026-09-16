import { describe, expect, it } from "vitest";
import { signAccessToken, signRefreshToken, verifyAccessToken, verifyRefreshToken } from "./jwt.js";

describe("jwt", () => {
  it("signs and verifies access tokens", () => {
    const token = signAccessToken({ sub: "user-1", roles: ["bidder"], organizationId: "org-1" });
    const payload = verifyAccessToken(token);
    expect(payload.sub).toBe("user-1");
    expect(payload.roles).toEqual(["bidder"]);
    expect(payload.organizationId).toBe("org-1");
  });

  it("signs and verifies refresh tokens", () => {
    const token = signRefreshToken("user-1");
    const payload = verifyRefreshToken(token);
    expect(payload.sub).toBe("user-1");
    expect(payload.jti).toBeTruthy();
    expect(payload.typ).toBe("refresh");
  });
});
