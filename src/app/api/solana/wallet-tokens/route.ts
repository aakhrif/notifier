import { NextRequest, NextResponse } from "next/server";
import { Connection, PublicKey } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";

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
    
    const pubKey = new PublicKey(publicKey);
    
    // Token Accounts abrufen
    const tokenAccounts = await connection.getParsedTokenAccountsByOwner(pubKey, {
      programId: TOKEN_PROGRAM_ID,
    });

    const walletTokens = [];
    
    // SOL Balance hinzufügen
    const solBalance = await connection.getBalance(pubKey);
    walletTokens.push({
      address: "So11111111111111111111111111111111111111112", // SOL Mint
      symbol: "SOL",
      name: "Solana",
      decimals: 9,
      balance: solBalance / 1e9,
      uiAmount: solBalance / 1e9
    });

    // Token Accounts verarbeiten
    for (const account of tokenAccounts.value) {
      const tokenInfo = account.account.data.parsed.info;
      const tokenAmount = tokenInfo.tokenAmount;
      
      // Nur Tokens mit Balance > 0 anzeigen
      if (parseFloat(tokenAmount.uiAmountString || "0") > 0) {
        try {
          // Token Metadata von Jupiter API abrufen
          const tokenListResponse = await fetch("https://token.jup.ag/strict");
          const tokenList = await tokenListResponse.json();
          const tokenMetadata = tokenList.find((t: any) => t.address === tokenInfo.mint);
          
          walletTokens.push({
            address: tokenInfo.mint,
            symbol: tokenMetadata?.symbol || "UNKNOWN",
            name: tokenMetadata?.name || "Unknown Token",
            decimals: tokenAmount.decimals,
            balance: parseFloat(tokenAmount.uiAmountString || "0"),
            uiAmount: parseFloat(tokenAmount.uiAmountString || "0")
          });
        } catch (error) {
          // Fallback für unbekannte Tokens
          walletTokens.push({
            address: tokenInfo.mint,
            symbol: tokenInfo.mint.slice(0, 8),
            name: "Unknown Token",
            decimals: tokenAmount.decimals,
            balance: parseFloat(tokenAmount.uiAmountString || "0"),
            uiAmount: parseFloat(tokenAmount.uiAmountString || "0")
          });
        }
      }
    }

    return NextResponse.json({
      walletTokens: walletTokens.sort((a, b) => b.balance - a.balance) // Nach Balance sortieren
    });
    
  } catch (error: any) {
    console.error("Wallet Tokens Fehler:", error);
    return NextResponse.json(
      { error: "Wallet-Tokens konnten nicht abgerufen werden", details: error.message },
      { status: 500 }
    );
  }
}
