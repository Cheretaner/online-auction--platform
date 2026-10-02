import { useRegisterSW } from "virtual:pwa-register/react";
import { toast } from "sonner";
import { useEffect } from "react";
import { translate } from "@/i18n/context";

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
    toast(translate("common", "newVersion"), {
      action: {
        label: translate("common", "reload"),
        onClick: () => {
          void updateServiceWorker(true);
        },
      },
      duration: Infinity,
    });
  }, [needRefresh, updateServiceWorker]);

  return null;
}
