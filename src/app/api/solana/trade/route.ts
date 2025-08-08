import { NextRequest, NextResponse } from "next/server";
import { Connection, Keypair, VersionedTransaction } from "@solana/web3.js";
import bs58 from "bs58";
import fetch from "cross-fetch";

const SOLANA_RPC_ENDPOINT = process.env.SOLANA_RPC_ENDPOINT || "https://api.mainnet-beta.solana.com";
const JUPITER_API_URL = "https://quote-api.jup.ag/v6";

interface JupiterQuoteResponse {
  inputMint: string;
  inAmount: string;
  outputMint: string;
  outAmount: string;
  otherAmountThreshold: string;
  swapMode: string;
  slippageBps: number;
  platformFee?: any;
  priceImpactPct: string;
  routePlan: any[];
}

interface JupiterSwapResponse {
  swapTransaction: string;
}

// POST /api/solana/trade - Trade ausführen (Buy/Sell)
export async function POST(req: NextRequest) {
  try {
    const { privateKey, action, inputMint, outputMint, amount, slippageBps = 300 } = await req.json();
    
    if (!privateKey || !action || !inputMint || !outputMint || !amount) {
      return NextResponse.json({ 
        error: "Private Key, Action, Input Mint, Output Mint und Amount sind erforderlich" 
      }, { status: 400 });
    }

    // Verbindung zu Solana RPC
    const connection = new Connection(SOLANA_RPC_ENDPOINT);
    
    // Wallet aus Private Key erstellen
    const keypair = Keypair.fromSecretKey(bs58.decode(privateKey));
    const wallet = keypair.publicKey;
    
    // 1. Quote von Jupiter API abrufen
    const quoteParams = new URLSearchParams({
      inputMint: inputMint,
      outputMint: outputMint,
      amount: amount.toString(),
      slippageBps: slippageBps.toString(),
    });
    
    const quoteResponse = await fetch(`${JUPITER_API_URL}/quote?${quoteParams}`);
    if (!quoteResponse.ok) {
      throw new Error(`Jupiter Quote Fehler: ${quoteResponse.statusText}`);
    }
    
    const quoteData: JupiterQuoteResponse = await quoteResponse.json();
    
    // 2. Swap Transaction von Jupiter API erstellen
    const swapResponse = await fetch(`${JUPITER_API_URL}/swap`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        quoteResponse: quoteData,
        userPublicKey: wallet.toString(),
        wrapAndUnwrapSol: true,
        prioritizationFeeLamports: "auto",
      }),
    });
    
    if (!swapResponse.ok) {
      throw new Error(`Jupiter Swap Fehler: ${swapResponse.statusText}`);
    }
    
    const swapData: JupiterSwapResponse = await swapResponse.json();
    
    // 3. Transaction deserialisieren und signieren
    const swapTransactionBuf = Buffer.from(swapData.swapTransaction, "base64");
    const transaction = VersionedTransaction.deserialize(swapTransactionBuf);
    
    // Transaction signieren
    transaction.sign([keypair]);
    
    // 4. Transaction an Solana Network senden
    const signature = await connection.sendTransaction(transaction);
    
    // 5. Transaction bestätigen
    const confirmation = await connection.confirmTransaction(signature, "confirmed");
    
    return NextResponse.json({
      success: true,
      signature,
      quote: {
        inputAmount: quoteData.inAmount,
        outputAmount: quoteData.outAmount,
        priceImpact: quoteData.priceImpactPct,
        slippage: slippageBps
      },
      confirmation: confirmation.value,
      explorerUrl: `https://solscan.io/tx/${signature}`
    });
    
  } catch (error) {
    console.error("Trade Fehler:", error);
    return NextResponse.json({ 
      error: `Trade fehlgeschlagen: ${error instanceof Error ? error.message : "Unbekannter Fehler"}` 
    }, { status: 500 });
  }
}
