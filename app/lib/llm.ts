import { ChatOpenAI } from "@langchain/openai";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import type { BaseChatModel } from "@langchain/core/language_models/chat_models";
import {
  LLM_PROVIDERS,
  normalizeSettings,
  type ModelSettings,
} from "./model-settings";

/**
 * Builds the LangChain chat connection for whichever service the user selected
 * in Settings (OpenAI or Google Gemini). Connections are cached per
 * provider:model for the life of the server instance, so switching services in
 * the UI costs nothing after the first request.
 */

const cache = new Map<string, BaseChatModel>();

/** GPT-5 reasoning models reject any temperature other than the default. */
function supportsTemperature(model: string): boolean {
  return !model.startsWith("gpt-5") && !/^o\d/.test(model);
}

function create({ provider, model }: ModelSettings): BaseChatModel {
  const { envKey, label } = LLM_PROVIDERS[provider];
  const apiKey = process.env[envKey];
  if (!apiKey) {
    throw new Error(
      `${envKey} is not set in .env — required to use ${label}. Either add the key or pick another service in Settings.`
    );
  }

  if (provider === "gemini") {
    return new ChatGoogleGenerativeAI({ model, apiKey, temperature: 0 });
  }

  return new ChatOpenAI({
    model,
    apiKey,
    ...(supportsTemperature(model) ? { temperature: 0 } : {}),
  });
}

/**
 * Shared chat connection for the given settings. `settings` comes from the
 * client and is re-validated here, so an unknown provider/model can never
 * reach a vendor SDK.
 */
export function getLlm(settings?: unknown): BaseChatModel {
  const clean = normalizeSettings(settings);
  const key = `${clean.provider}:${clean.model}`;

  let llm = cache.get(key);
  if (!llm) {
    llm = create(clean);
    cache.set(key, llm);
  }
  return llm;
}
