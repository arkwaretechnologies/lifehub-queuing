import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { adminSessionCookieName, readAdminSessionFromRequestCookie } from "@/admin/session";
import { issueQueueTicket } from "@/queue/issueTicket";

type Body = {
  counterCode?: string;
  priorityCode?: string;
};

export async function POST(req: Request) {
  const jar = await cookies();
  const session = readAdminSessionFromRequestCookie(jar.get(adminSessionCookieName)?.value);

  if (!session) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const body = (await req.json().catch(() => ({}))) as Body;
  const counterCode = (body.counterCode || "").trim();
  const priorityCode = (body.priorityCode || "").trim();

  if (!counterCode || !priorityCode) {
    return new NextResponse("Missing counterCode or priorityCode", { status: 400 });
  }

  try {
    const ticket = await issueQueueTicket({
      counterCode,
      priorityCode,
      registrationType: "Online Appointment",
      displayMode: "counter",
    });
    return NextResponse.json(ticket);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to check in appointment";
    return new NextResponse(message, { status: 500 });
  }
}
