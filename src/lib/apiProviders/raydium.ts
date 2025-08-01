export async function fetchRaydiumPrices(tokenIds: string[]): Promise<string> {
  return `Raydium: Preise für ${tokenIds.join(", ")}`;
}
