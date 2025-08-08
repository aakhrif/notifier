import { NextRequest, NextResponse } from "next/server";
import { Connection } from "@solana/web3.js";

export async function POST(request: NextRequest) {
  try {
    const { inputMint, outputMint, amount } = await request.json();
    
    if (!inputMint || !outputMint || !amount) {
      return NextResponse.json(
        { error: "inputMint, outputMint und amount sind erforderlich" },
        { status: 400 }
      );
    }

    // Jupiter API für Preisabfrage verwenden
    const quoteUrl = `https://quote-api.jup.ag/v6/quote?inputMint=${inputMint}&outputMint=${outputMint}&amount=${amount}&slippageBps=50`;
    
    const quoteResponse = await fetch(quoteUrl);
    
    if (!quoteResponse.ok) {
      throw new Error("Fehler beim Abrufen des Quotes");
    }
    
    const quoteData = await quoteResponse.json();
    
    // Preis berechnen (Output / Input)
    const price = parseFloat(quoteData.outAmount) / parseFloat(quoteData.inAmount);
    
    return NextResponse.json({
      price,
      inAmount: quoteData.inAmount,
      outAmount: quoteData.outAmount,
      priceImpactPct: quoteData.priceImpactPct,
    });
    
  } catch (error: any) {
    console.error("Preisabfrage Fehler:", error);
    return NextResponse.json(
      { error: "Preisabfrage fehlgeschlagen", details: error.message },
      { status: 500 }
    );
  }
}
