import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  googleClientId: "client-id.apps.googleusercontent.com" as string | undefined,
  verifyIdToken: vi.fn(),
}));

vi.mock("google-auth-library", () => ({
  OAuth2Client: class {
    verifyIdToken = mocks.verifyIdToken;
  },
}));

vi.mock("../config/env.js", () => ({
  env: {
    get GOOGLE_CLIENT_ID() {
      return mocks.googleClientId;
    },
  },
}));

import { verifyGoogleCredential } from "./google-token.js";

describe("verifyGoogleCredential", () => {
  beforeEach(() => {
    mocks.googleClientId = "client-id.apps.googleusercontent.com";
    mocks.verifyIdToken.mockReset();
  });

  it("reports missing server configuration as unavailable", async () => {
    mocks.googleClientId = undefined;

    await expect(verifyGoogleCredential("credential")).rejects.toMatchObject({
      statusCode: 503,
      message: "Google sign-in is not configured",
    });
    expect(mocks.verifyIdToken).not.toHaveBeenCalled();
  });

  it("reports certificate-service outages as temporarily unavailable", async () => {
    mocks.verifyIdToken.mockRejectedValue(
      new Error("Failed to retrieve verification certificates: request timed out"),
    );

    await expect(verifyGoogleCredential("credential")).rejects.toMatchObject({
      statusCode: 503,
      message: "Google sign-in is temporarily unavailable",
    });
  });

  it("reports Google verification network errors as temporarily unavailable", async () => {
    mocks.verifyIdToken.mockRejectedValue(Object.assign(new Error("connect failed"), { code: "ECONNRESET" }));

    await expect(verifyGoogleCredential("credential")).rejects.toMatchObject({
      statusCode: 503,
      message: "Google sign-in is temporarily unavailable",
    });
  });

  it("keeps invalid credentials as unauthorized", async () => {
    mocks.verifyIdToken.mockRejectedValue(new Error("Invalid token signature"));

    await expect(verifyGoogleCredential("credential")).rejects.toMatchObject({
      statusCode: 401,
      message: "Invalid Google credential",
    });
  });

  it("returns verified Google identity claims", async () => {
    mocks.verifyIdToken.mockResolvedValue({
      getPayload: () => ({
        sub: "google-user",
        email: "user@example.com",
        email_verified: true,
        name: "Example User",
      }),
    });

    await expect(verifyGoogleCredential("credential")).resolves.toEqual({
      subject: "google-user",
      email: "user@example.com",
      name: "Example User",
    });
    expect(mocks.verifyIdToken).toHaveBeenCalledWith({
      idToken: "credential",
      audience: "client-id.apps.googleusercontent.com",
    });
  });
});
