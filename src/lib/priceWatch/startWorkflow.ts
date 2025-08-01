// Typ für die Preis-API-Antwort pro Token
type PriceApiResult = {
  usdPrice?: number;
  blockId?: number;
  decimals?: number;
  priceChange24h?: number;
  [key: string]: unknown;
};
import { fetchJupiterPrices } from "@/lib/apiProviders/jupiter";
import { fetchRaydiumPrices } from "@/lib/apiProviders/raydium";
import { fetchBirdeyePrices } from "@/lib/apiProviders/birdeye";
import { sendEmail } from "@/lib/email/sendEmail";

export interface StartWorkflowOptions {
  tokens: string[];
  activeResources: Record<string, boolean>;
  template: string;
  email: string;
  interval: number;
}

const apiProviders = [
  { name: "Jupiter", call: fetchJupiterPrices },
  { name: "Raydium", call: fetchRaydiumPrices },
  { name: "Birdeye", call: fetchBirdeyePrices },
];

export async function startPriceWatchWorkflow({
  tokens,
  activeResources,
  template,
  email,
  interval,
}: StartWorkflowOptions) {
  // 1. Aktive Provider filtern
  const selectedProviders = apiProviders.filter((p) => activeResources[p.name]);
  // 2. API-Calls ausführen
  const results = await Promise.all(selectedProviders.map((p) => p.call(tokens)));
  // Debug-Ausgabe der API-Rohdaten
  console.log("[PriceWatch] API-Rohdaten für Email:", JSON.stringify(results, null, 2));
  // 3. Ergebnisse schön formatieren
  let apiSummary = "";
  results.forEach((providerResult, i) => {
    const providerName = selectedProviders[i]?.name || `Provider ${i+1}`;
    apiSummary += `--- ${providerName} ---\n`;
    if (providerResult && typeof providerResult === "object") {
      Object.entries(providerResult as Record<string, PriceApiResult>).forEach(([token, data]) => {
        apiSummary += `Token: ${token}\n`;
        if (data && typeof data === "object") {
          if (typeof data.usdPrice === "number") apiSummary += `Preis (USD): ${data.usdPrice}\n`;
          if (typeof data.priceChange24h === "number") apiSummary += `24h Änderung: ${data.priceChange24h}%\n`;
        } else {
          apiSummary += `Daten: ${JSON.stringify(data)}\n`;
        }
        apiSummary += "---\n";
      });
    } else {
      apiSummary += `Daten: ${JSON.stringify(providerResult)}\n---\n`;
    }
  });
  // 4. Email-Content generieren
  const emailContent = `${template}\n\n${apiSummary}`;
  // 5. Email-Service aufrufen
  await sendEmail({
    to: email,
    subject: "Price Watch Benachrichtigung",
    content: emailContent,
    interval,
  });
  return emailContent;
}

export default startPriceWatchWorkflow;
