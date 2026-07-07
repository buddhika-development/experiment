"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ChatMessage, SessionExtraction } from "../lib/journal-extraction";
import { loadSession, saveSession } from "../lib/session-store";

const GREETING =
  "Hi! How was your day? How did you sleep, and were there any symptoms or other things that happened during the day or during your sleep? I am here with you, ready to help.";

/** Silence after the last recognized phrase before the utterance is auto-sent. */
const AUTO_SEND_DELAY_MS = 2200;

/* Minimal Web Speech API typings (not included in TS DOM lib) */
type SpeechRecognitionAlternativeLike = {
  transcript: string;
  confidence: number;
};
type SpeechRecognitionResultLike = {
  isFinal: boolean;
  length: number;
  [index: number]: SpeechRecognitionAlternativeLike;
};
type SpeechRecognitionEventLike = {
  resultIndex: number;
  results: {
    length: number;
    [index: number]: SpeechRecognitionResultLike;
  };
};
type SpeechRecognitionErrorEventLike = { error: string };
type SpeechRecognitionInstance = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null;
  onend: (() => void) | null;
};

declare global {
  interface Window {
    SpeechRecognition?: new () => SpeechRecognitionInstance;
    webkitSpeechRecognition?: new () => SpeechRecognitionInstance;
  }
}

/* Prefer a natural-sounding female English voice where available */
const PREFERRED_VOICES = [
  "Google UK English Female",
  "Microsoft Aria",
  "Microsoft Jenny",
  "Microsoft Zira",
  "Samantha",
  "Victoria",
  "Karen",
  "Moira",
  "Tessa",
  "Google US English",
  "female",
];

function pickFemaleVoice(voices: SpeechSynthesisVoice[]) {
  const english = voices.filter((v) => v.lang.toLowerCase().startsWith("en"));
  for (const name of PREFERRED_VOICES) {
    const match = english.find((v) =>
      v.name.toLowerCase().includes(name.toLowerCase())
    );
    if (match) return match;
  }
  return english[0] ?? voices[0] ?? null;
}

function MicIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 2a3 3 0 0 1 3 3v6a3 3 0 0 1-6 0V5a3 3 0 0 1 3-3z" />
      <path d="M19 10v1a7 7 0 0 1-14 0v-1" />
      <line x1="12" y1="18" x2="12" y2="22" />
      <line x1="8" y1="22" x2="16" y2="22" />
    </svg>
  );
}

type VoiceStatus = "idle" | "listening" | "thinking" | "speaking";

const STATUS_TEXT: Record<VoiceStatus, string> = {
  idle: "Tap the mic to start talking",
  listening: "Listening… speak whenever you're ready",
  thinking: "Thinking…",
  speaking: "Speaking…",
};

function VoiceOrb({ status }: { status: VoiceStatus }) {
  return (
    <div className="relative flex h-56 w-56 items-center justify-center">
      {/* Expanding rings while listening */}
      {status === "listening" && (
        <>
          <span className="orb-ring absolute h-44 w-44 rounded-full bg-violet-400/40" />
          <span
            className="orb-ring absolute h-44 w-44 rounded-full bg-violet-400/30"
            style={{ animationDelay: "0.7s" }}
          />
          <span
            className="orb-ring absolute h-44 w-44 rounded-full bg-violet-400/20"
            style={{ animationDelay: "1.4s" }}
          />
        </>
      )}

      {/* Core orb */}
      <div
        className={`relative flex h-44 w-44 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 via-violet-600 to-fuchsia-600 shadow-xl shadow-violet-300 transition-transform duration-500 ${
          status === "listening" || status === "speaking" ? "orb-breathe" : ""
        } ${status === "idle" ? "opacity-90" : ""}`}
      >
        {status === "speaking" ? (
          /* Equalizer bars while the assistant talks */
          <div className="flex h-16 items-center gap-1.5">
            {[0, 1, 2, 3, 4].map((i) => (
              <span
                key={i}
                className="eq-bar w-2 rounded-full bg-white/90"
                style={{ animationDelay: `${i * 0.12}s` }}
              />
            ))}
          </div>
        ) : status === "thinking" ? (
          /* Bouncing dots while waiting for the model */
          <div className="flex items-center gap-2">
            {[0, 1, 2].map((i) => (
              <span
                key={i}
                className="thinking-dot h-3 w-3 rounded-full bg-white/90"
                style={{ animationDelay: `${i * 0.18}s` }}
              />
            ))}
          </div>
        ) : (
          <MicIcon className="h-14 w-14 text-white/95" />
        )}
      </div>
    </div>
  );
}

export default function VoiceChat() {
  const [conversation, setConversation] = useState<ChatMessage[]>([]);
  const [status, setStatus] = useState<VoiceStatus>("idle");
  const [pendingFinal, setPendingFinal] = useState("");
  const [interim, setInterim] = useState("");
  const [typed, setTyped] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [edited, setEdited] = useState(false);

  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const sessionActiveRef = useRef(false); // user pressed start and hasn't stopped
  const listeningRef = useRef(false); // recognition should keep restarting
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingRef = useRef("");
  const editedRef = useRef(false); // user touched the transcript — hold auto-send
  const extractionRef = useRef<SessionExtraction | null>(null);
  const conversationRef = useRef<ChatMessage[]>([]);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  /* ---------- persistence ---------- */

  // Restore a previous session (within its 1-hour window) on mount.
  // localStorage is only readable after hydration, so this must be an effect.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    const saved = loadSession();
    if (saved && saved.conversation.length > 0) {
      conversationRef.current = saved.conversation;
      extractionRef.current = saved.extraction;
      setConversation(saved.conversation);
    } else {
      const greeting: ChatMessage = {
        role: "assistant",
        content: GREETING,
        at: Date.now(),
      };
      conversationRef.current = [greeting];
      setConversation([greeting]);
    }
    setHydrated(true);
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */

  const persist = useCallback(() => {
    saveSession({
      extraction: extractionRef.current,
      conversation: conversationRef.current,
    });
  }, []);

  const appendMessage = useCallback(
    (message: ChatMessage) => {
      conversationRef.current = [...conversationRef.current, message];
      setConversation(conversationRef.current);
      persist();
    },
    [persist]
  );

  // Keep the conversation scrolled to the latest message.
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [conversation, interim, pendingFinal, status]);

  /* ---------- speech synthesis ---------- */

  const speak = useCallback((text: string, onDone?: () => void) => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      onDone?.();
      return;
    }
    const utter = () => {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      const voice = pickFemaleVoice(window.speechSynthesis.getVoices());
      if (voice) utterance.voice = voice;
      utterance.rate = 0.95;
      utterance.pitch = 1.05;
      utterance.onend = () => onDone?.();
      utterance.onerror = () => onDone?.();
      window.speechSynthesis.speak(utterance);
    };
    // Voices load asynchronously in some browsers
    if (window.speechSynthesis.getVoices().length > 0) {
      utter();
    } else {
      window.speechSynthesis.addEventListener("voiceschanged", utter, {
        once: true,
      });
    }
  }, []);

  /* ---------- speech recognition ---------- */

  const clearSilenceTimer = () => {
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
  };

  const stopRecognition = useCallback(() => {
    listeningRef.current = false;
    clearSilenceTimer();
    recognitionRef.current?.stop();
  }, []);

  const sendUtteranceRef = useRef<(text: string) => void>(() => {});

  const startRecognition = useCallback(() => {
    const SpeechRecognitionCtor =
      window.SpeechRecognition ?? window.webkitSpeechRecognition;
    if (!SpeechRecognitionCtor) {
      setError(
        "Voice input is not supported in this browser. Please try Chrome or Edge — you can still type below the conversation."
      );
      setStatus("idle");
      sessionActiveRef.current = false;
      return;
    }

    // Stop the assistant's own voice so the mic doesn't pick it up
    window.speechSynthesis?.cancel();
    setError(null);

    const recognition = new SpeechRecognitionCtor();
    recognition.lang = "en-US";
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.maxAlternatives = 3;

    recognition.onresult = (event) => {
      let interimText = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        // Pick the highest-confidence alternative for accuracy
        let best = result[0];
        for (let j = 1; j < result.length; j++) {
          if (result[j].confidence > best.confidence) best = result[j];
        }
        if (result.isFinal) {
          const text = best.transcript.trim();
          if (text) {
            pendingRef.current = (
              pendingRef.current +
              " " +
              text
            ).trim();
            setPendingFinal(pendingRef.current);
          }
        } else {
          interimText += best.transcript;
        }
      }
      setInterim(interimText);

      // The user is still talking — restart the silence countdown. Once the
      // transcript has been manually edited, auto-send stays off so the edit
      // isn't sent from under the user; they send with the button instead.
      clearSilenceTimer();
      if (pendingRef.current && !editedRef.current) {
        silenceTimerRef.current = setTimeout(() => {
          if (pendingRef.current && !editedRef.current) {
            sendUtteranceRef.current(pendingRef.current);
          }
        }, AUTO_SEND_DELAY_MS);
      }
    };

    recognition.onerror = (event) => {
      if (event.error === "not-allowed" || event.error === "service-not-allowed") {
        setError("Microphone access was denied. Please allow it and try again.");
        listeningRef.current = false;
        sessionActiveRef.current = false;
        setStatus("idle");
      }
      // "no-speech" and "aborted" are harmless — onend handles restart
    };

    recognition.onend = () => {
      setInterim("");
      // Browsers stop recognition after silence — restart while still active
      if (listeningRef.current) {
        try {
          recognition.start();
        } catch {
          listeningRef.current = false;
          setStatus("idle");
        }
      }
    };

    recognitionRef.current = recognition;
    listeningRef.current = true;
    setStatus("listening");
    recognition.start();
  }, []);

  /* ---------- chat turn ---------- */

  const sendMessage = useCallback(
    async (text: string) => {
      const content = text.trim();
      if (!content) return;

      clearSilenceTimer();
      pendingRef.current = "";
      editedRef.current = false;
      setEdited(false);
      setPendingFinal("");
      setInterim("");

      // Pause the mic while we think and speak, so it doesn't hear the reply.
      listeningRef.current = false;
      recognitionRef.current?.stop();
      window.speechSynthesis?.cancel();

      appendMessage({ role: "user", content, at: Date.now() });
      setStatus("thinking");
      setError(null);

      try {
        const res = await fetch("/api/voice-chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: conversationRef.current.map(({ role, content }) => ({
              role,
              content,
            })),
            current_extraction: extractionRef.current,
          }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => null);
          throw new Error(
            (data as { error?: string } | null)?.error ??
              "Could not process your message. Please try again."
          );
        }
        const data = (await res.json()) as {
          reply: string;
          extraction: SessionExtraction;
        };

        extractionRef.current = data.extraction;
        appendMessage({ role: "assistant", content: data.reply, at: Date.now() });

        if (sessionActiveRef.current) {
          setStatus("speaking");
          speak(data.reply, () => {
            if (sessionActiveRef.current) {
              startRecognition();
            } else {
              setStatus("idle");
            }
          });
        } else {
          setStatus("idle");
        }
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Could not process your message. Please try again."
        );
        // Resume listening so the user can simply say it again.
        if (sessionActiveRef.current) {
          startRecognition();
        } else {
          setStatus("idle");
        }
      }
    },
    [appendMessage, speak, startRecognition]
  );

  useEffect(() => {
    sendUtteranceRef.current = sendMessage;
  }, [sendMessage]);

  /* ---------- controls ---------- */

  const handleStart = () => {
    sessionActiveRef.current = true;
    setError(null);
    // Greet aloud on a fresh conversation, then open the mic.
    if (conversationRef.current.length <= 1) {
      setStatus("speaking");
      speak(GREETING, () => {
        if (sessionActiveRef.current) startRecognition();
      });
    } else {
      startRecognition();
    }
  };

  const handleStop = () => {
    sessionActiveRef.current = false;
    stopRecognition();
    window.speechSynthesis?.cancel();
    // Anything already captured still gets sent so it isn't lost.
    if (pendingRef.current.trim()) {
      sendMessage(pendingRef.current);
    } else {
      setStatus("idle");
    }
  };

  const handleTypedSend = (e: React.FormEvent) => {
    e.preventDefault();
    const text = (pendingRef.current + " " + typed).trim();
    if (!text || status === "thinking") return;
    setTyped("");
    sendMessage(text);
  };

  // Cleanup if unmounted while active
  useEffect(() => {
    return () => {
      sessionActiveRef.current = false;
      listeningRef.current = false;
      clearSilenceTimer();
      recognitionRef.current?.abort();
      window.speechSynthesis?.cancel();
    };
  }, []);

  const active = status === "listening" || status === "speaking" || status === "thinking";
  const liveText = (pendingFinal + " " + interim).trim();

  return (
    <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
      {/* Left — voice orb, animations and voice input */}
      <section className="flex flex-1 flex-col items-center justify-center gap-6 px-8 py-10">
        <VoiceOrb status={status} />

        <p className="text-sm font-medium text-violet-700">{STATUS_TEXT[status]}</p>

        {/* Live transcript of what the mic is capturing — editable before sending */}
        {liveText && (
          <div className="w-full max-w-md rounded-2xl bg-violet-50 p-4 ring-2 ring-violet-200">
            <div className="mb-2 flex items-baseline justify-between gap-3">
              <p className="text-[10px] font-bold uppercase tracking-wider text-violet-700">
                You&apos;re saying
              </p>
              <p className="text-[10px] text-violet-400">
                Tap the text to edit it before sending
              </p>
            </div>
            <textarea
              value={pendingFinal}
              onFocus={clearSilenceTimer}
              onChange={(e) => {
                const value = e.target.value;
                pendingRef.current = value;
                setPendingFinal(value);
                // Editing takes over: stop the pending auto-send. If the text
                // is cleared entirely, hand control back to the voice flow.
                clearSilenceTimer();
                const isEdited = value.trim().length > 0;
                editedRef.current = isEdited;
                setEdited(isEdited);
              }}
              rows={3}
              aria-label="Edit your captured statement"
              className="w-full resize-none rounded-xl border border-violet-200 bg-white px-3 py-2 text-sm leading-6 text-zinc-900 outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-200"
            />
            {interim && (
              <p className="mt-1 text-sm italic leading-6 text-violet-500">
                {interim}…
              </p>
            )}
            <div className="mt-2 flex items-center justify-between gap-3">
              <p className="text-[10px] text-violet-500">
                {edited
                  ? "Auto-send is paused while you edit — tap Send when ready."
                  : status === "listening"
                    ? "Sends automatically when you pause, or tap Send."
                    : ""}
              </p>
              {pendingFinal.trim() && status === "listening" && (
                <button
                  type="button"
                  onClick={() => sendMessage(pendingRef.current)}
                  className="shrink-0 rounded-full bg-violet-700 px-4 py-1.5 text-xs font-semibold text-white hover:bg-violet-800 cursor-pointer"
                >
                  Send
                </button>
              )}
            </div>
          </div>
        )}

        {error && (
          <p className="max-w-md text-center text-sm text-red-600">{error}</p>
        )}

        <button
          type="button"
          onClick={active ? handleStop : handleStart}
          disabled={!hydrated}
          className={`flex items-center gap-2 rounded-full px-8 py-3.5 text-sm font-semibold shadow-md transition-colors cursor-pointer ${
            active
              ? "bg-red-100 text-red-700 hover:bg-red-200"
              : "bg-violet-700 text-white hover:bg-violet-800"
          }`}
        >
          <MicIcon className="h-4 w-4" />
          {active ? "Stop" : "Start talking"}
        </button>
      </section>

      {/* Right — chatbot-style conversation */}
      <aside className="flex min-h-0 w-full flex-col border-t-2 border-violet-100 bg-violet-50/40 lg:w-[400px] lg:border-l-2 lg:border-t-0 xl:w-[440px]">
        <div className="border-b border-violet-100 bg-white/70 px-5 py-4">
          <h2 className="text-xs font-bold uppercase tracking-wider text-violet-700">
            Conversation
          </h2>
        </div>

        <div
          ref={scrollRef}
          className="flex-1 space-y-3 overflow-y-auto px-5 py-4"
        >
          {conversation.map((message, i) => (
            <div
              key={`${message.at}-${i}`}
              className={`flex ${
                message.role === "user" ? "justify-end" : "justify-start"
              }`}
            >
              <div
                className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-6 ${
                  message.role === "user"
                    ? "rounded-br-md bg-violet-700 text-white"
                    : "rounded-bl-md bg-white text-zinc-800 ring-1 ring-violet-100"
                }`}
              >
                {message.content}
              </div>
            </div>
          ))}

          {status === "thinking" && (
            <div className="flex justify-start">
              <div className="flex items-center gap-1.5 rounded-2xl rounded-bl-md bg-white px-4 py-3 ring-1 ring-violet-100">
                {[0, 1, 2].map((i) => (
                  <span
                    key={i}
                    className="thinking-dot h-2 w-2 rounded-full bg-violet-400"
                    style={{ animationDelay: `${i * 0.18}s` }}
                  />
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Typed fallback input */}
        <form
          onSubmit={handleTypedSend}
          className="flex gap-2 border-t border-violet-100 bg-white/70 px-4 py-3"
        >
          <input
            type="text"
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            placeholder="Or type a message…"
            className="flex-1 rounded-full border border-violet-200 bg-white px-4 py-2 text-sm text-zinc-800 outline-none placeholder:text-zinc-400 focus:border-violet-500"
          />
          <button
            type="submit"
            disabled={!typed.trim() || status === "thinking"}
            className="rounded-full bg-violet-700 px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-violet-800 disabled:cursor-not-allowed disabled:bg-violet-300 enabled:cursor-pointer"
          >
            Send
          </button>
        </form>
      </aside>
    </div>
  );
}
