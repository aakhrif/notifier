"use client";

import { useState } from "react";
import { useLoadingOverlay } from "../components/LoadingOverlay";
import { useRouter } from "next/navigation";
import { TrashIcon, PlusIcon } from "@heroicons/react/24/outline";


const resources = ["Jupiter", "Raydium", "Birdeye"];
const intervals = [2, 5, 10, 15, 20];

export default function PriceWatchPage() {
  const { show, hide } = useLoadingOverlay();
  const [input, setInput] = useState("");
  const [tokens, setTokens] = useState<string[]>([]);
  const [activeResources, setActiveResources] = useState<string[]>(["Jupiter"]);
  const [interval, setInterval] = useState<number>(10);
  const [email, setEmail] = useState("");
  const [template] = useState(
    "Hallo, dies ist deine Preisbenachrichtigung!"
  );

  const addToken = () => {
    if (tokens.length >= 3) return;
    const trimmed = input.trim();
    if (trimmed && !tokens.includes(trimmed)) {
      setTokens([...tokens, trimmed]);
      setInput("");
    }
  };

  const removeToken = (token: string) => {
    setTokens(tokens.filter((t) => t !== token));
  };

  const toggleResource = (name: string) => {
    setActiveResources((prev) =>
      prev.includes(name)
        ? prev.filter((n) => n !== name)
        : [...prev, name]
    );
  };

  const router = useRouter();

  return (
    <div className="max-w-6xl mx-auto p-8">
      {/* Sticky Start-Button ganz oben */}
      <div className="w-full flex justify-center mb-8 sticky top-0 z-20 bg-[#f7fafc] py-6">
        <button
          type="button"
          onClick={async () => {
            show("Job wird angelegt...");
            try {
              const res = await fetch("/api/jobs", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  resources: activeResources,
                  tokens,
                  interval,
                  email,
                  template,
                }),
              });
              if (res.ok) {
                // Overlay bleibt bis zur Weiterleitung sichtbar
                router.push("/jobs");
              } else {
                hide();
                alert("Fehler beim Anlegen des Jobs!");
              }
            } catch {
              hide();
              alert("Fehler beim Anlegen des Jobs!");
            }
          }}
          className="px-6 py-3 rounded-lg bg-[#28ebcf] text-white font-bold shadow-lg hover:bg-[#20cbb0] transition flex items-center gap-2 text-lg cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          disabled={
            !email || !template || tokens.length === 0 || activeResources.length === 0
          }
        >
          Start
        </button>
      </div>
      <div className="flex gap-8">
        {/* Linker Bereich: Token-Adressen */}
        <div className="w-1/2">
        <h2 className="text-2xl font-bold mb-6 text-[#101112]">
          Einstellungen
        </h2>
        <div className="bg-white rounded-xl shadow-lg p-6 mb-8">
          <h3 className="text-lg font-semibold mb-4">Ressourcen</h3>
          <div className="flex flex-col gap-4">
            {resources.map((name) => (
              <label
                key={name}
                className="flex items-center gap-3 cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={activeResources.includes(name)}
                  onChange={() => toggleResource(name)}
                  className="accent-[#28ebcf] h-5 w-5 rounded focus:ring-2 focus:ring-[#28ebcf] cursor-pointer"
                  disabled={name === "Raydium" || name === "Birdeye"}
                />
                <span className="text-gray-800 font-medium">{name}</span>
              </label>
            ))}
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-lg p-6 mb-8">
          <h3 className="text-lg font-semibold mb-4">Zeitintervall</h3>
          <div className="flex gap-4">
            {intervals.map((i) => (
              <button
                key={i}
                type="button"
                onClick={() => setInterval(i)}
                className={`px-4 py-2 rounded-lg font-semibold transition shadow-sm border-2 border-transparent cursor-pointer
                  ${
                    interval === i
                      ? "bg-[#28ebcf] text-white border-[#28ebcf]"
                      : "bg-gray-100 text-gray-800 hover:bg-[#28ebcf]/10 hover:border-[#28ebcf]"
                  }`}
              >
                {i} min
              </button>
            ))}
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-lg p-6 mb-8">
          <h3 className="text-lg font-semibold mb-4">E-Mail Empfänger</h3>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#28ebcf] text-gray-900 bg-gray-50 shadow-sm"
            placeholder="E-Mail Adresse eingeben..."
          />
        </div>
        {/*
        <div className="bg-white rounded-xl shadow-lg p-6 mb-8">
          <h3 className="text-lg font-semibold mb-4">E-Mail Vorlage</h3>
          <textarea
            value={template}
            onChange={(e) => setTemplate(e.target.value)}
            className="w-full min-h-[100px] px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#28ebcf] text-gray-900 bg-gray-50 shadow-sm"
            placeholder="E-Mail Vorlage eingeben..."
          />
        </div>
        */}
        
      </div>
      {/* Rechter Bereich: Einstellungen */}
      <div className="w-1/2">
        <h1 className="text-3xl font-bold mb-6 text-[#101112]">
          Token-Adressen
        </h1>
        <div className="bg-white rounded-xl shadow-lg p-6 mb-8">
          <label
            htmlFor="token-input"
            className="block text-lg font-medium text-gray-700 mb-2"
          >
            Token-Adresse hinzufügen
          </label>
          <div className="flex gap-2">
            <input
              id="token-input"
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              className="flex-1 px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#28ebcf] text-gray-900 bg-gray-50 shadow-sm"
              placeholder="Token-Adresse eingeben..."
              onKeyDown={(e) => {
                if (e.key === "Enter") addToken();
              }}
              disabled={tokens.length >= 3}
            />
            <button
              type="button"
              onClick={addToken}
              className="px-4 py-3 rounded-lg bg-[#28ebcf] text-white font-bold shadow-md hover:bg-[#20cbb0] transition flex items-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={tokens.length >= 3}
            >
              <PlusIcon className="h-5 w-5" />
              Hinzufügen
            </button>
          </div>
        </div>
        {tokens.length > 0 && (
          <div className="bg-white rounded-xl shadow-lg p-6">
            <h2 className="text-lg font-semibold text-[#101112] mb-4">
              Token-Adressen
            </h2>
            <ul className="space-y-3">
              {tokens.map((token) => (
                <li
                  key={token}
                  className="flex items-center justify-between px-4 py-2 rounded-lg bg-gray-100"
                >
                  <span className="font-mono text-gray-800 break-all">
                    {token}
                  </span>
                  <button
                    type="button"
                    onClick={() => removeToken(token)}
                    className="p-2 rounded-lg hover:bg-[#28ebcf]/20 transition"
                    title="Token entfernen"
                  >
                    <TrashIcon className="h-5 w-5 text-[#28ebcf]" />
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
      </div>
    </div>
  );
}
