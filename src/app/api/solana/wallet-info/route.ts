import { NextRequest, NextResponse } from "next/server";
import { Connection, PublicKey } from "@solana/web3.js";

export async function POST(request: NextRequest) {
  try {
    const { publicKey } = await request.json();
    
    if (!publicKey) {
      return NextResponse.json(
        { error: "Public Key ist erforderlich" },
        { status: 400 }
      );
    }

    const rpcEndpoint = process.env.SOLANA_RPC_ENDPOINT || "https://api.mainnet-beta.solana.com";
    const connection = new Connection(rpcEndpoint);
    
    // Public Key validieren
    const pubKey = new PublicKey(publicKey);
    
    // Balance abrufen
    const balance = await connection.getBalance(pubKey);
    const balanceInSol = balance / 1e9; // Lamports zu SOL konvertieren
    
    return NextResponse.json({
      publicKey: pubKey.toString(),
      balance: balanceInSol,
      rpcEndpoint,
    });
    
  } catch (error: any) {
    console.error("Wallet Info Fehler:", error);
    return NextResponse.json(
      { error: "Wallet-Informationen konnten nicht abgerufen werden", details: error.message },
      { status: 500 }
    );
  }
}
