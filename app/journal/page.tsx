"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import JournalForm from "../components/JournalForm";
import NavBar from "../components/NavBar";
import type { JournalExtraction } from "../lib/journal-extraction";
import { loadSession } from "../lib/session-store";

export default function JournalPage() {
  const [extraction, setExtraction] = useState<JournalExtraction | null>(null);
  const [hydrated, setHydrated] = useState(false);

  // If the voice chat stored journal info in the session (valid for 1 hour),
  // prefill the form with it; otherwise the form renders with its defaults.
  // localStorage is only readable after hydration, so this must be an effect.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    const session = loadSession();
    if (session?.extraction?.journal_information) {
      setExtraction(session.extraction.journal_information);
    }
    setHydrated(true);
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */

  return (
    <div className="min-h-screen bg-white font-sans">
      <NavBar />
      <main className="mx-auto max-w-6xl px-8 py-10">
        <h1 className="mb-2 text-2xl font-bold text-zinc-900">Daily Journal</h1>

        {hydrated && (
          <p className="mb-8 text-sm text-zinc-500">
            {extraction ? (
              <span className="inline-flex items-center gap-2 rounded-full bg-violet-50 px-4 py-2 font-medium text-violet-700 ring-1 ring-violet-200">
                🎙 Prefilled from your voice chat — review and adjust anything
                before submitting.
              </span>
            ) : (
              <>
                Nothing captured from a voice chat yet — fill the form manually,
                or{" "}
                <Link
                  href="/"
                  className="font-semibold text-violet-700 underline underline-offset-2 hover:text-violet-900"
                >
                  talk about your day first
                </Link>
                .
              </>
            )}
          </p>
        )}

        {hydrated && <JournalForm extraction={extraction} />}
      </main>
    </div>
  );
}
