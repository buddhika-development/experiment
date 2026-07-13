/**
 * The catalog of LLM services the app can talk to, shared by the client (the
 * settings page) and the server (the chat route). The client picks a
 * provider + model and stores it locally; the server re-validates the choice
 * against this same catalog before building a connection, so a tampered
 * request can never point the app at an arbitrary model.
 */

export type LlmProviderId = "openai" | "gemini";

export interface LlmModel {
  id: string;
  label: string;
  hint: string;
}

export interface LlmProvider {
  id: LlmProviderId;
  label: string;
  /** Env var holding this provider's key, surfaced in setup errors. */
  envKey: string;
  models: LlmModel[];
}

export const LLM_PROVIDERS: Record<LlmProviderId, LlmProvider> = {
  openai: {
    id: "openai",
    label: "OpenAI",
    envKey: "OPENAI_API_KEY",
    models: [
      { id: "gpt-4o-mini", label: "GPT-4o mini", hint: "Fast and cheap. Good default." },
      { id: "gpt-4o", label: "GPT-4o", hint: "Stronger reasoning, higher cost." },
      { id: "gpt-4.1-mini", label: "GPT-4.1 mini", hint: "Fast, better instruction following." },
      { id: "gpt-4.1", label: "GPT-4.1", hint: "Strong, reliable structured output." },
      { id: "gpt-5-mini", label: "GPT-5 mini", hint: "Reasoning model. Slower, more thorough." },
      { id: "gpt-5", label: "GPT-5", hint: "Most capable. Slowest and priciest." },
    ],
  },
  gemini: {
    id: "gemini",
    label: "Google Gemini",
    envKey: "GOOGLE_API_KEY",
    // Gemini 2.5 is deliberately absent: its constrained decoder rejects the
    // extraction schema ("too many states for serving") because of the numeric
    // min/max bounds. Only 3.x can serve it.
    models: [
      { id: "gemini-3.5-flash", label: "Gemini 3.5 Flash", hint: "Latest fast Gemini. Good default." },
      { id: "gemini-3.1-flash-lite", label: "Gemini 3.1 Flash Lite", hint: "Fastest and cheapest." },
      { id: "gemini-3.1-pro-preview", label: "Gemini 3.1 Pro (preview)", hint: "Strongest reasoning, higher cost." },
    ],
  },
};

export const PROVIDER_LIST: LlmProvider[] = [
  LLM_PROVIDERS.openai,
  LLM_PROVIDERS.gemini,
];

export interface ModelSettings {
  provider: LlmProviderId;
  model: string;
}

/** Preserves the app's original behaviour when nothing has been chosen yet. */
export const DEFAULT_SETTINGS: ModelSettings = {
  provider: "openai",
  model: "gpt-4o-mini",
};

/** First model of a provider — used when switching providers in the UI. */
export function defaultModelFor(provider: LlmProviderId): string {
  return LLM_PROVIDERS[provider].models[0].id;
}

/**
 * Coerce anything (localStorage JSON, a request body) into settings that name
 * a real provider and one of its real models. Unknown values fall back rather
 * than throw, so a stale saved setting can never brick the chat.
 */
export function normalizeSettings(value: unknown): ModelSettings {
  if (!value || typeof value !== "object") return DEFAULT_SETTINGS;

  const { provider, model } = value as { provider?: unknown; model?: unknown };
  if (provider !== "openai" && provider !== "gemini") return DEFAULT_SETTINGS;

  const known = LLM_PROVIDERS[provider].models.some((m) => m.id === model);
  return {
    provider,
    model: known ? (model as string) : defaultModelFor(provider),
  };
}

/** Human label for a stored setting, e.g. "OpenAI · GPT-4o mini". */
export function describeSettings(settings: ModelSettings): string {
  const provider = LLM_PROVIDERS[settings.provider];
  const model = provider.models.find((m) => m.id === settings.model);
  return `${provider.label} · ${model?.label ?? settings.model}`;
}
