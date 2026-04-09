import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/db/supabaseServer";
import { requireEnv } from "@/env";

const BUCKET = "media";
const IMAGE_MAX = 10 * 1024 * 1024; // 10 MB
const VIDEO_MAX = 100 * 1024 * 1024; // 100 MB

const IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/svg+xml",
];

const VIDEO_TYPES = [
  "video/mp4",
  "video/webm",
  "video/quicktime",
];

const ALL_ALLOWED = [...IMAGE_TYPES, ...VIDEO_TYPES];

async function ensureBucket(supabase: ReturnType<typeof supabaseServer>) {
  const { data } = await supabase.storage.getBucket(BUCKET);
  if (!data) {
    await supabase.storage.createBucket(BUCKET, { public: true });
  }
}

export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  if (!file) return new NextResponse("No file provided", { status: 400 });

  if (!ALL_ALLOWED.includes(file.type)) {
    return new NextResponse(
      "Allowed: JPEG, PNG, GIF, WebP, SVG images and MP4, WebM, MOV videos",
      { status: 400 },
    );
  }

  const isVideo = VIDEO_TYPES.includes(file.type);
  const maxSize = isVideo ? VIDEO_MAX : IMAGE_MAX;
  if (file.size > maxSize) {
    return new NextResponse(
      `File too large (max ${isVideo ? "100" : "10"} MB)`,
      { status: 400 },
    );
  }

  const ext = file.name.split(".").pop()?.toLowerCase() ?? (isVideo ? "mp4" : "png");
  const filename = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const folder = isVideo ? "videos" : "uploads";
  const path = `${folder}/${filename}`;

  const supabase = supabaseServer();
  await ensureBucket(supabase);

  const buffer = Buffer.from(await file.arrayBuffer());
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, buffer, { contentType: file.type, upsert: false });

  if (error) return new NextResponse(error.message, { status: 500 });

  const supabaseUrl = requireEnv("NEXT_PUBLIC_SUPABASE_URL");
  const publicUrl = `${supabaseUrl}/storage/v1/object/public/${BUCKET}/${path}`;

  return NextResponse.json({ url: publicUrl, path, filename, isVideo });
}
