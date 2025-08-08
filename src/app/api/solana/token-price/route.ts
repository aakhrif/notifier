import { NextRequest, NextResponse } from "next/server";

interface JupiterToken {
  address: string;
  symbol: string;
  name: string;
  decimals: number;
  logoURI?: string;
  tags?: string[];
}

export async function POST(request: NextRequest) {
  try {
    const { tokenAddress } = await request.json();
    
    if (!tokenAddress) {
      return NextResponse.json(
        { error: "Token-Adresse ist erforderlich" },
        { status: 400 }
      );
    }

    // Methode 1: Versuche Jupiter Price API v2
    try {
      const priceResponse = await fetch(
        `https://api.jup.ag/price/v2?ids=${tokenAddress}`,
        {
          headers: {
            'Accept': 'application/json',
          },
          signal: AbortSignal.timeout(5000) // 5 Sekunden Timeout
        }
      );

      if (priceResponse.ok) {
        const priceData = await priceResponse.json();
        
        if (priceData.data && priceData.data[tokenAddress]) {
          const tokenPriceData = priceData.data[tokenAddress];
          
          return NextResponse.json({
            tokenAddress,
            priceUSD: tokenPriceData.price,
            source: "jupiter-price-v2",
            timestamp: new Date().toISOString(),
            extraInfo: {
              marketCap: tokenPriceData.marketCap,
              volume24h: tokenPriceData.volume24h
            }
          });
        }
      }
    } catch (error) {
      console.log("Jupiter Price API v2 nicht verfügbar, versuche Fallback...", error);
    }

    // Methode 2: Fallback über Jupiter Quote API mit USDC (mit verbesserter Decimal-Erkennung)
    try {
      const USDC_ADDRESS = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
      
      // Standard-Decimals: 9 (falls Token nicht gefunden)
      let tokenDecimals = 9;
      
      // Zuerst Token-Metadaten aus Jupiter Liste abrufen
      try {
        const tokenListResponse = await fetch("https://token.jup.ag/strict");
        if (tokenListResponse.ok) {
          const allTokens: JupiterToken[] = await tokenListResponse.json();
          const tokenInfo = allTokens.find((t: JupiterToken) => t.address === tokenAddress);
          if (tokenInfo) {
            tokenDecimals = tokenInfo.decimals;
            console.log(`Token decimals from Jupiter list: ${tokenDecimals}`);
          }
        }
      } catch (e) {
        console.warn("Jupiter token list not available:", e);
      }
      
      // Falls nicht in Jupiter Liste: Versuche RPC Abruf für echte Decimals
      if (tokenDecimals === 9 && tokenAddress !== "So11111111111111111111111111111111111111112") {
        try {
          const connection = new (await import('@solana/web3.js')).Connection('https://api.mainnet-beta.solana.com');
          const mintInfo = await connection.getParsedAccountInfo(new (await import('@solana/web3.js')).PublicKey(tokenAddress));
          if (mintInfo.value?.data && 'parsed' in mintInfo.value.data) {
            const parsedData = mintInfo.value.data as { parsed: { info: { decimals: number } } };
            tokenDecimals = parsedData.parsed.info.decimals;
            console.log(`Token decimals from RPC: ${tokenDecimals}`);
          }
        } catch (e) {
          console.warn("Could not fetch token decimals from RPC:", e);
        }
      }
      
      // 1 Token in der kleinsten Einheit berechnen
      const oneTokenAmount = Math.pow(10, tokenDecimals);
      
      const quoteUrl = `https://quote-api.jup.ag/v6/quote?inputMint=${tokenAddress}&outputMint=${USDC_ADDRESS}&amount=${oneTokenAmount}&slippageBps=50`;
      const fallbackResponse = await fetch(quoteUrl, {
        signal: AbortSignal.timeout(5000)
      });
      
      if (fallbackResponse.ok) {
        const quoteData = await fallbackResponse.json();
        const outputAmount = parseInt(quoteData.outAmount) / 1e6; // USDC hat 6 Decimals
        
        // Das ist bereits der korrekte Preis für 1 ganzen Token
        const actualPricePerToken = outputAmount;
        
        // Debugging: Log alle Werte
        console.log("Token Decimals:", tokenDecimals);
        console.log("Input Amount (kleinste Einheit):", oneTokenAmount);
        console.log("Output Amount (raw USDC micro-units):", quoteData.outAmount);
        console.log("Output Amount (USDC):", outputAmount);
        console.log("Actual Price per Token:", actualPricePerToken);
        
        return NextResponse.json({
          tokenAddress,
          priceUSD: actualPricePerToken,
          source: "jupiter-quote",
          timestamp: new Date().toISOString(),
          tokenDecimals,
          inputAmount: oneTokenAmount,
          debug: {
            rawOutput: quoteData.outAmount,
            processedOutput: outputAmount,
            actualPricePerToken: actualPricePerToken
          }
        });
      }
    } catch (error) {
      console.log("Jupiter Quote API nicht verfügbar:", error);
    }

    // Methode 3: CoinGecko API als letzter Fallback (für bekannte Token)
    try {
      // Versuche über Token-Metadaten die CoinGecko ID zu finden
      const response = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd`, {
        signal: AbortSignal.timeout(5000)
      });
      
      if (response.ok) {
        // Für SOL als Beispiel
        if (tokenAddress === "So11111111111111111111111111111111111111112") {
          const data = await response.json();
          return NextResponse.json({
            tokenAddress,
            priceUSD: data.solana.usd,
            source: "coingecko",
            timestamp: new Date().toISOString()
          });
        }
      }
    } catch (error) {
      console.log("CoinGecko API nicht verfügbar:", error);
    }

    return NextResponse.json(
      { error: "Preis konnte nicht abgerufen werden - alle APIs nicht verfügbar" },
      { status: 404 }
    );
    
  } catch (error: unknown) {
    console.error("Token Price Fehler:", error);
    const errorMessage = error instanceof Error ? error.message : 'Unbekannter Fehler';
    return NextResponse.json(
      { error: "Preis konnte nicht abgerufen werden", details: errorMessage },
      { status: 500 }
    );
  }
}
