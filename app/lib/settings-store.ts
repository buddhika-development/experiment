"use client";

import {
  DEFAULT_SETTINGS,
  normalizeSettings,
  type ModelSettings,
} from "./model-settings";

/**
 * The user's chosen LLM service, kept in localStorage so it survives reloads.
 * Unlike the voice session this never expires — it is a preference, not state.
 * The value is sent with each chat request; the server re-validates it.
 */

const STORAGE_KEY = "healplace.model-settings.v1";

/** Fired on save so open tabs/components re-read without a reload. */
export const SETTINGS_CHANGED_EVENT = "healplace:model-settings-changed";

export function loadSettings(): ModelSettings {
  if (typeof window === "undefined") return DEFAULT_SETTINGS;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    return normalizeSettings(JSON.parse(raw));
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveSettings(settings: ModelSettings): ModelSettings {
  const clean = normalizeSettings(settings);
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(clean));
    window.dispatchEvent(new Event(SETTINGS_CHANGED_EVENT));
  } catch {
    // Storage full or unavailable — the chat still works on the default model.
  }
  return clean;
}
