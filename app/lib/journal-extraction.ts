/**
 * Client-safe types mirroring the response of POST /api/voice-chat
 * (see app/api/voice-chat/route.ts and app/lib/extraction-schema.ts).
 */

export type Provider = "user" | "ai_assistant";

export interface Attribution {
  provider: Provider;
  confidence: number;
  metadata: {
    reasoning?: string;
    reference_statement_uuid?: string;
  };
}

export type Severity = "mild" | "moderate" | "severe";

export interface PrimarySleepEpisode extends Attribution {
  sleep_hours: number | null;
  sleep_quality: number | null;
  awakening_count: number | null;
}

export interface AdditionalSleepEpisode extends Attribution {
  description: string;
  estimated_duration_lost: number | null;
}

export interface SymptomEntry extends Attribution {
  severity: Severity;
}

export type SymptomKey =
  | "hot_flashes"
  | "night_sweats"
  | "fatigue"
  | "headache"
  | "joint_pain"
  | "brain_fog"
  | "mood_swings"
  | "insomnia";

export interface HotFlashesToday extends Attribution {
  count: number | null;
}

export interface SweatEpisode extends Attribution {
  severity: Severity;
  episodes: number | null;
}

export type MoodEmotion =
  | "Calm"
  | "Energized"
  | "Depressed"
  | "Irritable"
  | "Anxious"
  | "Neutral";

export interface PrimaryMood extends Attribution {
  emotion: MoodEmotion;
  emotion_strength: number | null;
  stress_level: number | null;
}

export interface AdditionalMood extends Attribution {
  emotion: MoodEmotion;
  emotion_strength: number | null;
}

export interface YesNoAnswer extends Attribution {
  answer: boolean;
}

export interface ScreenTimeAnswer extends Attribution {
  answer: boolean;
  duration_hours: number | null;
}

export interface NotesEntry extends Attribution {
  additional_text: string;
}

export interface JournalExtraction {
  sleep_information: {
    primary_episode: PrimarySleepEpisode | null;
    additional_episodes: AdditionalSleepEpisode[];
  };
  symptoms: Partial<Record<SymptomKey, SymptomEntry>>;
  hot_flashes_today: HotFlashesToday | null;
  night_sweats: {
    during_day: SweatEpisode[];
    during_sleep: SweatEpisode[];
  };
  mood_information: {
    primary_mood: PrimaryMood | null;
    additional_moods: AdditionalMood[];
  };
  evening_routine: {
    coffee_after_2pm: YesNoAnswer | null;
    screen_time_before_bed: ScreenTimeAnswer | null;
    evening_alcohol: YesNoAnswer | null;
  };
  notes: NotesEntry | null;
}

/* ---------- Personal space (likes / dislikes / other facts) ---------- */

export interface PersonalItem extends Attribution {
  description: string;
}

export interface PersonalInformation {
  likes: PersonalItem[];
  dislikes: PersonalItem[];
  other_details: PersonalItem[];
}

/** Full extraction state kept in the session store and updated each chat turn. */
export interface SessionExtraction {
  journal_information: JournalExtraction;
  personal_information: PersonalInformation;
}

/* ---------- Chat ---------- */

export type ChatRole = "user" | "assistant";

export interface ChatMessage {
  role: ChatRole;
  content: string;
  at: number;
}
