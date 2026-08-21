/**
 * OpenRouter Nemotron client — the research and evidence-synthesis model.
 *
 * Server-only. The model ID comes from OPENROUTER_MODEL; it is never hard-coded,
 * so swapping models is a config change.
 *
 * Nemotron has no internet access of its own. It plans queries and interprets
 * results that the search provider fetched; the actual web access happens in
 * `lib/search`.
 */
import { chatCompletion, type ChatMessage } from "./client";
import { requireEnv } from "@/lib/env";
import type { InvestigationStage } from "@/types/events";

const OPENROUTER_CHAT_URL = "https://openrouter.ai/api/v1/chat/completions";

/**
 * Reasoning tokens count against max_tokens, and this model thinks at length,
 * so the budget is generous relative to the size of the answer.
 */
const DEFAULT_MAX_TOKENS = 3000;

export type NemotronRequest = {
  systemPrompt: string;
  userPrompt: string;
  stage: InvestigationStage;
  maxTokens?: number;
  temperature?: number;
  timeoutMs?: number;
};

/**
 * OpenRouter attribution headers. Optional, but they identify the app in
 * OpenRouter's dashboards and are required for some free-tier rate allowances.
 */
function attributionHeaders(): Record<string, string> {
  // VERCEL_URL is injected by the platform; absent in local development.
  const site = process.env.VERCEL_URL;
  return {
    ...(site ? { "HTTP-Referer": `https://${site}` } : {}),
    "X-Title": "WaterLens",
  };
}

/** Calls Nemotron and returns the assistant message text. */
export async function askNemotron({
  systemPrompt,
  userPrompt,
  stage,
  maxTokens = DEFAULT_MAX_TOKENS,
  temperature = 0.3,
  timeoutMs = 90_000,
}: NemotronRequest): Promise<string> {
  const apiKey = requireEnv("OPENROUTER_API_KEY");
  const model = requireEnv("OPENROUTER_MODEL");

  const messages: ChatMessage[] = [
    { role: "system", content: systemPrompt },
    { role: "user", content: userPrompt },
  ];

  return chatCompletion({
    baseUrl: OPENROUTER_CHAT_URL,
    apiKey,
    model,
    messages,
    maxTokens,
    temperature,
    // Deliberately not jsonMode: with this model on OpenRouter's free tier,
    // response_format=json_object degenerates into repeated whitespace and
    // burns the whole token budget. The prompt asks for JSON instead, and
    // extractJsonObject() handles the fences and reasoning preambles.
    jsonMode: false,
    timeoutMs,
    stage,
    headers: attributionHeaders(),
    // Free-tier capacity is intermittent; one retry absorbs a transient 429.
    retries: 1,
  });
}
