/**
 * NVIDIA NIM vision client.
 *
 * Server-only. Sends the image to NVIDIA_VISION_MODEL and returns the raw
 * assistant text; prompt construction and parsing live in `vision-prompts.ts`
 * so this module stays a transport concern.
 */
import { chatCompletion, type ContentPart } from "./client";
import { requireEnv } from "@/lib/env";
import { InvestigationError } from "@/lib/investigation/errors";
import { parseImageDataUrl } from "@/lib/utils/validation";

const NVIDIA_CHAT_URL = "https://integrate.api.nvidia.com/v1/chat/completions";

/** Reasoning model: the budget must cover the chain of thought plus the answer. */
const MAX_TOKENS = 1600;

export type VisionRequest = {
  /** `data:image/...;base64,...` produced by the browser downscaler. */
  imageDataUrl: string;
  systemPrompt: string;
  userPrompt: string;
};

/** Validates a data URL and returns it, or throws a user-safe error. */
function assertImageDataUrl(imageDataUrl: string): string {
  const parsed = parseImageDataUrl(imageDataUrl);
  if (!parsed) {
    throw new InvestigationError(
      "vision",
      "The image could not be read. Use a JPEG, PNG or WebP photo under 4 MB.",
    );
  }
  return imageDataUrl;
}

/** Calls the vision model and returns the assistant message text. */
export async function requestVisionAnalysis({
  imageDataUrl,
  systemPrompt,
  userPrompt,
}: VisionRequest): Promise<string> {
  // Read the key first so a missing configuration fails before any work.
  const apiKey = requireEnv("NVIDIA_API_KEY");
  const model = requireEnv("NVIDIA_VISION_MODEL");
  const url = assertImageDataUrl(imageDataUrl);

  const content: ContentPart[] = [
    { type: "text", text: userPrompt },
    { type: "image_url", image_url: { url } },
  ];

  return chatCompletion({
    baseUrl: NVIDIA_CHAT_URL,
    apiKey,
    model,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content },
    ],
    maxTokens: MAX_TOKENS,
    // Low temperature: this stage describes, it does not speculate.
    temperature: 0.15,
    jsonMode: true,
    timeoutMs: 60_000,
    stage: "vision",
  });
}
