
import { NextRequest, NextResponse } from "next/server";
import { createEmailJob, getActiveEmailJobs } from "@/lib/db/emailJobs";
import { startPriceWatchWorkflow } from "@/lib/priceWatch/startWorkflow";
import { ensureJobRunnerStarted } from "@/lib/priceWatch/jobRunnerInit";

ensureJobRunnerStarted();

// POST /api/jobs - Job anlegen
export async function POST(req: NextRequest) {
  const body = await req.json();
  const { resources, tokens, interval, email, template } = body;
  if (!resources || !tokens || !interval || !email || !template) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }
  try {
    // Starte den Workflow zuerst (API-Calls, Email). Fehler werden abgefangen.
    await startPriceWatchWorkflow({
      tokens,
      activeResources: Object.fromEntries(resources.map((r: string) => [r, true])),
      template,
      email,
      interval,
    });
    // Nur wenn alles erfolgreich war, Job anlegen
    const job = await createEmailJob({ resources, tokens, interval, email, template });
    return NextResponse.json(job);
  } catch (error) {
    console.error("Job konnte nicht angelegt werden:", error);
    let message = "Job konnte nicht angelegt werden.";
    if (
      typeof error === "object" &&
      error !== null &&
      "message" in error &&
      typeof (error as Record<string, unknown>).message === "string"
    ) {
      message = (error as { message: string }).message;
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// GET /api/jobs - Alle aktiven Jobs
export async function GET() {
  const jobs = await getActiveEmailJobs();
  return NextResponse.json(jobs);
}
