import { NextRequest, NextResponse } from "next/server";
import { Connection, Keypair, PublicKey, VersionedTransaction } from "@solana/web3.js";
import bs58 from "bs58";

const SOLANA_RPC_ENDPOINT = process.env.SOLANA_RPC_ENDPOINT || "https://api.mainnet-beta.solana.com";

// POST /api/solana/wallet-info - Wallet-Informationen abrufen
export async function POST(req: NextRequest) {
  try {
    const { privateKey } = await req.json();
    
    if (!privateKey) {
      return NextResponse.json({ error: "Private Key is required" }, { status: 400 });
    }

    // Verbindung zu Solana RPC
    const connection = new Connection(SOLANA_RPC_ENDPOINT);
    
    // Wallet aus Private Key erstellen
    const keypair = Keypair.fromSecretKey(bs58.decode(privateKey));
    const publicKey = keypair.publicKey;
    
    // Balance abrufen
    const balance = await connection.getBalance(publicKey);
    const balanceSOL = balance / 1e9; // Lamports zu SOL konvertieren
    
    return NextResponse.json({
      publicKey: publicKey.toString(),
      balance: balanceSOL,
      balanceLamports: balance,
      rpcEndpoint: SOLANA_RPC_ENDPOINT
    });
    
  } catch (error) {
    console.error("Wallet-Info Fehler:", error);
    return NextResponse.json({ 
      error: "Fehler beim Abrufen der Wallet-Informationen" 
    }, { status: 500 });
  }
}
