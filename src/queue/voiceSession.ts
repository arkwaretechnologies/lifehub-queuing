import {
  DEFAULT_PIPER_VOICE_CHOICE,
  type PiperVoiceChoice,
  isPiperVoiceChoice,
} from "@/queue/piperVoices";

const SESSION_VOICE_KEY = "lh-queue-voice-choice";

export function readSessionVoiceChoice(): PiperVoiceChoice | null {
  if (typeof window === "undefined" || typeof localStorage === "undefined") return null;
  const raw = localStorage.getItem(SESSION_VOICE_KEY);
  return isPiperVoiceChoice(raw) ? raw : null;
}

export function writeSessionVoiceChoice(choice: PiperVoiceChoice): void {
  if (typeof window === "undefined" || typeof localStorage === "undefined") return;
  localStorage.setItem(SESSION_VOICE_KEY, choice);
}

/** Session override wins over server config from /api/config/voice. */
export function resolveLobbyVoiceChoice(serverChoice: string | null | undefined): PiperVoiceChoice {
  const session = readSessionVoiceChoice();
  if (session) return session;
  if (isPiperVoiceChoice(serverChoice)) return serverChoice;
  return DEFAULT_PIPER_VOICE_CHOICE;
}