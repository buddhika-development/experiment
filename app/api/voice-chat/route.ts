import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getLlm } from "@/app/lib/llm";
import { describeSettings, normalizeSettings } from "@/app/lib/model-settings";
import {
  EXTRACTION_RULES,
  finalize,
  journalInformationSchema,
  personalInformationSchema,
} from "@/app/lib/extraction-schema";

/**
 * Conversational extraction endpoint. Each turn the client sends the chat so
 * far plus the extraction state it already holds; the LLM replies like a
 * companion AND returns the complete updated extraction (journal fields +
 * personal likes/dislikes/details), which the client persists in the
 * session store.
 */

const chatResponseSchema = z.object({
  assistant_reply: z
    .string()
    .describe(
      "Your next spoken chat message: warm, natural, 1-3 short sentences, no markdown or lists. Acknowledge what the user shared and, when journal fields are still missing, ask ONE gentle follow-up about them (sleep, mood, symptoms, hot flashes, or evening routine)."
    ),
  journal_information: journalInformationSchema,
  personal_information: personalInformationSchema,
});

const SYSTEM_PROMPT = `You are the voice companion of "Unpause", a daily wellness journal app. You chat with the user about their day, sleep, mood, symptoms and life in general.

Each turn you do two jobs:
1. Write assistant_reply — the next message of the conversation, which will be read aloud.
2. Re-emit the COMPLETE extraction state (journal_information + personal_information), updated with everything learned in the conversation so far.

Merging rules for the extraction:
- You are given the CURRENT EXTRACTION STATE below. Start from it: keep every previously captured value unless the user corrects or updates it in a later message.
- Add newly learned values from the latest messages.
- For personal_information arrays, carry existing items forward and only append genuinely new, non-duplicate items.

${EXTRACTION_RULES}`;

const messageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string(),
});

const requestSchema = z.object({
  messages: z.array(messageSchema).min(1),
  current_extraction: z.unknown().optional(),
  /** Chosen LLM service from the client's Settings; re-validated by getLlm. */
  settings: z.unknown().optional(),
});

/** Bound the prompt: the extraction state already summarizes older turns. */
const MAX_MESSAGES = 30;

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "messages is required and must be a non-empty array of {role, content}" },
      { status: 400 }
    );
  }

  const {
    messages,
    current_extraction: currentExtraction,
    settings,
  } = parsed.data;
  if (messages[messages.length - 1].role !== "user") {
    return NextResponse.json(
      { error: "The last message must be from the user" },
      { status: 400 }
    );
  }

  const stateJson = currentExtraction
    ? JSON.stringify(currentExtraction, null, 2)
    : "No information extracted yet — this is a fresh session.";

  const active = normalizeSettings(settings);

  try {
    const structuredLlm = getLlm(active).withStructuredOutput(chatResponseSchema, {
      name: "voice_chat_turn",
    });

    const result = (await structuredLlm.invoke([
      ["system", `${SYSTEM_PROMPT}\n\nCURRENT EXTRACTION STATE:\n${stateJson}`],
      ...messages
        .slice(-MAX_MESSAGES)
        .map(
          (m) => [m.role === "user" ? "human" : "ai", m.content] as [string, string]
        ),
    ])) as z.infer<typeof chatResponseSchema>;

    // Keep only detected symptoms so the block reads as a map of findings.
    const detectedSymptoms = Object.fromEntries(
      Object.entries(result.journal_information.symptoms).filter(
        ([, entry]) => entry !== null
      )
    );

    return NextResponse.json({
      reply: result.assistant_reply,
      extraction: finalize({
        journal_information: {
          ...result.journal_information,
          symptoms: detectedSymptoms,
        },
        personal_information: result.personal_information,
      }),
      // Echo what actually answered, so the UI can show the live service.
      used: active,
    });
  } catch (error) {
    console.error(`voice-chat failed (${active.provider}/${active.model}):`, error);

    // A missing API key is a setup problem the user can fix in Settings —
    // say so instead of hiding it behind a generic failure.
    if (error instanceof Error && error.message.includes("is not set in .env")) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json(
      {
        error: `Failed to process the conversation with ${describeSettings(active)}. Try again, or switch service in Settings.`,
      },
      { status: 500 }
    );
  }
}
