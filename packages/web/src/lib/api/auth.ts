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
};
