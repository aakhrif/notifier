import { NextRequest, NextResponse } from "next/server";

interface JupiterToken {
  address: string;
  symbol: string;
  name: string;
  decimals: number;
  logoURI?: string;
  tags?: string[];
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q') || '';
    const address = searchParams.get('address');
    
    // Wenn eine spezifische Adresse gesucht wird
    if (address) {
      try {
        // Jupiter Token List abrufen
        const tokenListResponse = await fetch("https://token.jup.ag/strict");
        const allTokens = await tokenListResponse.json();
        
        const token = allTokens.find((t: JupiterToken) => t.address === address);
        if (token) {
          return NextResponse.json({
            tokens: [{
              address: token.address,
              symbol: token.symbol,
              name: token.name,
              decimals: token.decimals,
              logoURI: token.logoURI
            }],
            count: 1
          });
        }
        
        // Fallback: Token-Info direkt von Solana abrufen wenn nicht in Jupiter Liste
        return NextResponse.json({
          tokens: [{
            address: address,
            symbol: address.slice(0, 8) + "...",
            name: "Custom Token",
            decimals: 9, // Standard Decimals
            logoURI: null
          }],
          count: 1
        });
      } catch (err) {
        console.error("Token search error:", err);
        return NextResponse.json(
          { error: "Token-Adresse konnte nicht gefunden werden" },
          { status: 404 }
        );
      }
    }
    
    // Jupiter Token List abrufen
    const tokenListResponse = await fetch("https://token.jup.ag/strict");
    const allTokens: JupiterToken[] = await tokenListResponse.json();
    
    let filteredTokens = allTokens;
    
    // Nach Symbol, Name oder Adresse filtern wenn Suchbegriff vorhanden
    if (query && query.length > 0) {
      filteredTokens = allTokens.filter((token: JupiterToken) => {
        const searchTerm = query.toLowerCase();
        
        // Exakte Adressensuche hat höchste Priorität
        if (token.address.toLowerCase() === searchTerm) {
          return true;
        }
        
        // Dann Präfix-Suche für Adressen (mindestens 8 Zeichen)
        if (searchTerm.length >= 8 && token.address.toLowerCase().startsWith(searchTerm)) {
          return true;
        }
        
        // Standard-Suche in Symbol und Name
        return (
          token.symbol.toLowerCase().includes(searchTerm) ||
          token.name.toLowerCase().includes(searchTerm) ||
          // Enthält-Suche für Adressen (für Copy-Paste Unterstützung)
          token.address.toLowerCase().includes(searchTerm)
        );
      });
      
      // Sortiere Suchergebnisse: Exakte Treffer zuerst, dann Präfix-Treffer, dann Rest
      filteredTokens.sort((a: JupiterToken, b: JupiterToken) => {
        const searchTerm = query.toLowerCase();
        
        // Exakte Adressenübereinstimmung hat höchste Priorität
        const aExactAddress = a.address.toLowerCase() === searchTerm;
        const bExactAddress = b.address.toLowerCase() === searchTerm;
        if (aExactAddress && !bExactAddress) return -1;
        if (!aExactAddress && bExactAddress) return 1;
        
        // Dann exakte Symbol-Übereinstimmung
        const aExactSymbol = a.symbol.toLowerCase() === searchTerm;
        const bExactSymbol = b.symbol.toLowerCase() === searchTerm;
        if (aExactSymbol && !bExactSymbol) return -1;
        if (!aExactSymbol && bExactSymbol) return 1;
        
        // Dann Präfix-Übereinstimmung für Symbole
        const aStartsSymbol = a.symbol.toLowerCase().startsWith(searchTerm);
        const bStartsSymbol = b.symbol.toLowerCase().startsWith(searchTerm);
        if (aStartsSymbol && !bStartsSymbol) return -1;
        if (!aStartsSymbol && bStartsSymbol) return 1;
        
        // Schließlich alphabetisch nach Symbol
        return a.symbol.localeCompare(b.symbol);
      });
    }
    
    // Top Token und bekannte Token priorisieren
    const priorityTokens = [
      'So11111111111111111111111111111111111111112', // SOL
      'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', // USDC
      'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB', // USDT
      'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263', // BONK
      'JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN',  // JUP
      'mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So',  // mSOL
      '7vfCXTUXx5WJV5JADk17DUJ4ksgau7utNKj4b963voxs', // ETH (Wormhole)
      '9n4nbM75f5Ui33ZbPYXn59EwSgE8CGsHtAeTH5YFeJ9E'  // BTC (Wormhole)
    ];
    
    // Sortierung: Priorität, dann Liquidität/Volume
    const sortedTokens = filteredTokens.sort((a: JupiterToken, b: JupiterToken) => {
      const aPriority = priorityTokens.indexOf(a.address);
      const bPriority = priorityTokens.indexOf(b.address);
      
      if (aPriority !== -1 && bPriority !== -1) {
        return aPriority - bPriority;
      }
      if (aPriority !== -1) return -1;
      if (bPriority !== -1) return 1;
      
      // Nach Name alphabetisch sortieren
      return a.symbol.localeCompare(b.symbol);
    });
    
    // Auf die ersten 100 Ergebnisse begrenzen
    const limitedTokens = sortedTokens.slice(0, 100).map((token: JupiterToken) => ({
      address: token.address,
      symbol: token.symbol,
      name: token.name,
      decimals: token.decimals,
      logoURI: token.logoURI
    }));
    
    return NextResponse.json({
      tokens: limitedTokens,
      count: limitedTokens.length
    });
    
  } catch (error: unknown) {
    console.error("Token Search Fehler:", error);
    const errorMessage = error instanceof Error ? error.message : 'Unbekannter Fehler';
    return NextResponse.json(
      { error: "Token-Suche fehlgeschlagen", details: errorMessage },
      { status: 500 }
    );
  }
}
