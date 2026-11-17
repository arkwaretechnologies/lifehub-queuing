import { cpSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dist = join(root, "node_modules", "piper-tts-web", "dist");
const publicDir = join(root, "public");

const copies = [
  ["onnx", "onnx"],
  ["piper", "piper"],
  ["worker", "worker"],
];

if (!existsSync(dist)) {
  console.warn("piper-tts-web dist not found — skip asset copy");
  process.exit(0);
}

for (const [from, to] of copies) {
  const src = join(dist, from);
  const dest = join(publicDir, to);
  if (!existsSync(src)) {
    console.warn(`Missing ${src}`);
    continue;
  }
  mkdirSync(dirname(dest), { recursive: true });
  cpSync(src, dest, { recursive: true });
  console.log(`Copied ${from} → public/${to}`);
}

const engineSrc = join(dist, "piper-tts-web.js");
const engineDest = join(publicDir, "piper-tts-web.js");
if (existsSync(engineSrc)) {
  cpSync(engineSrc, engineDest);
  console.log("Copied piper-tts-web.js → public/piper-tts-web.js");
} else {
  console.error("Missing piper-tts-web.js in node_modules/piper-tts-web/dist");
  process.exit(1);
}

if (!existsSync(join(publicDir, "piper", "piper_phonemize.wasm"))) {
  console.error("public/piper/piper_phonemize.wasm is missing after copy");
  process.exit(1);
}

const hfcModels = [
  join("piper", "models", "en", "en_US", "hfc_female", "medium", "en_US-hfc_female-medium.onnx"),
  join("piper", "models", "en", "en_US", "hfc_male", "medium", "en_US-hfc_male-medium.onnx"),
];
for (const rel of hfcModels) {
  if (!existsSync(join(publicDir, ...rel.split("/")))) {
    console.warn(`Missing ${rel} — run: npm run download:piper-voices`);
  }
}