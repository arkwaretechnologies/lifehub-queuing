import { createWriteStream, existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { pipeline } from "node:stream/promises";
import { Readable } from "node:stream";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const HF = "https://huggingface.co/rhasspy/piper-voices/resolve/main";

/** Piper model id → folder under public/piper/models */
const VOICES = [
  {
    modelId: "en_US-hfc_female-medium",
    relDir: join("piper", "models", "en", "en_US", "hfc_female", "medium"),
    hfPath: "en/en_US/hfc_female/medium",
  },
  {
    modelId: "en_US-hfc_male-medium",
    relDir: join("piper", "models", "en", "en_US", "hfc_male", "medium"),
    hfPath: "en/en_US/hfc_male/medium",
  },
];

async function downloadFile(url, dest) {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} for ${url}`);
  }
  const body = res.body;
  if (!body) throw new Error(`Empty body for ${url}`);
  await pipeline(Readable.fromWeb(body), createWriteStream(dest));
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