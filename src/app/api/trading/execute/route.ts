import { NextRequest, NextResponse } from "next/server";
import { getNetworkConfig, NetworkType } from "@/config/network";

interface SwapRequest {
  walletAddress: string;
  baseToken: string;
  quoteToken: string;
  amount: number;
  type: "buy" | "sell";
  slippage: number;
  network?: NetworkType; // Optionales Netzwerk-Override
}

export async function POST(request: NextRequest) {
  let requestData: SwapRequest | null = null;
  
  try {
    requestData = await request.json();
    if (!requestData) {
      throw new Error("Invalid request data");
    }
    
    const { walletAddress, baseToken, quoteToken, amount, type, slippage, network } = requestData;
    
    // Bestimme Netzwerk-Konfiguration
    const networkType = network || 'devnet'; // Default zu Devnet für Sicherheit
    const networkConfig = getNetworkConfig(networkType);
    
    console.log("Trading request received:", { 
      walletAddress, 
      baseToken, 
      quoteToken, 
      amount, 
      type, 
      slippage,
      network: networkConfig.name,
      rpcEndpoint: networkConfig.rpcEndpoint
    });
    
    if (!walletAddress || !baseToken || !quoteToken || !amount || !type || slippage === undefined) {
      console.error("Missing required fields:", { walletAddress, baseToken, quoteToken, amount, type, slippage });
      return NextResponse.json({
        success: false,
        error: "Fehlende Pflichtfelder",
        details: "walletAddress, baseToken, quoteToken, amount, type und slippage sind erforderlich"
      }, { status: 400 });
    }

    // Bestimme Input/Output Token basierend auf Buy/Sell
    const inputMint = type === "buy" ? quoteToken : baseToken;
    const outputMint = type === "buy" ? baseToken : quoteToken;
    
    // Hole Token-Metadaten für Decimal-Berechnung (mit besserer Fallback-Logik)
    let inputDecimals = 9; // Standard
    let outputDecimals = 9; // Standard
    let inputTokenInfo = null;
    let outputTokenInfo = null;

    try {
      const tokenListResponse = await fetch("https://token.jup.ag/strict");
      if (tokenListResponse.ok) {
        const allTokens = await tokenListResponse.json();
        inputTokenInfo = allTokens.find((t: { address: string; decimals?: number }) => t.address === inputMint);
        outputTokenInfo = allTokens.find((t: { address: string; decimals?: number }) => t.address === outputMint);
        
        if (inputTokenInfo) inputDecimals = inputTokenInfo.decimals;
        if (outputTokenInfo) outputDecimals = outputTokenInfo.decimals;
      }
    } catch (error) {
      console.warn("Jupiter token list not available, using defaults:", error);
    }

    // Für unbekannte Tokens: Versuche Decimals über das konfigurierte Netzwerk zu ermitteln
    if (!inputTokenInfo || !outputTokenInfo) {
      try {
        const connection = new (await import('@solana/web3.js')).Connection(networkConfig.rpcEndpoint);
        
        if (!inputTokenInfo && inputMint !== 'So11111111111111111111111111111111111111112') {
          try {
            const mintInfo = await connection.getParsedAccountInfo(new (await import('@solana/web3.js')).PublicKey(inputMint));
            if (mintInfo.value?.data && 'parsed' in mintInfo.value.data) {
              const parsedData = mintInfo.value.data as { parsed: { info: { decimals: number } } };
              inputDecimals = parsedData.parsed.info.decimals;
              console.log(`Input token decimals from ${networkConfig.name} RPC: ${inputDecimals}`);
            }
          } catch (e) {
            console.warn("Could not fetch input token decimals from RPC:", e);
          }
        }
        
        if (!outputTokenInfo && outputMint !== 'So11111111111111111111111111111111111111112') {
          try {
            const mintInfo = await connection.getParsedAccountInfo(new (await import('@solana/web3.js')).PublicKey(outputMint));
            if (mintInfo.value?.data && 'parsed' in mintInfo.value.data) {
              const parsedData = mintInfo.value.data as { parsed: { info: { decimals: number } } };
              outputDecimals = parsedData.parsed.info.decimals;
              console.log(`Output token decimals from ${networkConfig.name} RPC: ${outputDecimals}`);
            }
          } catch (e) {
            console.warn("Could not fetch output token decimals from RPC:", e);
          }
        }
      } catch (error) {
        console.warn(`${networkConfig.name} RPC not available, using defaults:`, error);
      }
    }
    
    console.log("Token Info:", {
      inputMint,
      outputMint,
      inputTokenFound: !!inputTokenInfo,
      outputTokenFound: !!outputTokenInfo,
      inputDecimals,
      outputDecimals
    });
    
    // Berechne Amount in kleinster Einheit
    const inputAmount = Math.floor(amount * Math.pow(10, inputDecimals));
    
    console.log("Trading Request:", {
      type,
      inputMint,
      outputMint,
      inputAmount,
      inputDecimals,
      outputDecimals,
      originalAmount: amount
    });

    // Schritt 1: Quote von Jupiter holen (für das konfigurierte Netzwerk)
    const slippageBps = slippage; // slippage ist bereits in BPS
    const quoteUrl = `${networkConfig.jupiterApiBase}/quote?inputMint=${inputMint}&outputMint=${outputMint}&amount=${inputAmount}&slippageBps=${slippageBps}`;
    
    console.log("Requesting quote from", networkConfig.name, ":", quoteUrl);
    
    const quoteResponse = await fetch(quoteUrl);
    if (!quoteResponse.ok) {
      const errorText = await quoteResponse.text();
      console.error("Quote API Error:", {
        status: quoteResponse.status,
        statusText: quoteResponse.statusText,
        url: quoteUrl,
        errorText,
        requestData: { inputMint, outputMint, inputAmount, slippageBps }
      });
      
      let userFriendlyError = "Quote konnte nicht abgerufen werden";
      if (quoteResponse.status === 400) {
        userFriendlyError = "Ungültige Handelsparameter. Bitte prüfen Sie Token und Menge.";
      } else if (quoteResponse.status === 404) {
        userFriendlyError = "Handelsroute nicht verfügbar. Token möglicherweise nicht unterstützt.";
      } else if (quoteResponse.status >= 500) {
        userFriendlyError = "Jupiter-Service vorübergehend nicht verfügbar. Bitte versuchen Sie es später erneut.";
      }
      
      return NextResponse.json({
        success: false,
        error: userFriendlyError,
        details: `Jupiter Quote API Error ${quoteResponse.status}: ${errorText}`,
        debug: {
          inputToken: inputMint,
          outputToken: outputMint,
          amount: inputAmount,
          slippage: slippageBps
        }
      }, { status: 500 });
    }
    
    const quoteData = await quoteResponse.json();
    
    if (!quoteData || !quoteData.outAmount) {
      console.error("Invalid quote data:", quoteData);
      return NextResponse.json({
        success: false,
        error: "Ungültige Quote-Daten",
        details: "Jupiter API hat keine gültige Quote zurückgegeben"
      }, { status: 500 });
    }
    
    console.log("Jupiter Quote:", {
      inAmount: quoteData.inAmount,
      outAmount: quoteData.outAmount,
      priceImpactPct: quoteData.priceImpactPct,
      // Zusätzliche Debugging-Informationen
      swapMode: quoteData.swapMode,
      routePlan: quoteData.routePlan?.length || 0,
      contextSlot: quoteData.contextSlot,
      timeTaken: quoteData.timeTaken
    });

    // Schritt 2: Swap-Transaction erstellen (mit Standard-Gas-Gebühren)
    const swapResponse = await fetch(`${networkConfig.jupiterApiBase}/swap`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        quoteResponse: quoteData,
        userPublicKey: walletAddress,
        wrapAndUnwrapSol: true,
        // KEINE manuellen Gas-Gebühren - lasse Jupiter optimale Werte bestimmen
        // computeUnitPriceMicroLamports: 5000, // Entfernt für Standard-Gebühren
        asLegacyTransaction: false,
        // Weitere Optimierungen
        dynamicComputeUnitLimit: true,
        skipUserAccountsRpcCalls: false
      }),
    });

    if (!swapResponse.ok) {
      const errorText = await swapResponse.text();
      console.error("Swap API Error:", {
        status: swapResponse.status,
        statusText: swapResponse.statusText,
        errorText,
        quoteData: {
          inAmount: quoteData.inAmount,
          outAmount: quoteData.outAmount,
          priceImpactPct: quoteData.priceImpactPct
        }
      });
      
      let userFriendlyError = "Swap-Transaction konnte nicht erstellt werden";
      if (swapResponse.status === 400) {
        if (errorText.includes("insufficient") || errorText.toLowerCase().includes("balance")) {
          userFriendlyError = "Unzureichende Balance. Bitte überprüfen Sie:\n• Token-Balance für den Verkauf\n• SOL-Balance für Transaction Fees (mindestens 0.01 SOL)";
        } else if (errorText.includes("slippage")) {
          userFriendlyError = "Slippage-Toleranz zu niedrig. Erhöhen Sie die Slippage-Einstellung.";
        } else if (errorText.includes("INVALID_COMPUTE_UNIT_PRICE")) {
          userFriendlyError = "Jupiter API Konfigurationsfehler. Dies ist ein temporäres Problem.";
        } else {
          userFriendlyError = "Ungültige Handelsparameter. Bitte prüfen Sie Ihre Eingaben.";
        }
      } else if (swapResponse.status === 404) {
        userFriendlyError = "Handelsroute nicht mehr verfügbar. Versuchen Sie es mit einer anderen Menge.";
      } else if (swapResponse.status >= 500) {
        userFriendlyError = "Jupiter-Service überlastet. Bitte warten Sie einen Moment und versuchen Sie es erneut.";
      }
      
      return NextResponse.json({
        success: false,
        error: userFriendlyError,
        details: `Jupiter Swap API Error ${swapResponse.status}: ${errorText}`,
        debug: {
          walletAddress,
          inputToken: inputMint,
          outputToken: outputMint,
          requestedAmount: amount,
          calculatedInputAmount: inputAmount
        }
      }, { status: 500 });
    }

    const swapResult = await swapResponse.json();
    
    if (!swapResult || !swapResult.swapTransaction) {
      console.error("Invalid swap data:", swapResult);
      return NextResponse.json({
        success: false,
        error: "Ungültige Swap-Daten",
        details: "Jupiter API hat keine gültige Swap-Transaction zurückgegeben"
      }, { status: 500 });
    }
    
    // Berechne erwartete Output-Menge in UI-Einheiten
    const expectedOutput = parseInt(quoteData.outAmount) / Math.pow(10, outputDecimals);
    
    console.log("Trade successful:", {
      inputToken: inputTokenInfo?.symbol || `Token ${inputMint.slice(0, 8)}...`,
      outputToken: outputTokenInfo?.symbol || `Token ${outputMint.slice(0, 8)}...`,
      inputAmount: amount,
      expectedOutput,
      priceImpact: quoteData.priceImpactPct
    });
    
    return NextResponse.json({
      success: true,
      transaction: swapResult.swapTransaction,
      details: {
        inputToken: inputMint,
        outputToken: outputMint,
        inputAmount: `${amount} ${inputTokenInfo?.symbol || 'Token'}`,
        expectedOutput,
        priceImpact: parseFloat(quoteData.priceImpactPct || 0),
        minimumAmountOut: parseInt(quoteData.outAmount) / Math.pow(10, outputDecimals),
        slippage: slippage / 100,
        route: quoteData.routePlan?.map((r: { swapInfo?: { label?: string } }) => r.swapInfo?.label).join(' → ') || 'Direct'
      },
      message: `${type === "buy" ? "Kauf" : "Verkauf"} von ${amount} ${inputTokenInfo?.symbol || 'Token'} erfolgreich vorbereitet`
    });

  } catch (error: unknown) {
    console.error("Trading Execute Fehler:", {
      error,
      stack: error instanceof Error ? error.stack : undefined,
      requestData: requestData || "Request data not available"
    });
    
    let userFriendlyError = "Unbekannter Server-Fehler";
    let details = "Ein unerwarteter Fehler ist aufgetreten";
    
    if (error instanceof Error) {
      if (error.message.includes("fetch")) {
        userFriendlyError = "Netzwerk-Verbindungsfehler";
        details = "Überprüfen Sie Ihre Internetverbindung und versuchen Sie es erneut";
      } else if (error.message.includes("JSON")) {
        userFriendlyError = "Datenformat-Fehler";
        details = "Ungültige API-Antwort erhalten";
      } else {
        details = error.message;
      }
    }
    
    return NextResponse.json({
      success: false,
      error: userFriendlyError, 
      details,
      debug: {
        timestamp: new Date().toISOString(),
        errorType: error instanceof Error ? error.constructor.name : typeof error
      }
    }, { status: 500 });
  }
}
