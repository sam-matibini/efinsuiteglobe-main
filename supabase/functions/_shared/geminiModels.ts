// Hardcoded per-module Gemini model defaults (Phase 1.3).
// Change here to switch a module's model globally.
export const GEMINI_MODELS = {
  bankOcr: "gemini-2.5-pro",
  aliceSheets: "gemini-2.5-pro",
  aliceChat: "gemini-2.5-pro",
  documentAnalysis: "gemini-2.5-pro",
  financialReports: "gemini-2.5-flash",
  categorization: "gemini-2.5-flash",
} as const;

export type GeminiModuleKey = keyof typeof GEMINI_MODELS;
