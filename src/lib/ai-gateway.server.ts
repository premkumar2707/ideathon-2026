import { createOpenAICompatible } from "@ai-sdk/openai-compatible";

/**
 * Creates an OpenAI-compatible AI provider pointing to the configured gateway.
 * Set AI_GATEWAY_BASE_URL and AI_GATEWAY_API_KEY in your .env to override defaults.
 */
export function createAiGatewayProvider(apiKey: string) {
  return createOpenAICompatible({
    name: "ai-gateway",
    baseURL:
      process.env.AI_GATEWAY_BASE_URL || "https://ai.gateway.lovable.dev/v1",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "x-api-key": apiKey,
    },
  });
}