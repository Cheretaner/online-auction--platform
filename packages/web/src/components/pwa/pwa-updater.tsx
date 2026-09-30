import { useRegisterSW } from "virtual:pwa-register/react";
import { toast } from "sonner";
import { useEffect } from "react";

export function PwaUpdater() {
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW() {
      // Registration is enough; Workbox handles asset caching.
    },
    onRegisterError() {
      // PWA is optional in development and should not break the app.
    },
  });

  useEffect(() => {
    if (!needRefresh) return;
    toast("A new version is available", {
      action: {
        label: "Reload",
        onClick: () => {
          void updateServiceWorker(true);
        },
      },
      duration: Infinity,
    });
  }, [needRefresh, updateServiceWorker]);

  return null;
}
