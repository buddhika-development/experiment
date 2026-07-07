import type { ChatMessage, SessionExtraction } from "./journal-extraction";

/**
 * Temporary session state kept in localStorage for one hour (sliding — the
 * timer restarts on every save). Holds the extraction produced by the voice
 * chat plus the conversation itself, so the journal form and the profile page
 * can read them across pages and reloads.
 */

const STORAGE_KEY = "healplace.voice-session.v1";
const TTL_MS = 60 * 60 * 1000; // 1 hour

export interface SessionState {
  extraction: SessionExtraction | null;
  conversation: ChatMessage[];
  updatedAt: number;
  expiresAt: number;
}

export function loadSession(): SessionState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const state = JSON.parse(raw) as SessionState;
    if (
      typeof state !== "object" ||
      state === null ||
      typeof state.expiresAt !== "number" ||
      !Array.isArray(state.conversation)
    ) {
      window.localStorage.removeItem(STORAGE_KEY);
      return null;
    }
    if (Date.now() > state.expiresAt) {
      window.localStorage.removeItem(STORAGE_KEY);
      return null;
    }
    return state;
  } catch {
    return null;
  }
}

export function saveSession(data: {
  extraction: SessionExtraction | null;
  conversation: ChatMessage[];
}): SessionState {
  const now = Date.now();
  const state: SessionState = {
    extraction: data.extraction,
    conversation: data.conversation,
    updatedAt: now,
    expiresAt: now + TTL_MS,
  };
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Storage full or unavailable — the chat still works, just without persistence.
  }
  return state;
}

export function clearSession(): void {
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}
