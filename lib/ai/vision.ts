/**
 * NVIDIA NIM vision client.
 *
 * Server-only. Sends the image to NVIDIA_VISION_MODEL and returns the raw
 * assistant text; prompt construction and parsing live in `vision-prompts.ts`
 * so this module stays a transport concern.
 */
import { chatCompletion, type ContentPart } from "./client";
import {
  VISION_SYSTEM_PROMPT,
  buildVisionUserPrompt,
  parseVisualAnalysis,
  stripUnsupportedClaims,
} from "./vision-prompts";
import { requireEnv } from "@/lib/env";
import { InvestigationError } from "@/lib/investigation/errors";
import { parseImageDataUrl } from "@/lib/utils/validation";
import type { VisualAnalysis } from "@/types/investigation";

const NVIDIA_CHAT_URL = "https://integrate.api.nvidia.com/v1/chat/completions";

/** Reasoning model: the budget must cover the chain of thought plus the answer. */
const MAX_TOKENS = 1600;

export type VisionRequest = {
  /** `data:image/...;base64,...` produced by the browser downscaler. */
  imageDataUrl: string;
  /** Optional untrusted user note, fenced inside the prompt. */
  userNote: string;
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

/**
 * Runs the visual analysis stage.
 *
 * Returns a validated VisualAnalysis with unsupported claims stripped, so
 * callers can trust that nothing here asserts safety or contamination.
 */
export async function analyzeImage({
  imageDataUrl,
  userNote,
}: VisionRequest): Promise<VisualAnalysis> {
  // Read config first so a missing key fails before any work.
  const apiKey = requireEnv("NVIDIA_API_KEY");
  const model = requireEnv("NVIDIA_VISION_MODEL");
  const url = assertImageDataUrl(imageDataUrl);

  const content: ContentPart[] = [
    { type: "text", text: buildVisionUserPrompt(userNote) },
    { type: "image_url", image_url: { url } },
  ];

  const responseText = await chatCompletion({
    baseUrl: NVIDIA_CHAT_URL,
    apiKey,
    model,
    messages: [
      { role: "system", content: VISION_SYSTEM_PROMPT },
      { role: "user", content },
    ],
    maxTokens: MAX_TOKENS,
    // Low temperature: this stage describes, it does not speculate.
    temperature: 0.15,
    jsonMode: true,
    timeoutMs: 60_000,
    stage: "vision",
  });

  const analysis = stripUnsupportedClaims(parseVisualAnalysis(responseText));

  if (!analysis.isWaterVisible || analysis.observations.length === 0) {
    throw new InvestigationError(
      "vision",
      "No water source could be identified in this photograph. Try a clearer, closer photo of the water.",
    );
  }

  return analysis;
}
