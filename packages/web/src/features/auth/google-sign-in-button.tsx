import { useEffect, useRef, useState } from "react";
import { env } from "@/config/env";
import { useT } from "@/i18n/context";
import { cn } from "@/lib/utils";

interface GoogleCredentialResponse {
  credential?: string;
}

interface GoogleIdentityServices {
  accounts: {
    id: {
      initialize: (options: {
        client_id: string;
        callback: (response: GoogleCredentialResponse) => void;
      }) => void;
      renderButton: (
        element: HTMLElement,
        options: { theme: "outline"; size: "large"; text: "continue_with"; width: number },
      ) => void;
    };
  };
}

declare global {
  interface Window {
    google?: GoogleIdentityServices;
  }
}

const GOOGLE_SCRIPT_URL = "https://accounts.google.com/gsi/client";
let googleScriptPromise: Promise<void> | undefined;

function loadGoogleIdentityServices(): Promise<void> {
  if (window.google?.accounts.id) return Promise.resolve();
  if (googleScriptPromise) return googleScriptPromise;

  const load = new Promise<void>((resolve, reject) => {
    let script = document.querySelector<HTMLScriptElement>(`script[src="${GOOGLE_SCRIPT_URL}"]`);
    if (!script) {
      script = document.createElement("script");
      script.src = GOOGLE_SCRIPT_URL;
      script.async = true;
      script.defer = true;
      script.dataset.googleIdentity = "true";
    }

    if (script.dataset.loaded === "true") {
      if (window.google?.accounts.id) resolve();
      else reject(new Error("Google Identity Services initialized without its API"));
      return;
    }

    const cleanup = () => {
      window.clearTimeout(timeout);
      script!.removeEventListener("load", handleLoad);
      script!.removeEventListener("error", handleError);
    };
    const handleLoad = () => {
      cleanup();
      delete script!.dataset.loading;
      if (window.google?.accounts.id) {
        script!.dataset.loaded = "true";
        resolve();
      } else {
        delete script!.dataset.loaded;
        if (script!.dataset.googleIdentity === "true") script!.remove();
        reject(new Error("Google Identity Services initialized without its API"));
      }
    };
    const handleError = () => {
      cleanup();
      delete script!.dataset.loading;
      delete script!.dataset.loaded;
      script!.remove();
      reject(new Error("Google Identity Services failed to load"));
    };

    const timeout = window.setTimeout(handleError, 15_000);
    script.dataset.loading = "true";
    script.addEventListener("load", handleLoad, { once: true });
    script.addEventListener("error", handleError, { once: true });
    if (!script.isConnected) document.head.append(script);
  });

  googleScriptPromise = load.catch((error: unknown) => {
    googleScriptPromise = undefined;
    throw error;
  });
  return googleScriptPromise;
}

export function GoogleSignInButton({
  onCredential,
  disabled = false,
}: {
  onCredential: (credential: string) => void;
  disabled?: boolean;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const onCredentialRef = useRef(onCredential);
  const disabledRef = useRef(disabled);
  const [loadFailed, setLoadFailed] = useState(false);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const t = useT("auth");

  useEffect(() => {
    onCredentialRef.current = onCredential;
    disabledRef.current = disabled;
  }, [disabled, onCredential]);

  useEffect(() => {
    const clientId = env.googleClientId;
    const container = containerRef.current;
    if (!clientId || !container) return;
    let active = true;

    void loadGoogleIdentityServices()
      .then(() => {
        if (!active || !window.google) return;
        window.google.accounts.id.initialize({
          client_id: clientId,
          callback: (response) => {
            if (disabledRef.current) return;
            if (response.credential) onCredentialRef.current(response.credential);
            else setLoadFailed(true);
          },
        });
        window.google.accounts.id.renderButton(container, {
          theme: "outline",
          size: "large",
          text: "continue_with",
          width: 360,
        });
      })
      .catch(() => {
        if (active) setLoadFailed(true);
      });

    return () => {
      active = false;
      container.replaceChildren();
    };
  }, [loadAttempt]);

  if (!env.googleClientId) {
    return (
      <div className="mb-5 space-y-4">
        <p role="status" className="text-center text-sm text-muted-foreground">
          {t("google.notConfigured")}
        </p>
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span className="h-px flex-1 bg-border" />
          <span>{t("google.or")}</span>
          <span className="h-px flex-1 bg-border" />
        </div>
      </div>
    );
  }

  return (
    <div className="mb-5 space-y-4">
      {loadFailed ? (
        <div className="space-y-2 text-center">
          <p role="alert" className="text-sm text-destructive">
            {t("google.unavailable")}
          </p>
          <button
            type="button"
            className="text-sm font-medium text-primary underline-offset-4 hover:underline"
            onClick={() => {
              setLoadFailed(false);
              setLoadAttempt((attempt) => attempt + 1);
            }}
          >
            {t("google.retry")}
          </button>
        </div>
      ) : (
        <div className={cn("flex min-h-10 justify-center", disabled && "pointer-events-none opacity-60")}>
          <div ref={containerRef} />
        </div>
      )}
      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        <span className="h-px flex-1 bg-border" />
        <span>{t("google.or")}</span>
        <span className="h-px flex-1 bg-border" />
      </div>
    </div>
  );
}
