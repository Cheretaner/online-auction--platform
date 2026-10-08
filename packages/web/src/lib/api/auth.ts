import type {
  LoginRequest,
  RegisterRequest,
  UpdateProfileRequest,
} from "@auction/shared";
import { apiRequest, v1 } from "@/lib/api/client";
import type { AuthSession, PublicProfile } from "@/lib/api/types";

export const authApi = {
  register: (body: RegisterRequest) =>
    apiRequest<AuthSession>(v1("/auth/register"), { method: "POST", body, skipAuth: true }),
  login: (body: LoginRequest) =>
    apiRequest<AuthSession>(v1("/auth/login"), { method: "POST", body, skipAuth: true }),
  googleLogin: (credential: string) =>
    apiRequest<AuthSession>(v1("/auth/google"), {
      method: "POST",
      body: { credential },
      skipAuth: true,
    }),
  refresh: (refreshToken: string) =>
    apiRequest<AuthSession>(v1("/auth/refresh"), {
      method: "POST",
      body: { refreshToken },
      skipAuth: true,
    }),
  me: () => apiRequest<PublicProfile>(v1("/auth/me")),
  updateMe: (body: UpdateProfileRequest) =>
    apiRequest<PublicProfile>(v1("/auth/me"), { method: "PATCH", body }),
  switchContext: (organizationId: string) =>
    apiRequest<AuthSession>(v1("/auth/context"), { method: "POST", body: { organizationId } }),
  getUser: (id: string) => apiRequest<PublicProfile>(v1(`/auth/users/${id}`)),
  logout: (refreshToken: string) =>
    apiRequest<void>(v1("/auth/logout"), {
      method: "POST",
      body: { refreshToken },
      skipAuth: true,
      parse: "void",
    }),
  requestPasswordReset: (email: string) =>
    apiRequest<{ message: string }>(v1("/auth/password-reset/request"), {
      method: "POST",
      body: { email },
      skipAuth: true,
    }),
  confirmPasswordReset: (token: string, password: string) =>
    apiRequest<void>(v1("/auth/password-reset/confirm"), {
      method: "POST",
      body: { token, password },
      skipAuth: true,
      parse: "void",
    }),
};
