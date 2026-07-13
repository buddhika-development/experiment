"use client";

import { useEffect, useState } from "react";
import NavBar from "../components/NavBar";
import {
  DEFAULT_SETTINGS,
  LLM_PROVIDERS,
  PROVIDER_LIST,
  defaultModelFor,
  describeSettings,
  type LlmProviderId,
  type ModelSettings,
} from "../lib/model-settings";
import { loadSettings, saveSettings } from "../lib/settings-store";

/**
 * Lets the user choose which LLM service answers the voice chat (OpenAI or
 * Google Gemini) and which model of that service. The choice lives in
 * localStorage and rides along with every chat request.
 */
export default function SettingsPage() {
  const [settings, setSettings] = useState<ModelSettings>(DEFAULT_SETTINGS);
  const [saved, setSaved] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  // localStorage is only readable after hydration.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    setSettings(loadSettings());
    setHydrated(true);
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */

  const apply = (next: ModelSettings) => {
    setSettings(next);
    saveSettings(next);
    setSaved(true);
  };

  const chooseProvider = (provider: LlmProviderId) => {
    if (provider === settings.provider) return;
    apply({ provider, model: defaultModelFor(provider) });
  };

  const chooseModel = (model: string) => apply({ ...settings, model });

  // Clear the "saved" flash a moment after the last change.
  useEffect(() => {
    if (!saved) return;
    const timer = setTimeout(() => setSaved(false), 2000);
    return () => clearTimeout(timer);
  }, [saved, settings]);

  const activeProvider = LLM_PROVIDERS[settings.provider];

  return (
    <div className="min-h-screen bg-white font-sans">
      <NavBar />
      <main className="mx-auto max-w-4xl px-8 py-10">
        <div className="mb-8 flex items-baseline justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-violet-900">Settings</h1>
            <p className="mt-1 text-sm text-zinc-500">
              Choose which AI service powers your voice chat. The choice is saved
              in this browser and used for every new message.
            </p>
          </div>
          {hydrated && (
            <span
              className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold transition-opacity ${
                saved
                  ? "bg-emerald-100 text-emerald-700 opacity-100"
                  : "bg-emerald-100 text-emerald-700 opacity-0"
              }`}
            >
              Saved
            </span>
          )}
        </div>

        <section className="rounded-2xl border-2 border-violet-200 bg-white p-6">
          <h2 className="mb-4 text-xs font-bold uppercase tracking-wider text-violet-700">
            Service
          </h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {PROVIDER_LIST.map((provider) => {
              const active = provider.id === settings.provider;
              return (
                <button
                  key={provider.id}
                  type="button"
                  onClick={() => chooseProvider(provider.id)}
                  disabled={!hydrated}
                  aria-pressed={active}
                  className={`cursor-pointer rounded-xl border-2 p-4 text-left transition-colors ${
                    active
                      ? "border-violet-600 bg-violet-50"
                      : "border-violet-100 bg-white hover:border-violet-300 hover:bg-violet-50/50"
                  }`}
                >
                  <p className="text-sm font-semibold text-zinc-900">
                    {provider.label}
                  </p>
                  <p className="mt-1 font-mono text-[11px] text-zinc-400">
                    {provider.envKey}
                  </p>
                </button>
              );
            })}
          </div>
        </section>

        <section className="mt-6 rounded-2xl border-2 border-violet-200 bg-white p-6">
          <h2 className="mb-4 text-xs font-bold uppercase tracking-wider text-violet-700">
            {activeProvider.label} model
          </h2>
          <div className="flex flex-col gap-2">
            {activeProvider.models.map((model) => {
              const active = model.id === settings.model;
              return (
                <button
                  key={model.id}
                  type="button"
                  onClick={() => chooseModel(model.id)}
                  disabled={!hydrated}
                  aria-pressed={active}
                  className={`flex cursor-pointer items-center gap-4 rounded-xl border-2 p-4 text-left transition-colors ${
                    active
                      ? "border-violet-600 bg-violet-50"
                      : "border-violet-100 bg-white hover:border-violet-300 hover:bg-violet-50/50"
                  }`}
                >
                  <span
                    className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 ${
                      active ? "border-violet-600" : "border-zinc-300"
                    }`}
                  >
                    {active && (
                      <span className="h-2 w-2 rounded-full bg-violet-600" />
                    )}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold text-zinc-900">
                      {model.label}
                    </span>
                    <span className="block text-xs text-zinc-500">
                      {model.hint}
                    </span>
                  </span>
                  <span className="shrink-0 font-mono text-[11px] text-zinc-400">
                    {model.id}
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        <p className="mt-6 text-center text-sm text-zinc-500">
          Currently using{" "}
          <span className="font-semibold text-violet-800">
            {hydrated ? describeSettings(settings) : "…"}
          </span>
        </p>
      </main>
    </div>
  );
}
