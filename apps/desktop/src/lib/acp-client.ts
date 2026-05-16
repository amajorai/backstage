import { invoke } from "@tauri-apps/api/core";
import type { AcpAgent } from "@/stores/use-app-settings-store";

export async function acpPrompt(
  agent: AcpAgent,
  promptText: string,
  imageData?: string,
  imageMimeType?: string
): Promise<string> {
  const envVars: Record<string, string> = {};
  for (const { key, value } of agent.envVars) {
    if (key.trim()) {
      envVars[key.trim()] = value;
    }
  }

  return invoke<string>("acp_prompt", {
    agentCommand: agent.command,
    agentArgs: agent.args,
    envVars,
    promptText,
    imageData: imageData ?? null,
    imageMimeType: imageMimeType ?? null,
  });
}
