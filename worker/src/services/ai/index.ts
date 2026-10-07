import type { AIProvider, Env } from "../../types";
import { WorkersAIProvider } from "./workers-ai.provider";
import { OpenAICompatibleProvider } from "./openai-compatible.provider";

export function createAIProvider(env: Env): AIProvider {
  const provider = env.AI_PROVIDER?.toLowerCase() || (env.AI ? "workers-ai" : "openai-compatible");
  if (provider === "workers-ai") {
    return new WorkersAIProvider(env);
  }
  return new OpenAICompatibleProvider(env);
}

export * from "./workers-ai.provider";
export * from "./openai-compatible.provider";
