import { NextRequest, NextResponse } from "next/server";
import fetch from "cross-fetch";

const JUPITER_API_URL = "https://quote-api.jup.ag/v6";

// GET /api/solana/tokens - Verfügbare Token von Jupiter abrufen
export async function GET() {
  try {
    const response = await fetch(`${JUPITER_API_URL}/tokens`);
    
    if (!response.ok) {
      throw new Error(`Jupiter Tokens Fehler: ${response.statusText}`);
    }
    
    const tokens = await response.json();
    
    // Beliebte Token filtern (optional)
    const popularTokens = tokens.filter((token: any) => {
      const symbol = token.symbol?.toUpperCase();
      return ["SOL", "USDC", "USDT", "RAY", "SRM", "BONK", "JUP", "WIF"].includes(symbol);
    });
    
    return NextResponse.json({
      popularTokens,
      allTokens: tokens,
      total: tokens.length
    });
    
  } catch (error) {
    console.error("Tokens Fehler:", error);
    return NextResponse.json({ 
      error: "Fehler beim Abrufen der Token-Liste" 
    }, { status: 500 });
  }
}
