export type ModelTier = "high" | "balanced" | "fast";

/**
 * Resolves the model to use for AI calls.
 * Priority: OPENAI_MODEL env var > tier defaults.
 */
export function getModel(tier: ModelTier = "balanced"): string {
  const envModel = (process.env.OPENAI_MODEL || "").trim();
  if (envModel) return envModel;
  switch (tier) {
    case "high":
      return "gpt-5"; // prefer highest tier if available
    case "fast":
      return "o4-mini"; // speed-optimized default
    case "balanced":
    default:
      return "gpt-4o"; // general-purpose default
  }
}

export const MODEL = getModel();

