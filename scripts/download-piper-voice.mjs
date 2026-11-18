import { createWriteStream, existsSync, mkdirSync, renameSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { pipeline } from "node:stream/promises";
import { Readable } from "node:stream";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const HF = "https://huggingface.co/rhasspy/piper-voices/resolve/main";

/**
 * Piper model ids to download into public/piper/models/<lang>/<locale>/<name>/<quality>/.
 * Keep in sync with PIPER_VOICE_CATALOG in src/queue/piperVoices.ts.
 */
const MODEL_IDS = [
  "en_US-hfc_female-medium",
  "en_US-hfc_male-medium",
  "en_US-amy-medium",
  "en_US-kristin-medium",
  "en_US-lessac-medium",
  "en_US-ryan-medium",
  "en_US-john-medium",
  "en_US-bryce-medium",
  "en_US-norman-medium",
  "en_GB-cori-medium",
  "en_GB-jenny_dioco-medium",
  "en_GB-alan-medium",
];

/** "en_GB-jenny_dioco-medium" → "en/en_GB/jenny_dioco/medium" (same layout as Hugging Face). */
function voicePath(modelId) {
  const [locale, name, quality] = modelId.split("-");
  return [locale.split("_")[0], locale, name, quality];
}

const VOICES = MODEL_IDS.map((modelId) => ({
  modelId,
  relDir: join("piper", "models", ...voicePath(modelId)),
  hfPath: voicePath(modelId).join("/"),
}));

async function downloadFile(url, dest) {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} for ${url}`);
  }
  const body = res.body;
  if (!body) throw new Error(`Empty body for ${url}`);
  // Write to .part and rename when complete, so an interrupted build never leaves a
  // truncated model that later builds would treat as "Already present".
  const part = `${dest}.part`;
  await pipeline(Readable.fromWeb(body), createWriteStream(part));
  renameSync(part, dest);
}

for (const voice of VOICES) {
  const destDir = join(root, "public", voice.relDir);
  mkdirSync(destDir, { recursive: true });

  for (const ext of [".onnx.json", ".onnx"]) {
    const name = `${voice.modelId}${ext}`;
    const dest = join(destDir, name);
    if (existsSync(dest)) {
      console.log(`Already present: public/${voice.relDir.replaceAll("\\", "/")}/${name}`);
      continue;
    }
    const url = `${HF}/${voice.hfPath}/${name}`;
    console.log(`Downloading ${name}…`);
    await downloadFile(url, dest);
    console.log(`Saved public/${voice.relDir.replaceAll("\\", "/")}/${name}`);
  }
}