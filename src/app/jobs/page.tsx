"use client";


import { useEffect, useState } from "react";

type Job = {
  id: string;
  resources: string;
  tokens: string;
  interval: number;
  email: string;
  template: string;
  status: string;
};

export default function JobsPage() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/jobs")
      .then((res) => res.json())
      .then((data) => {
        setJobs(data);
        setLoading(false);
      });
  }, []);

  return (
    <div className="max-w-4xl mx-auto p-8">
      <h1 className="text-3xl font-bold mb-8">Aktive Jobs</h1>
      {loading ? (
        <div className="text-gray-500">Lade Jobs...</div>
      ) : jobs.length === 0 ? (
        <div className="text-gray-500">Keine aktiven Jobs.</div>
      ) : (
        <ul className="space-y-6">
          {jobs.map((job) => {
            const resources = JSON.parse(job.resources);
            const tokens = JSON.parse(job.tokens);
            const handleStatus = async (status: string) => {
              await fetch(`/api/jobs/${job.id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ status }),
              });
              setJobs((prev) => prev.map(j => j.id === job.id ? { ...j, status } : j));
            };
            const handleDelete = async () => {
              await fetch(`/api/jobs/${job.id}`, { method: "DELETE" });
              setJobs((prev) => prev.filter(j => j.id !== job.id));
            };
            return (
              <li key={job.id} className="bg-white rounded-xl shadow-lg p-6 flex flex-col gap-2">
                <div className="flex justify-between items-center">
                  <div>
                    <span className="font-semibold text-lg">Job #{job.id}</span>
                    <span className={`ml-4 px-2 py-1 rounded text-xs font-bold ${job.status === "active" ? "bg-green-100 text-green-700" : job.status === "paused" ? "bg-yellow-100 text-yellow-700" : "bg-red-100 text-red-700"}`}>{job.status}</span>
                  </div>
                  <div className="flex gap-2">
                    {job.status !== "stopped" && (
<button onClick={() => handleStatus("stopped")} className="px-3 py-1 rounded bg-yellow-200 text-yellow-900 font-semibold hover:bg-yellow-300 cursor-pointer">Stoppen</button>
                    )}
                    {job.status === "stopped" && (
<button onClick={() => handleStatus("active")} className="px-3 py-1 rounded bg-green-200 text-green-900 font-semibold hover:bg-green-300 cursor-pointer">Reaktivieren</button>
                    )}
<button onClick={handleDelete} className="px-3 py-1 rounded bg-red-200 text-red-900 font-semibold hover:bg-red-300 cursor-pointer">Löschen</button>
                  </div>
                </div>
                <div className="text-gray-700 text-sm mt-2">
                  <div><b>Ressourcen:</b> {resources.join(", ")}</div>
                  <div><b>Tokens:</b> {tokens.join(", ")}</div>
                  <div><b>Intervall:</b> {job.interval} min</div>
                  <div><b>Email:</b> {job.email}</div>
                  <div><b>Vorlage:</b> {job.template}</div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
