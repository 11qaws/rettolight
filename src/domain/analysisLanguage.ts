export type AnalysisLanguage = "ko" | "en";

export function isAnalysisLanguage(value: unknown): value is AnalysisLanguage {
  return value === "ko" || value === "en";
}

export function analysisLanguageLabel(language: AnalysisLanguage): string {
  return language === "ko" ? "한국어" : "English";
}
