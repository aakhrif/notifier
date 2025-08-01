"use client";

import { useState } from "react";

interface Job {
  id: string;
  resources: string[];
  tokens: string[];
  interval: number;
  email: string;
  template: string;
  status: "active" | "paused" | "stopped";
}

// Demo: Jobs werden im Local State gehalten. In echt: Backend/API nutzen!
const initialJobs: Job[] = [
  {
    id: "1",
    resources: ["Jupiter", "Raydium"],
    tokens: ["So11111111111111111111111111111111111111112"],
    interval: 10,
    email: "test@example.com",
    template: "Hallo, dies ist deine Preisbenachrichtigung!",
    status: "active",
  },
];

export default function JobsPage() {
  const [jobs, setJobs] = useState<Job[]>(initialJobs);

  const stopJob = (id: string) => {
    setJobs(jobs => jobs.map(j => j.id === id ? { ...j, status: "stopped" } : j));
  };
  const deleteJob = (id: string) => {
    setJobs(jobs => jobs.filter(j => j.id !== id));
  };
  const reactivateJob = (id: string) => {
    setJobs(jobs => jobs.map(j => j.id === id ? { ...j, status: "active" } : j));
  };

  return (
    <div className="max-w-4xl mx-auto p-8">
      <h1 className="text-3xl font-bold mb-8">Aktive Jobs</h1>
      {jobs.length === 0 ? (
        <div className="text-gray-500">Keine aktiven Jobs.</div>
      ) : (
        <ul className="space-y-6">
          {jobs.map(job => (
            <li key={job.id} className="bg-white rounded-xl shadow-lg p-6 flex flex-col gap-2">
              <div className="flex justify-between items-center">
                <div>
                  <span className="font-semibold text-lg">Job #{job.id}</span>
                  <span className={`ml-4 px-2 py-1 rounded text-xs font-bold ${job.status === "active" ? "bg-green-100 text-green-700" : job.status === "paused" ? "bg-yellow-100 text-yellow-700" : "bg-red-100 text-red-700"}`}>{job.status}</span>
                </div>
                <div className="flex gap-2">
                  {job.status !== "stopped" && (
                    <button onClick={() => stopJob(job.id)} className="px-3 py-1 rounded bg-yellow-200 text-yellow-900 font-semibold hover:bg-yellow-300">Stoppen</button>
                  )}
                  {job.status === "stopped" && (
                    <button onClick={() => reactivateJob(job.id)} className="px-3 py-1 rounded bg-green-200 text-green-900 font-semibold hover:bg-green-300">Reaktivieren</button>
                  )}
                  <button onClick={() => deleteJob(job.id)} className="px-3 py-1 rounded bg-red-200 text-red-900 font-semibold hover:bg-red-300">Löschen</button>
                </div>
              </div>
              <div className="text-gray-700 text-sm mt-2">
                <div><b>Ressourcen:</b> {job.resources.join(", ")}</div>
                <div><b>Tokens:</b> {job.tokens.join(", ")}</div>
                <div><b>Intervall:</b> {job.interval} min</div>
                <div><b>Email:</b> {job.email}</div>
                <div><b>Vorlage:</b> {job.template}</div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
