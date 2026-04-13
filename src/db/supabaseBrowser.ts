"use client";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { env } from "@/env";

export function isSupabaseBrowserConfigured(): boolean {
  return Boolean(env.NEXT_PUBLIC_SUPABASE_URL && env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}

/** Throws if public Supabase env is missing. Prefer `isSupabaseBrowserConfigured()` first on read-only surfaces (e.g. TV). */
export function supabaseBrowser(): SupabaseClient {
  if (!isSupabaseBrowserConfigured()) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY");
  }
  return createClient(env.NEXT_PUBLIC_SUPABASE_URL!, env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
}

