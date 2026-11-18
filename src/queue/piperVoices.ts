export const PIPER_VOICE_CHOICES = [
  "hfc_female_medium",
  "hfc_male_medium",
  "amy_medium",
  "kristin_medium",
  "lessac_medium",
  "ryan_medium",
  "john_medium",
  "bryce_medium",
  "norman_medium",
  "cori_medium",
  "jenny_dioco_medium",
  "alan_medium",
] as const;

export type PiperVoiceChoice = (typeof PIPER_VOICE_CHOICES)[number];

export const DEFAULT_PIPER_VOICE_CHOICE: PiperVoiceChoice = "hfc_female_medium";

export type PiperVoiceGender = "female" | "male";
export type PiperVoiceAccent = "US" | "UK";

export type PiperVoiceEntry = {
  label: string;
  modelId: string;
  gender: PiperVoiceGender;
  accent: PiperVoiceAccent;
};

/**
 * English Piper voices (rhasspy/piper-voices on Hugging Face), all single-speaker "medium"
 * quality (~63 MB .onnx each). Files live under public/piper/models — see
 * scripts/download-piper-voice.mjs, which derives its download list from modelId.
 */
export const PIPER_VOICE_CATALOG: Record<PiperVoiceChoice, PiperVoiceEntry> = {
  hfc_female_medium: { label: "HFC Female", modelId: "en_US-hfc_female-medium", gender: "female", accent: "US" },
  hfc_male_medium: { label: "HFC Male", modelId: "en_US-hfc_male-medium", gender: "male", accent: "US" },
  amy_medium: { label: "Amy", modelId: "en_US-amy-medium", gender: "female", accent: "US" },
  kristin_medium: { label: "Kristin", modelId: "en_US-kristin-medium", gender: "female", accent: "US" },
  lessac_medium: { label: "Lessac", modelId: "en_US-lessac-medium", gender: "female", accent: "US" },
  ryan_medium: { label: "Ryan", modelId: "en_US-ryan-medium", gender: "male", accent: "US" },
  john_medium: { label: "John", modelId: "en_US-john-medium", gender: "male", accent: "US" },
  bryce_medium: { label: "Bryce", modelId: "en_US-bryce-medium", gender: "male", accent: "US" },
  norman_medium: { label: "Norman", modelId: "en_US-norman-medium", gender: "male", accent: "US" },
  cori_medium: { label: "Cori", modelId: "en_GB-cori-medium", gender: "female", accent: "UK" },
  jenny_dioco_medium: { label: "Jenny", modelId: "en_GB-jenny_dioco-medium", gender: "female", accent: "UK" },
  alan_medium: { label: "Alan", modelId: "en_GB-alan-medium", gender: "male", accent: "UK" },
};

export function isPiperVoiceChoice(value: string | null | undefined): value is PiperVoiceChoice {
  return !!value && (PIPER_VOICE_CHOICES as readonly string[]).includes(value);
}

export function resolvePiperModelId(choice: PiperVoiceChoice): string {
  return PIPER_VOICE_CATALOG[choice].modelId;
}

export function piperModelPublicPaths(modelId: string): { onnx: string; config: string } {
  const voicePath = modelId.split("-");
  const lang = voicePath[0]?.split("_")[0] ?? "en";
  const folder = voicePath.join("/");
  const prefix = `/piper/models/${lang}/${folder}/${modelId}`;
  return { onnx: `${prefix}.onnx`, config: `${prefix}.onnx.json` };
}