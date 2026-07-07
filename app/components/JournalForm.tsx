"use client";

import { useEffect, useState } from "react";
import type {
  Attribution,
  JournalExtraction,
  SweatEpisode,
  SymptomKey,
} from "../lib/journal-extraction";

const MOODS = [
  { key: "calm", emoji: "😌", label: "Calm" },
  { key: "energized", emoji: "⚡", label: "Energized" },
  { key: "depressed", emoji: "😔", label: "Depressed" },
  { key: "irritable", emoji: "😠", label: "Irritable" },
  { key: "anxious", emoji: "😰", label: "Anxious" },
  { key: "neutral", emoji: "😐", label: "Neutral" },
] as const;

const SYMPTOMS = [
  "Hot flashes",
  "Night sweats",
  "Fatigue",
  "Headache",
  "Joint pain",
  "Brain fog",
  "Mood swings",
  "Insomnia",
] as const;

const WAKE_UP_OPTIONS = ["0", "1", "2", "3", "4+"] as const;
const NOTES_MAX = 500;

/** API symptom keys → form chip labels */
const SYMPTOM_LABELS: Record<SymptomKey, (typeof SYMPTOMS)[number]> = {
  hot_flashes: "Hot flashes",
  night_sweats: "Night sweats",
  fatigue: "Fatigue",
  headache: "Headache",
  joint_pain: "Joint pain",
  brain_fog: "Brain fog",
  mood_swings: "Mood swings",
  insomnia: "Insomnia",
};

type YesNo = "yes" | "no" | null;

export interface JournalEntry {
  sleepHours: number;
  sleepQuality: number;
  wakeUps: string | null;
  mood: string | null;
  moodIntensity: number;
  stressLevel: number;
  symptoms: string[];
  hotFlashCount: number | null;
  caffeineAfter2pm: YesNo;
  screenTimeBeforeBed: YesNo;
  eveningAlcohol: YesNo;
  notes: string;
  status: "draft" | "submitted";
}

function SectionCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border-2 border-violet-200 bg-white p-6">
      <h2 className="mb-4 text-xs font-bold uppercase tracking-wider text-violet-700">
        {title}
      </h2>
      {children}
    </section>
  );
}

function PurpleSlider({
  min,
  max,
  value,
  onChange,
  minLabel,
  maxLabel,
}: {
  min: number;
  max: number;
  value: number;
  onChange: (v: number) => void;
  minLabel: string;
  maxLabel: string;
}) {
  return (
    <div>
      <div className="flex items-center gap-3">
        <span className="text-sm text-zinc-500">{min}</span>
        <input
          type="range"
          min={min}
          max={max}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="range-purple flex-1"
          style={{
            ["--fill" as string]: `${((value - min) / (max - min)) * 100}%`,
          }}
        />
        <span className="text-sm text-zinc-500">{max}</span>
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-violet-100 text-sm font-bold text-violet-700">
          {value}
        </span>
      </div>
      <div className="mt-1 flex justify-between pr-14 text-xs text-zinc-500">
        <span>{minLabel}</span>
        <span>{maxLabel}</span>
      </div>
    </div>
  );
}

function ProviderBadge({ item }: { item: Attribution }) {
  return item.provider === "ai_assistant" ? (
    <span className="shrink-0 rounded-full bg-amber-100 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-700">
      AI · {Math.round(item.confidence * 100)}%
    </span>
  ) : (
    <span className="shrink-0 rounded-full bg-emerald-100 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-700">
      You said
    </span>
  );
}

/** Extended area under a section card for extra details from the voice entry */
function VoiceExtension({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mt-5 rounded-xl border border-dashed border-violet-300 bg-violet-50/60 p-4">
      <p className="mb-3 text-xs font-bold uppercase tracking-wider text-violet-700">
        🎙 {title}
      </p>
      <div className="flex flex-col gap-2">{children}</div>
    </div>
  );
}

function ExtensionItem({
  item,
  children,
}: {
  item: Attribution;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg bg-white p-3 ring-1 ring-violet-100">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm text-zinc-800">{children}</p>
        <ProviderBadge item={item} />
      </div>
      {item.metadata.reasoning && (
        <p className="mt-1 text-xs leading-5 text-zinc-500">
          {item.metadata.reasoning}
        </p>
      )}
    </div>
  );
}

function YesNoToggle({
  value,
  onChange,
}: {
  value: YesNo;
  onChange: (v: YesNo) => void;
}) {
  const base =
    "rounded-full px-5 py-2 text-sm font-medium transition-colors cursor-pointer";
  return (
    <div className="flex gap-2">
      <button
        type="button"
        onClick={() => onChange("no")}
        className={`${base} ${
          value === "no"
            ? "bg-violet-700 text-white"
            : "bg-violet-50 text-zinc-600 hover:bg-violet-100"
        }`}
      >
        No
      </button>
      <button
        type="button"
        onClick={() => onChange("yes")}
        className={`${base} ${
          value === "yes"
            ? "bg-violet-700 text-white"
            : "bg-violet-100 text-zinc-600 hover:bg-violet-200"
        }`}
      >
        Yes
      </button>
    </div>
  );
}

export default function JournalForm({
  extraction,
}: {
  extraction?: JournalExtraction | null;
}) {
  const [sleepHours, setSleepHours] = useState(6.5);
  const [sleepQuality, setSleepQuality] = useState(6);
  const [wakeUps, setWakeUps] = useState<string | null>(null);
  const [mood, setMood] = useState<string | null>(null);
  const [moodIntensity, setMoodIntensity] = useState(3);
  const [stressLevel, setStressLevel] = useState(3);
  const [symptoms, setSymptoms] = useState<string[]>([]);
  const [hotFlashChoice, setHotFlashChoice] = useState<number | "custom" | null>(
    null
  );
  const [customHotFlashes, setCustomHotFlashes] = useState("");
  const [caffeineAfter2pm, setCaffeineAfter2pm] = useState<YesNo>(null);
  const [screenTimeBeforeBed, setScreenTimeBeforeBed] = useState<YesNo>(null);
  const [eveningAlcohol, setEveningAlcohol] = useState<YesNo>(null);
  const [notes, setNotes] = useState("");
  const [savedAs, setSavedAs] = useState<"draft" | "submitted" | null>(null);

  // Inject the voice extraction: only fields the API returned overwrite state;
  // null / missing values leave the form's defaults in place.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (!extraction) return;

    const sleep = extraction.sleep_information.primary_episode;
    if (sleep) {
      if (sleep.sleep_hours != null) setSleepHours(sleep.sleep_hours);
      if (sleep.sleep_quality != null) setSleepQuality(sleep.sleep_quality);
      if (sleep.awakening_count != null) {
        setWakeUps(
          sleep.awakening_count >= 4 ? "4+" : String(sleep.awakening_count)
        );
      }
    }

    const primaryMood = extraction.mood_information.primary_mood;
    if (primaryMood) {
      setMood(primaryMood.emotion.toLowerCase());
      if (primaryMood.emotion_strength != null) {
        setMoodIntensity(primaryMood.emotion_strength);
      }
      if (primaryMood.stress_level != null) {
        setStressLevel(primaryMood.stress_level);
      }
    }

    const detected = (Object.keys(extraction.symptoms) as SymptomKey[])
      .map((key) => SYMPTOM_LABELS[key])
      .filter(Boolean);
    if (detected.length > 0) setSymptoms(detected);

    const hotFlashes = extraction.hot_flashes_today;
    if (hotFlashes && hotFlashes.count != null) {
      if (hotFlashes.count <= 4) {
        setHotFlashChoice(hotFlashes.count);
        setCustomHotFlashes("");
      } else {
        setHotFlashChoice("custom");
        setCustomHotFlashes(String(hotFlashes.count));
      }
    }

    const routine = extraction.evening_routine;
    if (routine.coffee_after_2pm) {
      setCaffeineAfter2pm(routine.coffee_after_2pm.answer ? "yes" : "no");
    }
    if (routine.screen_time_before_bed) {
      setScreenTimeBeforeBed(
        routine.screen_time_before_bed.answer ? "yes" : "no"
      );
    }
    if (routine.evening_alcohol) {
      setEveningAlcohol(routine.evening_alcohol.answer ? "yes" : "no");
    }

    if (extraction.notes) {
      setNotes(extraction.notes.additional_text.slice(0, NOTES_MAX));
    }
  }, [extraction]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const toggleSymptom = (symptom: string) =>
    setSymptoms((prev) =>
      prev.includes(symptom)
        ? prev.filter((s) => s !== symptom)
        : [...prev, symptom]
    );

  const hotFlashCount =
    hotFlashChoice === "custom"
      ? customHotFlashes === ""
        ? null
        : Number(customHotFlashes)
      : hotFlashChoice;

  const buildEntry = (status: "draft" | "submitted"): JournalEntry => ({
    sleepHours,
    sleepQuality,
    wakeUps,
    mood,
    moodIntensity,
    stressLevel,
    symptoms,
    hotFlashCount,
    caffeineAfter2pm,
    screenTimeBeforeBed,
    eveningAlcohol,
    notes,
    status,
  });

  const handleSave = (status: "draft" | "submitted") => {
    const entry = buildEntry(status);
    // TODO: replace with API call to persist the entry
    console.log("Journal entry", entry);
    setSavedAs(status);
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        handleSave("submitted");
      }}
      className="grid grid-cols-1 gap-6 lg:grid-cols-2"
    >
      {/* Left column */}
      <div className="flex flex-col gap-6">
        <SectionCard title="Sleep">
          <p className="mb-3 font-semibold text-zinc-800">
            How many hours did you sleep?
          </p>
          <div className="flex items-center gap-5">
            <button
              type="button"
              aria-label="Decrease sleep hours"
              onClick={() => setSleepHours((h) => Math.max(0, h - 0.5))}
              className="flex h-10 w-10 items-center justify-center rounded-full border border-violet-200 text-lg text-violet-700 transition-colors hover:bg-violet-50 cursor-pointer"
            >
              −
            </button>
            <span className="min-w-16 text-center text-3xl font-bold text-violet-800">
              {sleepHours}
            </span>
            <button
              type="button"
              aria-label="Increase sleep hours"
              onClick={() => setSleepHours((h) => Math.min(24, h + 0.5))}
              className="flex h-10 w-10 items-center justify-center rounded-full border border-violet-200 text-lg text-violet-700 transition-colors hover:bg-violet-50 cursor-pointer"
            >
              +
            </button>
          </div>

          <hr className="my-5 border-violet-100" />

          <p className="mb-3 font-semibold text-zinc-800">Sleep quality</p>
          <PurpleSlider
            min={1}
            max={10}
            value={sleepQuality}
            onChange={setSleepQuality}
            minLabel="Poor"
            maxLabel="Excellent"
          />

          <p className="mb-3 mt-6 font-semibold text-zinc-800">
            How many times did you wake up?
          </p>
          <div className="flex gap-3">
            {WAKE_UP_OPTIONS.map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setWakeUps(option)}
                className={`h-10 w-11 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
                  wakeUps === option
                    ? "bg-violet-700 text-white"
                    : "bg-violet-50 text-zinc-600 hover:bg-violet-100"
                }`}
              >
                {option}
              </button>
            ))}
          </div>

          {extraction &&
            extraction.sleep_information.additional_episodes.length > 0 && (
              <VoiceExtension title="Additional sleep details">
                {extraction.sleep_information.additional_episodes.map(
                  (episode, i) => (
                    <ExtensionItem key={i} item={episode}>
                      {episode.description}
                      {episode.estimated_duration_lost != null && (
                        <span className="font-semibold text-violet-700">
                          {" "}
                          (~{episode.estimated_duration_lost}h sleep lost)
                        </span>
                      )}
                    </ExtensionItem>
                  )
                )}
              </VoiceExtension>
            )}
        </SectionCard>

        <SectionCard title="Mood">
          <p className="mb-3 font-semibold text-zinc-800">
            How was your mood today?
          </p>
          <div className="flex flex-wrap gap-3">
            {MOODS.map((m) => (
              <button
                key={m.key}
                type="button"
                onClick={() => setMood(m.key)}
                className={`flex w-[72px] flex-col items-center gap-2 rounded-xl border py-3 transition-colors cursor-pointer ${
                  mood === m.key
                    ? "border-violet-600 bg-violet-50"
                    : "border-violet-100 bg-white hover:border-violet-300"
                }`}
              >
                <span className="text-2xl">{m.emoji}</span>
                <span className="text-xs text-zinc-500">{m.label}</span>
              </button>
            ))}
          </div>

          <p className="mb-3 mt-6 font-semibold text-zinc-800">
            How strong is this feeling?
          </p>
          <PurpleSlider
            min={1}
            max={5}
            value={moodIntensity}
            onChange={setMoodIntensity}
            minLabel="barely noticeable"
            maxLabel="overwhelming"
          />

          <p className="mb-3 mt-6 font-semibold text-zinc-800">
            How stressed did you feel today?
          </p>
          <PurpleSlider
            min={1}
            max={5}
            value={stressLevel}
            onChange={setStressLevel}
            minLabel="not at all"
            maxLabel="very stressed"
          />

          {extraction &&
            extraction.mood_information.additional_moods.length > 0 && (
              <VoiceExtension title="Other feelings detected">
                {extraction.mood_information.additional_moods.map((m, i) => (
                  <ExtensionItem key={i} item={m}>
                    <span className="font-semibold">{m.emotion}</span>
                    {m.emotion_strength != null &&
                      ` — strength ${m.emotion_strength}/5`}
                  </ExtensionItem>
                ))}
              </VoiceExtension>
            )}
        </SectionCard>
      </div>

      {/* Right column */}
      <div className="flex flex-col gap-6">
        <SectionCard title="Symptoms">
          <p className="mb-3 font-semibold text-zinc-800">Any symptoms today?</p>
          <div className="flex flex-wrap gap-3">
            {SYMPTOMS.map((symptom) => (
              <button
                key={symptom}
                type="button"
                onClick={() => toggleSymptom(symptom)}
                className={`rounded-full px-4 py-2 text-sm transition-colors cursor-pointer ${
                  symptoms.includes(symptom)
                    ? "bg-violet-700 text-white"
                    : "bg-violet-50 text-zinc-600 hover:bg-violet-100"
                }`}
              >
                {symptom}
              </button>
            ))}
          </div>

          {extraction &&
            (Object.keys(extraction.symptoms).length > 0 ||
              extraction.night_sweats.during_day.length > 0 ||
              extraction.night_sweats.during_sleep.length > 0) && (
              <VoiceExtension title="Symptom details">
                {(
                  Object.entries(extraction.symptoms) as [
                    SymptomKey,
                    NonNullable<JournalExtraction["symptoms"][SymptomKey]>
                  ][]
                ).map(([key, entry]) => (
                  <ExtensionItem key={key} item={entry}>
                    <span className="font-semibold">{SYMPTOM_LABELS[key]}</span>
                    {" — "}
                    {entry.severity}
                  </ExtensionItem>
                ))}
                {(
                  [
                    ["Sweats during the day", extraction.night_sweats.during_day],
                    ["Sweats during sleep", extraction.night_sweats.during_sleep],
                  ] as [string, SweatEpisode[]][]
                ).flatMap(([label, episodes]) =>
                  episodes.map((episode, i) => (
                    <ExtensionItem key={`${label}-${i}`} item={episode}>
                      <span className="font-semibold">{label}</span>
                      {" — "}
                      {episode.severity},{" "}
                      {episode.episodes != null
                        ? `${episode.episodes} episode${
                            episode.episodes === 1 ? "" : "s"
                          }`
                        : "count unknown"}
                    </ExtensionItem>
                  ))
                )}
              </VoiceExtension>
            )}
        </SectionCard>

        <SectionCard title="Hot Flashes Today">
          <p className="mb-3 font-semibold text-zinc-800">
            How many hot flashes did you have today?
          </p>
          <div className="flex gap-3">
            {[0, 1, 2, 3, 4].map((count) => (
              <button
                key={count}
                type="button"
                onClick={() => setHotFlashChoice(count)}
                className={`h-10 w-11 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
                  hotFlashChoice === count
                    ? "bg-violet-700 text-white"
                    : "bg-violet-50 text-zinc-600 hover:bg-violet-100"
                }`}
              >
                {count}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setHotFlashChoice("custom")}
              className={`h-10 w-11 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
                hotFlashChoice === "custom"
                  ? "bg-violet-700 text-white"
                  : "bg-violet-50 text-zinc-600 hover:bg-violet-100"
              }`}
            >
              +
            </button>
          </div>
          {hotFlashChoice === "custom" && (
            <div className="mt-4 flex gap-3">
              <input
                type="number"
                min={0}
                value={customHotFlashes}
                onChange={(e) => setCustomHotFlashes(e.target.value)}
                placeholder="Enter Number"
                className="flex-1 rounded-lg border border-violet-200 px-4 py-2 text-sm text-zinc-800 outline-none placeholder:text-zinc-400 focus:border-violet-500"
              />
              <button
                type="button"
                disabled={customHotFlashes === ""}
                onClick={() => setCustomHotFlashes(customHotFlashes.trim())}
                className="rounded-lg bg-violet-300 px-8 py-2 text-sm font-semibold text-white transition-colors enabled:bg-violet-700 enabled:hover:bg-violet-800 enabled:cursor-pointer"
              >
                Done
              </button>
            </div>
          )}

          {extraction?.hot_flashes_today &&
            extraction.hot_flashes_today.provider === "ai_assistant" && (
              <VoiceExtension title="From your voice entry">
                <ExtensionItem item={extraction.hot_flashes_today}>
                  {extraction.hot_flashes_today.count != null
                    ? `Set to ${extraction.hot_flashes_today.count}`
                    : "Could not determine a count"}
                </ExtensionItem>
              </VoiceExtension>
            )}
        </SectionCard>

        <SectionCard title="Evening Routine">
          <div className="divide-y divide-violet-100">
            {(
              [
                ["Caffeine after 2 PM", caffeineAfter2pm, setCaffeineAfter2pm],
                [
                  "Screen time before bed",
                  screenTimeBeforeBed,
                  setScreenTimeBeforeBed,
                ],
                ["Evening alcohol", eveningAlcohol, setEveningAlcohol],
              ] as const
            ).map(([label, value, setter]) => (
              <div
                key={label}
                className="flex items-center justify-between py-4 first:pt-0 last:pb-0"
              >
                <span className="text-zinc-800">{label}</span>
                <YesNoToggle value={value} onChange={setter} />
              </div>
            ))}
          </div>

          {extraction &&
            (() => {
              const routineItems = (
                [
                  ["Caffeine after 2 PM", extraction.evening_routine.coffee_after_2pm],
                  [
                    "Screen time before bed",
                    extraction.evening_routine.screen_time_before_bed,
                  ],
                  ["Evening alcohol", extraction.evening_routine.evening_alcohol],
                ] as const
              ).filter(
                ([, entry]) =>
                  entry &&
                  (entry.provider === "ai_assistant" ||
                    ("duration_hours" in entry && entry.duration_hours != null))
              );
              if (routineItems.length === 0) return null;
              return (
                <VoiceExtension title="From your voice entry">
                  {routineItems.map(([label, entry]) => (
                    <ExtensionItem key={label} item={entry!}>
                      <span className="font-semibold">{label}</span>
                      {" — "}
                      {entry!.answer ? "yes" : "no"}
                      {"duration_hours" in entry! &&
                        entry!.duration_hours != null &&
                        ` (~${entry!.duration_hours}h)`}
                    </ExtensionItem>
                  ))}
                </VoiceExtension>
              );
            })()}
        </SectionCard>
      </div>

      {/* Full-width notes */}
      <div className="lg:col-span-2">
        <SectionCard title="Notes">
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value.slice(0, NOTES_MAX))}
            placeholder="Anything else about today? (optional)"
            rows={4}
            className="w-full resize-none rounded-xl border border-violet-200 px-4 py-3 text-sm text-zinc-800 outline-none placeholder:text-zinc-400 focus:border-violet-500"
          />
          <p className="mt-2 text-right text-xs text-violet-400">
            {notes.length}/{NOTES_MAX}
          </p>

          {extraction?.notes && (
            <VoiceExtension title="From your voice entry">
              <ExtensionItem item={extraction.notes}>
                This note was drafted from what you shared — feel free to edit
                it above.
              </ExtensionItem>
            </VoiceExtension>
          )}
        </SectionCard>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-end gap-4 lg:col-span-2">
        {savedAs && (
          <span className="text-sm font-medium text-violet-700">
            {savedAs === "draft" ? "Draft saved ✓" : "Entry submitted ✓"}
          </span>
        )}
        <button
          type="button"
          onClick={() => handleSave("draft")}
          className="rounded-xl border border-zinc-200 bg-white px-6 py-3 text-sm font-semibold text-zinc-700 transition-colors hover:bg-zinc-50 cursor-pointer"
        >
          Save as Draft
        </button>
        <button
          type="submit"
          className="rounded-xl bg-violet-700 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-violet-800 cursor-pointer"
        >
          Submit Entry
        </button>
      </div>
    </form>
  );
}
