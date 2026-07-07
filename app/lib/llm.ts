import { ChatOpenAI } from "@langchain/openai";

let llm: ChatOpenAI | null = null;

/** Shared LangChain OpenAI connection (gpt-4o-mini), lazily created per server instance. */
export function getLlm(): ChatOpenAI {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is not set in .env");
  }
  if (!llm) {
    llm = new ChatOpenAI({
      model: "gpt-4o-mini",
      apiKey: process.env.OPENAI_API_KEY,
      temperature: 0,
    });
  }
  return llm;
}
