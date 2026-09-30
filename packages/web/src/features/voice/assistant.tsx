import { VoxideWidget } from "@voxide/react";
import { voxideClient } from "@/features/voice/client";

export default function VoiceAssistant() {
  return voxideClient ? <VoxideWidget client={voxideClient} /> : null;
}
