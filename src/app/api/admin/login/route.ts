import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { supabaseServer } from "@/db/supabaseServer";
import { setAdminSession } from "@/admin/session";

type Body = { username?: string; password?: string };

const ALLOWED_ROLES = ["admin", "receptionist"];

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as Body;
  const username = (body.username || "").trim();
  const password = body.password || "";

  if (!username || !password) {
    return new NextResponse("Missing username or password", { status: 400 });
  }

  const supabase = supabaseServer();
  const { data, error } = await supabase
    .from("users")
    .select("user_id, username, password, role")
    .eq("username", username)
    .maybeSingle();

  if (error || !data) {
    return new NextResponse("Invalid credentials", { status: 401 });
  }

  if (!ALLOWED_ROLES.includes(data.role.toLowerCase())) {
    return new NextResponse("Not authorized", { status: 403 });
  }

  const stored = String(data.password || "");
  let ok = false;

  if (stored.startsWith("$2a$") || stored.startsWith("$2b$") || stored.startsWith("$2y$")) {
    ok = await bcrypt.compare(password, stored);
  } else {
    // Legacy/plaintext fallback. Strongly recommended to migrate to bcrypt.
    ok = password === stored;
  }

  if (!ok) return new NextResponse("Invalid credentials", { status: 401 });

  await setAdminSession({ userId: data.user_id, username: data.username, role: data.role });
  return NextResponse.json({ ok: true });
}

