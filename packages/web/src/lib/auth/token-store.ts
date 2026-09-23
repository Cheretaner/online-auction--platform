import type { AuthSession } from "@/lib/api/types";
import { STORAGE_KEYS } from "@/config/constants";

function readJson<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export const tokenStore = {
  getAccessToken(): string | null {
    return localStorage.getItem(STORAGE_KEYS.accessToken);
  },
  getRefreshToken(): string | null {
    return localStorage.getItem(STORAGE_KEYS.refreshToken);
  },
  getSession(): AuthSession | null {
    return readJson<AuthSession>(STORAGE_KEYS.session);
  },
  setSession(session: AuthSession): void {
    localStorage.setItem(STORAGE_KEYS.accessToken, session.token);
    localStorage.setItem(STORAGE_KEYS.refreshToken, session.refreshToken);
    localStorage.setItem(STORAGE_KEYS.session, JSON.stringify(session));
  },
  setTokens(accessToken: string, refreshToken: string): void {
    localStorage.setItem(STORAGE_KEYS.accessToken, accessToken);
    localStorage.setItem(STORAGE_KEYS.refreshToken, refreshToken);
    const session = this.getSession();
    if (session) {
      this.setSession({ ...session, token: accessToken, refreshToken });
    }
  },
  clear(): void {
    localStorage.removeItem(STORAGE_KEYS.accessToken);
    localStorage.removeItem(STORAGE_KEYS.refreshToken);
    localStorage.removeItem(STORAGE_KEYS.session);
  },
};
