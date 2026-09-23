import { lazy, StrictMode, Suspense } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "react-router-dom";
import { router } from "@/app/router";
import { env } from "@/config/env";
import "./index.css";

const VoiceAssistant = lazy(() => import("@/features/voice/assistant"));

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <>
      <RouterProvider router={router} />
      {env.voxidePublicKey ? (
        <Suspense fallback={null}>
          <VoiceAssistant />
        </Suspense>
      ) : null}
    </>
  </StrictMode>,
);
