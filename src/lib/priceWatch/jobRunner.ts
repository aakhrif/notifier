import prisma from "../db/prisma";
import startWorkflow from "./startWorkflow";

// Läuft alle 60 Sekunden und prüft alle aktiven Jobs
export function startJobRunner() {
  setInterval(async () => {
    const now = new Date();
    const jobs = await prisma.emailJob.findMany({ where: { status: "active" } });
    for (const job of jobs) {
      const lastRun = job.lastRun ?? job.createdAt;
      const nextRun = new Date(lastRun.getTime() + job.interval * 60 * 1000);
      if (now >= nextRun) {
        try {
          // resources als activeResources-Objekt umwandeln
          const resourcesArr = JSON.parse(job.resources);
          const activeResources = Object.fromEntries(resourcesArr.map((r: string) => [r, true]));
          await startWorkflow({
            activeResources,
            tokens: JSON.parse(job.tokens),
            interval: job.interval,
            email: job.email,
            template: job.template,
          });
          await prisma.emailJob.update({ where: { id: job.id }, data: { lastRun: now } });
          console.log(`E-Mail für Job ${job.id} verschickt.`);
        } catch (e) {
          console.error(`Fehler beim Senden für Job ${job.id}:`, e);
        }
      }
    }
  }, 60 * 1000); // alle 60 Sekunden prüfen
}
