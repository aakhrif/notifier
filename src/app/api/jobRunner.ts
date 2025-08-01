// API-Route zum Starten des Job-Runners (nur zu Entwicklungszwecken)
import { NextResponse } from "next/server";
import { startJobRunner } from "@/lib/priceWatch/jobRunner";

let started = false;

export async function GET() {
  if (!started) {
    startJobRunner();
    started = true;
    return NextResponse.json({ ok: true, message: "Job-Runner gestartet." });
  }
  return NextResponse.json({ ok: true, message: "Job-Runner läuft bereits." });
}
