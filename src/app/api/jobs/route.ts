import { NextRequest, NextResponse } from "next/server";
import { createEmailJob, getActiveEmailJobs } from "@/lib/db/emailJobs";
import { startPriceWatchWorkflow } from "@/lib/priceWatch/startWorkflow";

// POST /api/jobs - Job anlegen
export async function POST(req: NextRequest) {
  const body = await req.json();
  const { resources, tokens, interval, email, template } = body;
  if (!resources || !tokens || !interval || !email || !template) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }
  const job = await createEmailJob({ resources, tokens, interval, email, template });
  // Starte den Workflow direkt nach dem Anlegen (nur einmalig, nicht als Intervall!)
  await startPriceWatchWorkflow({
    tokens,
    // Konvertiere Array zu Record für Kompatibilität
    activeResources: Object.fromEntries(resources.map((r: string) => [r, true])),
    template,
    email,
    interval,
  });
  return NextResponse.json(job);
}

// GET /api/jobs - Alle aktiven Jobs
export async function GET() {
  const jobs = await getActiveEmailJobs();
  return NextResponse.json(jobs);
}
