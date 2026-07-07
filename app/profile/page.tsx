"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import NavBar from "../components/NavBar";
import type {
  Attribution,
  JournalExtraction,
  PersonalItem,
  SymptomKey,
} from "../lib/journal-extraction";
import { clearSession, loadSession, type SessionState } from "../lib/session-store";

const SYMPTOM_LABELS: Record<SymptomKey, string> = {
  hot_flashes: "Hot flashes",
  night_sweats: "Night sweats",
  fatigue: "Fatigue",
  headache: "Headache",
  joint_pain: "Joint pain",
  brain_fog: "Brain fog",
  mood_swings: "Mood swings",
  insomnia: "Insomnia",
};

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

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border-2 border-violet-200 bg-white p-6">
      <h2 className="mb-4 text-xs font-bold uppercase tracking-wider text-violet-700">
        {title}
      </h2>
      {children}
    </section>
  );
}

function PersonalList({
  items,
  emptyText,
}: {
  items: PersonalItem[];
  emptyText: string;
}) {
  if (items.length === 0) {
    return <p className="text-sm text-zinc-400">{emptyText}</p>;
  }
  return (
    <ul className="flex flex-col gap-2">
      {items.map((item, i) => (
        <li
          key={i}
          className="flex items-start justify-between gap-3 rounded-lg bg-violet-50/60 p-3 ring-1 ring-violet-100"
        >
          <div>
            <p className="text-sm text-zinc-800">{item.description}</p>
            {item.metadata.reasoning && (
              <p className="mt-1 text-xs leading-5 text-zinc-500">
                {item.metadata.reasoning}
              </p>
            )}
          </div>
          <ProviderBadge item={item} />
        </li>
      ))}
    </ul>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-2">
      <span className="text-sm text-zinc-500">{label}</span>
      <span className="text-right text-sm font-semibold text-zinc-800">{value}</span>
    </div>
  );
}

function journalFacts(journal: JournalExtraction): [string, string][] {
  const facts: [string, string][] = [];

  const sleep = journal.sleep_information.primary_episode;
  if (sleep) {
    if (sleep.sleep_hours != null) facts.push(["Sleep hours", `${sleep.sleep_hours}h`]);
    if (sleep.sleep_quality != null)
      facts.push(["Sleep quality", `${sleep.sleep_quality}/10`]);
    if (sleep.awakening_count != null)
      facts.push(["Woke up", `${sleep.awakening_count} time(s)`]);
  }

  const mood = journal.mood_information.primary_mood;
  if (mood) {
    facts.push([
      "Mood",
      mood.emotion +
        (mood.emotion_strength != null ? ` (${mood.emotion_strength}/5)` : ""),
    ]);
    if (mood.stress_level != null)
      facts.push(["Stress level", `${mood.stress_level}/5`]);
  }

  const symptoms = (Object.keys(journal.symptoms) as SymptomKey[]).map(
    (key) => SYMPTOM_LABELS[key]
  );
  if (symptoms.length > 0) facts.push(["Symptoms", symptoms.join(", ")]);

  if (journal.hot_flashes_today?.count != null)
    facts.push(["Hot flashes today", String(journal.hot_flashes_today.count)]);

  const routine = journal.evening_routine;
  if (routine.coffee_after_2pm)
    facts.push(["Caffeine after 2 PM", routine.coffee_after_2pm.answer ? "Yes" : "No"]);
  if (routine.screen_time_before_bed)
    facts.push([
      "Screen time before bed",
      (routine.screen_time_before_bed.answer ? "Yes" : "No") +
        (routine.screen_time_before_bed.duration_hours != null
          ? ` (~${routine.screen_time_before_bed.duration_hours}h)`
          : ""),
    ]);
  if (routine.evening_alcohol)
    facts.push(["Evening alcohol", routine.evening_alcohol.answer ? "Yes" : "No"]);

  return facts;
}

function formatRemaining(expiresAt: number): string {
  const remaining = Math.max(0, expiresAt - Date.now());
  const minutes = Math.ceil(remaining / 60000);
  return minutes >= 60 ? "about 1 hour" : `${minutes} min`;
}

export default function ProfilePage() {
  const [session, setSession] = useState<SessionState | null>(null);
  const [hydrated, setHydrated] = useState(false);

  const refresh = useCallback(() => {
    setSession(loadSession());
    setHydrated(true);
  }, []);

  useEffect(() => {
    // localStorage is only readable after hydration, so this must be an effect.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refresh();
    // Re-check periodically so an expired session disappears without a reload.
    const timer = setInterval(refresh, 30_000);
    return () => clearInterval(timer);
  }, [refresh]);

  const handleClear = () => {
    clearSession();
    setSession(null);
  };

  const personal = session?.extraction?.personal_information;
  const journal = session?.extraction?.journal_information;
  const facts = journal ? journalFacts(journal) : [];

  return (
    <div className="min-h-screen bg-white font-sans">
      <NavBar />
      <main className="mx-auto max-w-4xl px-8 py-10">
        <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-zinc-900">My Information</h1>
            <p className="mt-1 text-sm text-zinc-500">
              What we&apos;ve learned from your voice chat — stored only on this
              device and cleared automatically after 1 hour.
            </p>
          </div>
          {session && (
            <button
              type="button"
              onClick={handleClear}
              className="rounded-full border border-red-200 bg-red-50 px-5 py-2 text-sm font-semibold text-red-700 transition-colors hover:bg-red-100 cursor-pointer"
            >
              Clear session data
            </button>
          )}
        </div>

        {hydrated && !session && (
          <div className="rounded-2xl border-2 border-dashed border-violet-200 bg-violet-50/40 p-10 text-center">
            <p className="mb-2 text-lg font-semibold text-zinc-800">
              Nothing stored yet
            </p>
            <p className="mb-6 text-sm text-zinc-500">
              Your session is empty or has expired. Have a chat about your day
              and your information will appear here.
            </p>
            <Link
              href="/"
              className="inline-block rounded-full bg-violet-700 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-violet-800"
            >
              Start a voice chat
            </Link>
          </div>
        )}

        {session && (
          <div className="flex flex-col gap-6">
            <p className="text-xs text-zinc-400">
              Last updated {new Date(session.updatedAt).toLocaleTimeString()} ·
              expires in {formatRemaining(session.expiresAt)} ·{" "}
              {session.conversation.length} message
              {session.conversation.length === 1 ? "" : "s"} in the conversation
            </p>

            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              <Card title="Likes 💜">
                <PersonalList
                  items={personal?.likes ?? []}
                  emptyText="No likes captured yet."
                />
              </Card>
              <Card title="Dislikes 👎">
                <PersonalList
                  items={personal?.dislikes ?? []}
                  emptyText="No dislikes captured yet."
                />
              </Card>
            </div>

            <Card title="Other personal details">
              <PersonalList
                items={personal?.other_details ?? []}
                emptyText="No other personal details captured yet."
              />
            </Card>

            <Card title="Today's journal snapshot">
              {facts.length > 0 ? (
                <>
                  <div className="divide-y divide-violet-100">
                    {facts.map(([label, value]) => (
                      <Fact key={label} label={label} value={value} />
                    ))}
                  </div>
                  {journal?.notes && (
                    <p className="mt-4 rounded-lg bg-violet-50/60 p-3 text-sm leading-6 text-zinc-700 ring-1 ring-violet-100">
                      “{journal.notes.additional_text}”
                    </p>
                  )}
                  <Link
                    href="/journal"
                    className="mt-5 inline-block text-sm font-semibold text-violet-700 underline underline-offset-2 hover:text-violet-900"
                  >
                    Open the journal form →
                  </Link>
                </>
              ) : (
                <p className="text-sm text-zinc-400">
                  No journal information captured yet.
                </p>
              )}
            </Card>
          </div>
        )}
      </main>
    </div>
  );
}
