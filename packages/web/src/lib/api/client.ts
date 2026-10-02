import { translate } from "@/i18n/context";
import { API_PREFIX } from "@/config/constants";
import { env } from "@/config/env";
import { tokenStore } from "@/lib/auth/token-store";
import { ApiError, type ApiErrorBody } from "@/lib/api/errors";
import type { AuthSession } from "@/lib/api/types";

const DEFAULT_TIMEOUT_MS = 20_000;

export interface RequestOptions extends Omit<RequestInit, "body"> {
  body?: unknown;
  skipAuth?: boolean;
  timeoutMs?: number;
  parse?: "json" | "blob" | "void";
}

let refreshInFlight: Promise<boolean> | null = null;
let onUnauthorized: (() => void) | null = null;

export function setUnauthorizedHandler(handler: (() => void) | null) {
  onUnauthorized = handler;
}

function apiUrl(path: string): string {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return `${env.apiBaseUrl}${normalized}`;
}

async function parseError(response: Response): Promise<ApiError> {
  let body: ApiErrorBody = { message: response.statusText || "Request failed" };
  try {
    const json = (await response.json()) as { error?: ApiErrorBody };
    if (json?.error) body = json.error;
  } catch {
    // Non-JSON error bodies are treated as a generic status message.
  }
  return new ApiError(response.status, body);
}

async function refreshSession(): Promise<boolean> {
  const refreshToken = tokenStore.getRefreshToken();
  if (!refreshToken) return false;

  try {
    const response = await fetch(apiUrl(`${API_PREFIX}/auth/refresh`), {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ refreshToken }),
    });
    if (!response.ok) {
      // Another tab may have rotated the shared refresh token a moment ago.
      // The one we sent is then spent, but the stored one is fresh.
      const current = tokenStore.getRefreshToken();
      return Boolean(current && current !== refreshToken);
    }
    const session = (await response.json()) as AuthSession;
    tokenStore.setSession(session);
    return true;
  } catch {
    return false;
  }
}

function enqueueRefresh(): Promise<boolean> {
  if (!refreshInFlight) {
    refreshInFlight = refreshSession().finally(() => {
      refreshInFlight = null;
    });
  }
  return refreshInFlight;
}

function encodeBody(body: unknown, headers: Headers): BodyInit | undefined {
  if (body === undefined || body === null) return undefined;
  if (body instanceof FormData || body instanceof Blob || body instanceof URLSearchParams) {
    return body;
  }
  if (typeof body === "string") return body;
  headers.set("Content-Type", "application/json");
  return JSON.stringify(body);
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { skipAuth, timeoutMs = DEFAULT_TIMEOUT_MS, parse = "json", body, headers: initHeaders, signal, ...rest } =
    options;

  const execute = async (allowRefresh: boolean): Promise<T> => {
    const headers = new Headers(initHeaders);
    headers.set("Accept", headers.get("Accept") ?? "application/json");

    const token = skipAuth ? null : tokenStore.getAccessToken();
    if (token) headers.set("Authorization", `Bearer ${token}`);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    const onAbort = () => controller.abort();
    signal?.addEventListener("abort", onAbort);

    try {
      const response = await fetch(apiUrl(path), {
        ...rest,
        headers,
        body: encodeBody(body, headers),
        signal: controller.signal,
      });

      if (response.status === 401 && allowRefresh && !skipAuth) {
        const refreshed = await enqueueRefresh();
        if (refreshed) return execute(false);
        tokenStore.clear();
        onUnauthorized?.();
        throw await parseError(response);
      }

      if (response.status === 204 || parse === "void") {
        if (!response.ok) throw await parseError(response);
        return undefined as T;
      }

      if (!response.ok) throw await parseError(response);

      if (parse === "blob") return (await response.blob()) as T;
      if (response.headers.get("content-length") === "0") return undefined as T;
      return (await response.json()) as T;
    } catch (error) {
      if (error instanceof ApiError) throw error;
      if (error instanceof DOMException && error.name === "AbortError") {
        throw new ApiError(0, { message: signal?.aborted ? translate("common", "requestCancelled") : translate("common", "requestTimeout") });
      }
      if (error instanceof TypeError) {
        throw new ApiError(0, { message: translate("common", "networkError") });
      }
      throw error;
    } finally {
      clearTimeout(timeout);
      signal?.removeEventListener("abort", onAbort);
    }
  };

  return execute(true);
}

export function v1(path: string): string {
  return `${API_PREFIX}${path.startsWith("/") ? path : `/${path}`}`;
}
