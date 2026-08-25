import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import {
  analyzeSeedVision,
  callAiVisionApi,
  INVALID_SEED_RESULT,
  type SeedAnalysis,
} from "./vision-engine";

export type { SeedAnalysis };

const InputSchema = z.object({
  dataUrl: z
    .string()
    .min(32)
    .max(12_000_000)
    .refine((v) => v.startsWith("data:image/"), "Must be an image data URL"),
  apiKey: z.string().optional(),
  filename: z.string().optional(),
});

export const analyzeSeedImage = createServerFn({ method: "POST" })
  .validator((input: unknown) => InputSchema.parse(input))
  .handler(async ({ data }): Promise<SeedAnalysis> => {
    try {
      // 1. Try Live AI Vision API (Gemini / Lovable / OpenAI) if an API key is available
      const aiResult = await callAiVisionApi(data.dataUrl, data.apiKey, data.filename);
      if (aiResult) {
        return aiResult;
      }
    } catch {
      // Proceed to agronomic vision heuristics engine
    }

    // 2. High-performance Agronomic Computer Vision Analysis Engine
    try {
      return await analyzeSeedVision(data.dataUrl, data.filename);
    } catch {
      return INVALID_SEED_RESULT;
    }
  });
