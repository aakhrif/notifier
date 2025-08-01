import { startJobRunner } from "./jobRunner";

let started = false;

export function ensureJobRunnerStarted() {
  if (!started) {
    startJobRunner();
    started = true;
    console.log("JobRunner gestartet.");
  }
}
