import { NextRequest, NextResponse } from "next/server";
import { readFile, writeFile } from "fs/promises";
import { join } from "path";

interface CustomToken {
  address: string;
  symbol: string;
  name: string;
  decimals: number;
  logoURI?: string;
  addedAt: string;
}

const CUSTOM_TOKENS_FILE = join(process.cwd(), 'data', 'custom-tokens.json');

// GET: Benutzerdefinierte Token abrufen
export async function GET() {
  try {
    const fileContent = await readFile(CUSTOM_TOKENS_FILE, 'utf-8');
    const customTokens: CustomToken[] = JSON.parse(fileContent);
    
    return NextResponse.json({
      tokens: customTokens,
      count: customTokens.length
    });
  } catch {
    // Datei existiert noch nicht - leere Liste zurückgeben
    return NextResponse.json({
      tokens: [],
      count: 0
    });
  }
}

// POST: Neuen benutzerdefinierten Token hinzufügen
export async function POST(request: NextRequest) {
  try {
    const { address, symbol, name, decimals, logoURI } = await request.json();
    
    if (!address || !symbol || !name || decimals === undefined) {
      return NextResponse.json(
        { error: "Adresse, Symbol, Name und Decimals sind erforderlich" },
        { status: 400 }
      );
    }
    
    // Bestehende Token laden
    let customTokens: CustomToken[] = [];
    try {
      const fileContent = await readFile(CUSTOM_TOKENS_FILE, 'utf-8');
      customTokens = JSON.parse(fileContent);
    } catch {
      // Datei existiert noch nicht
    }
    
    // Prüfen ob Token bereits existiert
    const existingToken = customTokens.find(token => token.address === address);
    if (existingToken) {
      return NextResponse.json(
        { error: "Token bereits in der Liste vorhanden" },
        { status: 409 }
      );
    }
    
    // Neuen Token hinzufügen
    const newToken: CustomToken = {
      address,
      symbol,
      name,
      decimals,
      logoURI,
      addedAt: new Date().toISOString()
    };
    
    customTokens.push(newToken);
    
    // Datei speichern
    await writeFile(CUSTOM_TOKENS_FILE, JSON.stringify(customTokens, null, 2));
    
    return NextResponse.json({
      success: true,
      token: newToken
    });
    
  } catch (error: unknown) {
    console.error("Custom Token hinzufügen Fehler:", error);
    const errorMessage = error instanceof Error ? error.message : 'Unbekannter Fehler';
    return NextResponse.json(
      { error: "Token konnte nicht hinzugefügt werden", details: errorMessage },
      { status: 500 }
    );
  }
}

// DELETE: Benutzerdefinierten Token entfernen
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const address = searchParams.get('address');
    
    if (!address) {
      return NextResponse.json(
        { error: "Token-Adresse ist erforderlich" },
        { status: 400 }
      );
    }
    
    // Bestehende Token laden
    let customTokens: CustomToken[] = [];
    try {
      const fileContent = await readFile(CUSTOM_TOKENS_FILE, 'utf-8');
      customTokens = JSON.parse(fileContent);
    } catch {
      return NextResponse.json(
        { error: "Keine benutzerdefinierten Token gefunden" },
        { status: 404 }
      );
    }
    
    // Token entfernen
    const filteredTokens = customTokens.filter(token => token.address !== address);
    
    if (filteredTokens.length === customTokens.length) {
      return NextResponse.json(
        { error: "Token nicht gefunden" },
        { status: 404 }
      );
    }
    
    // Datei speichern
    await writeFile(CUSTOM_TOKENS_FILE, JSON.stringify(filteredTokens, null, 2));
    
    return NextResponse.json({
      success: true,
      removedAddress: address
    });
    
  } catch (error: unknown) {
    console.error("Custom Token entfernen Fehler:", error);
    const errorMessage = error instanceof Error ? error.message : 'Unbekannter Fehler';
    return NextResponse.json(
      { error: "Token konnte nicht entfernt werden", details: errorMessage },
      { status: 500 }
    );
  }
}
