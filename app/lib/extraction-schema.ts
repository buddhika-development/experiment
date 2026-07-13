import { z } from "zod";

/**
 * Server-side zod schemas for the structured LLM extraction.
 *
 * Every extracted value is attributed: provider says whether the user stated
 * it directly ("user", confidence 1.0) or the AI inferred it ("ai_assistant",
 * confidence < 1.0 with reasoning), so the UI can auto-apply direct values and
 * highlight inferred ones for review.
 */
const provider = z
  .enum(["user", "ai_assistant"])
  .describe(
    "'user' when the value was stated explicitly; 'ai_assistant' when it was inferred from context."
  );

const confidence = z
  .number()
  .min(0)
  .max(1)
  .describe("1.0 for explicit user statements; lower for AI inferences.");

const metadata = z.object({
  reasoning: z
    .string()
    .nullable()
    .describe(
      "Short explanation of how the value was inferred. Null when provider is 'user'."
    ),
});

const severity = z.enum(["mild", "moderate", "severe"]);

const symptomEntry = z
  .object({ severity, provider, confidence, metadata })
  .nullable()
  .describe("Null when this symptom was not mentioned or implied.");

const sweatEpisode = z.object({
  severity,
  episodes: z
    .number()
    .int()
    .min(0)
    .nullable()
    .describe("Episode count. Null if the user lost track or gave no number."),
  provider,
  confidence,
  metadata,
});

const moodEnum = z.enum([
  "Calm",
  "Energized",
  "Depressed",
  "Irritable",
  "Anxious",
  "Neutral",
]);

const yesNoAnswer = z.object({
  answer: z.boolean(),
  provider,
  confidence,
  metadata,
});

export const journalInformationSchema = z.object({
  sleep_information: z.object({
    primary_episode: z
      .object({
        sleep_hours: z.number().min(0).max(24).nullable(),
        sleep_quality: z
          .number()
          .int()
          .min(1)
          .max(10)
          .nullable()
          .describe("1 (poor) to 10 (excellent)."),
        awakening_count: z.number().int().min(0).nullable(),
        provider,
        confidence,
        metadata,
      })
      .nullable()
      .describe("The main night's sleep. Null if sleep was not mentioned at all."),
    additional_episodes: z
      .array(
        z.object({
          description: z.string(),
          estimated_duration_lost: z
            .number()
            .min(0)
            .nullable()
            .describe("Hours of sleep lost in this episode, if estimable."),
          provider,
          confidence,
          metadata,
        })
      )
      .describe(
        "Sleep disruptions, naps, or episodes that do not fit the primary fields (e.g. a 12am-2am wake caused by a bad dream)."
      ),
  }),
  symptoms: z
    .object({
      hot_flashes: symptomEntry,
      night_sweats: symptomEntry,
      fatigue: symptomEntry,
      headache: symptomEntry,
      joint_pain: symptomEntry,
      brain_fog: symptomEntry,
      mood_swings: symptomEntry,
      insomnia: symptomEntry,
    })
    .describe("Set only the symptoms that were stated or clinically implied."),
  hot_flashes_today: z
    .object({
      count: z.number().int().min(0).nullable(),
      provider,
      confidence,
      metadata,
    })
    .nullable()
    .describe(
      "Hot flash count for today. If the user walked through their whole day without mentioning hot flashes, default count to 0 as an ai_assistant inference (~0.9 confidence). Null only when the conversation is too narrow to tell."
    ),
  night_sweats: z.object({
    during_day: z
      .array(sweatEpisode)
      .describe("Sweat episodes during daytime (e.g. naps). Empty if none."),
    during_sleep: z
      .array(sweatEpisode)
      .describe("Sweat episodes during night sleep. Empty if none."),
  }),
  mood_information: z.object({
    primary_mood: z
      .object({
        emotion: moodEnum,
        emotion_strength: z
          .number()
          .int()
          .min(1)
          .max(5)
          .nullable()
          .describe("1 (barely noticeable) to 5 (overwhelming)."),
        stress_level: z
          .number()
          .int()
          .min(1)
          .max(5)
          .nullable()
          .describe("1 (not at all) to 5 (very stressed)."),
        provider,
        confidence,
        metadata,
      })
      .nullable()
      .describe("The dominant mood of the day. Null if mood was not mentioned."),
    additional_moods: z
      .array(
        z.object({
          emotion: moodEnum,
          emotion_strength: z.number().int().min(1).max(5).nullable(),
          provider,
          confidence,
          metadata,
        })
      )
      .describe("Secondary moods extracted from context. Empty if none."),
  }),
  evening_routine: z.object({
    coffee_after_2pm: yesNoAnswer
      .nullable()
      .describe("Caffeine after 2 PM. Null if not determinable."),
    screen_time_before_bed: z
      .object({
        answer: z.boolean(),
        duration_hours: z
          .number()
          .min(0)
          .nullable()
          .describe(
            "Total computed screen hours before bed when durations were mentioned (sum devices, e.g. 4h phone + 40min tablet = 4.6). Null if no duration given."
          ),
        provider,
        confidence,
        metadata,
      })
      .nullable(),
    evening_alcohol: yesNoAnswer
      .nullable()
      .describe("Alcohol in the evening. Null if not determinable."),
  }),
  notes: z
    .object({
      additional_text: z
        .string()
        .max(500)
        .describe(
          "First-person summary of relevant context that fits no other field (events, worries, free-text detail)."
        ),
      provider,
      confidence,
      metadata,
    })
    .nullable()
    .describe("Null when there is nothing beyond the structured fields."),
});

const personalItem = z.object({
  description: z
    .string()
    .describe(
      "Short, specific third-person fact with clear health relevance, e.g. 'Drinks 3 cups of coffee daily, the last one around 4pm'. Skip anything vague or medically inconsequential."
    ),
  provider,
  confidence,
  metadata,
});

export const personalInformationSchema = z.object({
  summary: z
    .string()
    .nullable()
    .describe(
      "An evolving 2-4 sentence third-person clinical portrait of the user, e.g. 'A 52-year-old teacher, 8 months into perimenopause. Sleeps poorly on nights she drinks wine, and her hot flashes cluster around work deadlines.' Focus on what a clinician would want to know: age and menopause stage, diagnoses, medications, and recurring health or lifestyle patterns. Mention day-to-day life only where it plausibly bears on her health. Re-evaluate on EVERY turn: start from the previous summary, fold in newly learned medically relevant facts, and drop anything the user corrected. Null when nothing of medical value is known yet."
    ),
  likes: z
    .array(personalItem)
    .describe(
      "Only preferences with plausible health relevance: foods, drinks, substances, exercise, sleep habits, or activities that could affect symptoms. Ignore preferences with no medical bearing (favourite film, colour, sports team). Carry forward previously captured items and avoid duplicates."
    ),
  dislikes: z
    .array(personalItem)
    .describe(
      "Only aversions with plausible health relevance: foods or substances avoided, triggers, intolerable environments, activities she avoids because of symptoms. Ignore medically inconsequential dislikes. Carry forward previously captured items and avoid duplicates."
    ),
  other_details: z
    .array(personalItem)
    .describe(
      "Personal facts that carry medical value now or later: age, menopause stage, medications and supplements, diagnoses and past conditions, family medical history, allergies, surgeries, cycle details, diet, alcohol/caffeine/smoking habits, exercise, and recurring stressors or lifestyle patterns a clinician might connect to symptoms. Also keep the few identity facts needed to make sense of them (name, occupation or living situation when they shape her health). Do NOT store trivia, one-off chit-chat, or vague statements with no clinical meaning. Carry forward and avoid duplicates."
    ),
});

export type JournalInformation = z.infer<typeof journalInformationSchema>;
export type PersonalInformation = z.infer<typeof personalInformationSchema>;

/** Shared extraction rules appended to route system prompts. */
export const EXTRACTION_RULES = `Attribution rules:
- provider "user" + confidence 1.0: the user stated the value explicitly ("I woke up 3 times").
- provider "ai_assistant" + confidence < 1.0: you inferred the value from context ("I can't think straight" -> brain_fog, mild). Always give metadata.reasoning explaining the inference. Calibrate confidence to how strongly the context supports it.
- Never invent values with no basis in the conversation. Use null / empty arrays for anything absent.

Journal structure rules:
- primary_episode / primary_mood map to fixed form controls: fill them with the main night's sleep and the dominant mood.
- Context that does not fit those fields goes into additional_episodes / additional_moods (e.g. a 2-hour wake after a nightmare, or a secondary emotion implied by an event).
- If the user described their day broadly without mentioning hot flashes, set hot_flashes_today.count to 0 as an ai_assistant inference with reasoning.
- Symptoms may be explicit or clinically implied; implied ones are ai_assistant inferences with reasoning and lower confidence.
- Hot flashes and night sweats are distinct symptoms: never infer hot flashes from sweating, and keep the symptoms block consistent with hot_flashes_today and night_sweats.
- screen_time_before_bed: answer is boolean; when durations are mentioned, also compute total duration_hours.
- notes.additional_text captures leftover relevant context as a short first-person summary.

Personal information rules:
- Store personal information ONLY when it has medical value. Before writing any item, ask: could a clinician use this to explain, predict or treat her symptoms? If not, leave it out. An empty array is the correct answer for a turn of pure small talk.
- Medically valuable means: age, menopause stage, medications and supplements, diagnoses and past conditions, family medical history, allergies, surgeries, cycle details, diet, alcohol/caffeine/smoking habits, exercise, sleep habits, and recurring stressors or lifestyle patterns that plausibly link to symptoms. Capture these even when mentioned in passing. Also keep the few identity facts needed to make sense of them (name, occupation or living situation when they shape her health).
- Never store trivia or medically inconsequential chatter (favourite film, the weather, a nice meal out with no dietary detail), and never store vague statements that carry no usable meaning ("had a busy day", "things were fine"). Vagueness is not a reason to guess — drop it.
- likes / dislikes: only preferences and aversions with plausible health relevance (foods, drinks, substances, exercise, symptom triggers, environments she avoids). Ordinary tastes with no medical bearing do not belong here.
- other_details: the remaining medically valuable facts that are not preferences.
- Record facts as they were said, without diagnosing or giving medical advice. If a medical detail is only implied, keep it as an ai_assistant inference with reasoning and lower confidence.
- Keep each description short, specific and self-contained; prefer concrete detail ("2 glasses of wine most evenings") over a general impression ("drinks sometimes").
- summary: a 2-4 sentence third-person clinical portrait, re-evaluated every turn. Lead with what matters medically — age and menopause stage, diagnoses, medications, recurring health and lifestyle patterns — and include everyday life only where it plausibly bears on her health. Fold in newly learned medically relevant facts, keep still-valid older ones, and remove anything the user corrected. Write it in warm, plain third person. Leave it null while nothing of medical value is known.`;

/**
 * The model emits metadata.reasoning as nullable; normalize each metadata to a
 * plain object with only present keys ({} for direct user input).
 */
export function finalize(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => finalize(item));
  }
  if (value && typeof value === "object") {
    const obj: Record<string, unknown> = { ...(value as Record<string, unknown>) };
    if ("provider" in obj && "metadata" in obj) {
      const raw = obj.metadata as { reasoning?: string | null } | null;
      const clean: Record<string, string> = {};
      if (raw?.reasoning) clean.reasoning = raw.reasoning;
      obj.metadata = clean;
    }
    for (const key of Object.keys(obj)) {
      if (key !== "metadata") obj[key] = finalize(obj[key]);
    }
    return obj;
  }
  return value;
}
