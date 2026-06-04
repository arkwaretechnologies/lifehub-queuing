import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/db/supabaseServer";

const SETTINGS_ID = "default";

const DEFAULTS = {
  id: SETTINGS_ID,
  clinic_name: "Lifehub Medical & Diagnostic Center",
  header_text: "Entrance Queue",
  footer_text: "Please wait for your number to be called.",
  paper_width_mm: 58,
  margin_mm: 4,
  show_logo: true,
  auto_print: true,
  auto_print_delay_ms: 250,
  font_size_number: 40,
  printer_name: null,
  printer_id: null,
  updated_at: new Date().toISOString(),
};

function shouldRetryWithoutPrinterId(message: string): boolean {
  const lower = message.toLowerCase();
  return (
    (lower.includes("printer_id") && lower.includes("schema cache")) ||
    (lower.includes("column") && lower.includes("printer_id"))
  );
}

export async function GET() {
  const supabase = supabaseServer();
  const { data, error } = await supabase
    .from("printer_settings")
    .select("*")
    .eq("id", SETTINGS_ID)
    .maybeSingle();

  if (error) {
    if (error.message.includes("schema cache")) {
      return NextResponse.json(DEFAULTS);
    }
    return new NextResponse(error.message, { status: 500 });
  }

  return NextResponse.json({ ...DEFAULTS, ...(data ?? {}) });
}

export async function PATCH(req: NextRequest) {
  const body = await req.json();

  const allowed: Record<string, true> = {
    clinic_name: true,
    header_text: true,
    footer_text: true,
    paper_width_mm: true,
    margin_mm: true,
    show_logo: true,
    auto_print: true,
    auto_print_delay_ms: true,
    font_size_number: true,
    printer_name: true,
    printer_id: true,
  };

  const updates: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(body)) {
    if (allowed[key]) updates[key] = val;
  }
  if (Object.keys(updates).length === 0) {
    return new NextResponse("No valid fields", { status: 400 });
  }
  updates.updated_at = new Date().toISOString();

  const supabase = supabaseServer();

  const { data: existing } = await supabase
    .from("printer_settings")
    .select("id")
    .eq("id", SETTINGS_ID)
    .maybeSingle();

  const runPatch = async (candidateUpdates: Record<string, unknown>) => {
    if (!existing) {
      return supabase
        .from("printer_settings")
        .insert({ ...DEFAULTS, ...candidateUpdates, id: SETTINGS_ID })
        .select("*")
        .single();
    }
    return supabase
      .from("printer_settings")
      .update(candidateUpdates)
      .eq("id", SETTINGS_ID)
      .select("*")
      .single();
  };

  let { data, error } = await runPatch(updates);

  if (error && shouldRetryWithoutPrinterId(error.message) && "printer_id" in updates) {
    const legacyUpdates = { ...updates };
    delete legacyUpdates.printer_id;
    ({ data, error } = await runPatch(legacyUpdates));
  }

  if (error) return new NextResponse(error.message, { status: 500 });
  return NextResponse.json({ ...DEFAULTS, ...(data ?? {}) });
}
