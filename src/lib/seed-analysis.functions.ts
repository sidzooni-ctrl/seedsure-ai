import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const InputSchema = z.object({
  dataUrl: z
    .string()
    .min(32)
    .max(12_000_000)
    .refine((v) => v.startsWith("data:image/"), "Must be an image data URL"),
});

export type SeedAnalysis = {
  seedType: "WHEAT" | "RICE" | "INVALID";
  confidence: number;
  qualityScore: number;
  viability: number;
  qualityStatus: "Good" | "Moderate" | "Poor" | "N/A";
  recommendation: string;
  defects: string[];
  abnormalities: string[];
  notes: string;
};

const INVALID: SeedAnalysis = {
  seedType: "INVALID",
  confidence: 0,
  qualityScore: 0,
  viability: 0,
  qualityStatus: "N/A",
  recommendation: "Not Recommended",
  defects: [],
  abnormalities: [],
  notes: "INVALID SEED — Only Wheat and Rice seeds are supported.",
};

const SYSTEM = `You are a strict agronomic seed-inspection vision system.

STEP 1 — CLASSIFICATION (strict):
Decide whether the image clearly and confidently shows WHEAT seeds/kernels or RICE seeds/grains.
Return "INVALID" if ANY of the following is true:
- the subject is any other seed, grain, plant, food, object, animal, person, screenshot, or text
- there is no seed visible
- the image is blurry, dark, cropped, low quality, or otherwise unclear
- you are not highly confident (< 0.85) whether it is wheat or rice
NEVER guess. NEVER force an unsupported subject into wheat or rice.

STEP 2 — ANALYSIS (only when WHEAT or RICE):
Assess overall quality (0-100), germination viability (0-100), visible defects
(cracks, discoloration, mold/fungal spots, insect damage, shrivelling, broken kernels,
immature grains, foreign matter) and abnormalities.
qualityStatus: Good (>=75), Moderate (50-74), Poor (<50).
recommendation must be exactly one of: "Suitable for Planting", "Further Testing", "Not Recommended".

Reply with ONLY minified JSON:
{"seedType":"WHEAT"|"RICE"|"INVALID","confidence":0-1,"qualityScore":0-100,"viability":0-100,"qualityStatus":"Good"|"Moderate"|"Poor"|"N/A","recommendation":string,"defects":string[],"abnormalities":string[],"notes":string}`;

export const analyzeSeedImage = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => InputSchema.parse(input))
  .handler(async ({ data }): Promise<SeedAnalysis> => {
    const key = process.env["LOVABLE_API_KEY"];
    if (!key) throw new Error("AI is not configured for this project.");

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Lovable-API-Key": key },
      body: JSON.stringify({
        model: "google/gemini-3-flash",
        messages: [
          { role: "system", content: SYSTEM },
          {
            role: "user",
            content: [
              { type: "text", text: "Classify and analyze this seed sample." },
              { type: "image_url", image_url: { url: data.dataUrl } },
            ],
          },
        ],
        response_format: { type: "json_object" },
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      if (res.status === 429) throw new Error("Rate limit reached. Please wait a moment and analyze again.");
      if (res.status === 402) throw new Error("AI credits exhausted. Add credits in Lovable to continue analyzing.");
      throw new Error(`Analysis failed (${res.status}). ${body.slice(0, 200)}`);
    }

    const json = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const raw = json.choices?.[0]?.message?.content ?? "";
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) return INVALID;

    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(match[0]) as Record<string, unknown>;
    } catch {
      return INVALID;
    }

    const type = String(parsed["seedType"] ?? "").toUpperCase();
    const confidence = clamp01(Number(parsed["confidence"] ?? 0));
    if ((type !== "WHEAT" && type !== "RICE") || confidence < 0.85) return INVALID;

    const qualityScore = clampInt(Number(parsed["qualityScore"] ?? 0));
    const viability = clampInt(Number(parsed["viability"] ?? 0));
    const status =
      qualityScore >= 75 ? "Good" : qualityScore >= 50 ? "Moderate" : "Poor";
    const rec = String(parsed["recommendation"] ?? "");

    return {
      seedType: type,
      confidence,
      qualityScore,
      viability,
      qualityStatus: status,
      recommendation: ["Suitable for Planting", "Further Testing", "Not Recommended"].includes(rec)
        ? rec
        : status === "Good"
          ? "Suitable for Planting"
          : status === "Moderate"
            ? "Further Testing"
            : "Not Recommended",
      defects: toStrings(parsed["defects"]),
      abnormalities: toStrings(parsed["abnormalities"]),
      notes: String(parsed["notes"] ?? "").slice(0, 500),
    };
  });

function clamp01(n: number) {
  return Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : 0;
}
function clampInt(n: number) {
  return Number.isFinite(n) ? Math.round(Math.min(100, Math.max(0, n))) : 0;
}
function toStrings(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.map((x) => String(x)).filter(Boolean).slice(0, 8);
}
