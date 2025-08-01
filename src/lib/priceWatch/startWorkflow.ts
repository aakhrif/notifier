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
  // 3. Ergebnisse zusammenfassen
  const apiSummary = results.join("\n");
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
