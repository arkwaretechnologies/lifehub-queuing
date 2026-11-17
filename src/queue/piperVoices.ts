export const PIPER_VOICE_CHOICES = ["hfc_female_medium", "hfc_male_medium"] as const;

export type PiperVoiceChoice = (typeof PIPER_VOICE_CHOICES)[number];

export const DEFAULT_PIPER_VOICE_CHOICE: PiperVoiceChoice = "hfc_female_medium";

export const PIPER_VOICE_CATALOG: Record<
  PiperVoiceChoice,
  { label: string; modelId: string }
> = {
  hfc_female_medium: {
    label: "HFC Female (medium)",
    modelId: "en_US-hfc_female-medium",
  },
  hfc_male_medium: {
    label: "HFC Male (medium)",
    modelId: "en_US-hfc_male-medium",
  },
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