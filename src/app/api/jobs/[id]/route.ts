import { NextRequest, NextResponse } from "next/server";
import { updateEmailJobStatus, deleteEmailJob } from "@/lib/db/emailJobs";

// PATCH /api/jobs/[id] - Status ändern

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const { status } = await req.json();
  if (!status) return NextResponse.json({ error: "Missing status" }, { status: 400 });
  const job = await updateEmailJobStatus(id, status);
  return NextResponse.json(job);
}

// DELETE /api/jobs/[id] - Job löschen

export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  await deleteEmailJob(id);
  return NextResponse.json({ ok: true });
}
