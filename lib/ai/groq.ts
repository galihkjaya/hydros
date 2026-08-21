/**
 * Groq client — the final reasoning model.
 *
 * Server-only. Takes the compact EvidencePackage and returns the structured
 * assessment. Model ID comes from GROQ_MODEL.
 *
 * This is the only stage permitted to draw inferences, and even here the prompt
 * forbids implying laboratory certainty. Prompt construction and schema
 * validation live in `assessment.ts`; this module is transport.
 */
import { chatCompletion } from "./client";
import { requireEnv } from "@/lib/env";

const GROQ_CHAT_URL = "https://api.groq.com/openai/v1/chat/completions";

/**
 * Budget covers reasoning tokens plus a structured assessment with several
 * arrays. Measured ~1.5k tokens for a typical answer.
 */
const MAX_TOKENS = 4000;

export type GroqRequest = {
  systemPrompt: string;
  userPrompt: string;
};

/** Calls Groq and returns the assistant message text. */
export async function askGroq({
  systemPrompt,
  userPrompt,
}: GroqRequest): Promise<string> {
  const apiKey = requireEnv("GROQ_API_KEY");
  const model = requireEnv("GROQ_MODEL");

  return chatCompletion({
    baseUrl: GROQ_CHAT_URL,
    apiKey,
    model,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    maxTokens: MAX_TOKENS,
    // Low temperature: the same evidence should not yield a different risk
    // level from one run to the next.
    temperature: 0.15,
    // Verified: this model honours response_format json_object cleanly.
    jsonMode: true,
    timeoutMs: 60_000,
    stage: "reasoning",
    retries: 1,
  });
}
