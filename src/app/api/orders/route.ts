import { NextRequest, NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";

interface LimitOrder {
  id: string;
  walletAddress: string;
  pair: string;
  baseToken: string;
  quoteToken: string;
  type: "buy" | "sell";
  amount: number;
  limitPrice: number;
  status: "active" | "filled" | "cancelled";
  createdAt: Date;
  filledAt?: Date;
  cancelledAt?: Date;
}

const ORDERS_FILE = path.join(process.cwd(), "data", "limit-orders.json");

// Stelle sicher, dass das data Verzeichnis existiert
async function ensureDataDir() {
  const dataDir = path.dirname(ORDERS_FILE);
  try {
    await fs.access(dataDir);
  } catch {
    await fs.mkdir(dataDir, { recursive: true });
  }
}

// Lade alle Orders
async function loadOrders(): Promise<LimitOrder[]> {
  try {
    await ensureDataDir();
    const data = await fs.readFile(ORDERS_FILE, "utf-8");
    return JSON.parse(data);
  } catch {
    return [];
  }
}

// Speichere Orders
async function saveOrders(orders: LimitOrder[]): Promise<void> {
  await ensureDataDir();
  await fs.writeFile(ORDERS_FILE, JSON.stringify(orders, null, 2));
}

// GET: Hole Orders für eine Wallet
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const walletAddress = searchParams.get("wallet");
    
    if (!walletAddress) {
      return NextResponse.json(
        { error: "Wallet-Adresse ist erforderlich" },
        { status: 400 }
      );
    }

    const orders = await loadOrders();
    const walletOrders = orders.filter(order => order.walletAddress === walletAddress);
    
    return NextResponse.json({
      orders: walletOrders,
      total: walletOrders.length
    });

  } catch (error: unknown) {
    console.error("Fehler beim Laden der Orders:", error);
    const errorMessage = error instanceof Error ? error.message : 'Unbekannter Fehler';
    return NextResponse.json(
      { error: "Fehler beim Laden der Orders", details: errorMessage },
      { status: 500 }
    );
  }
}

// POST: Erstelle neue Limit Order
export async function POST(request: NextRequest) {
  try {
    const { walletAddress, baseToken, quoteToken, amount, limitPrice, type } = await request.json();
    
    if (!walletAddress || !baseToken || !quoteToken || !amount || !limitPrice || !type) {
      return NextResponse.json(
        { error: "Alle Felder sind erforderlich" },
        { status: 400 }
      );
    }

    // Hole Token-Metadaten für Symbol-Namen
    const tokenListResponse = await fetch("https://token.jup.ag/strict");
    const allTokens = await tokenListResponse.json();
    
    const baseTokenInfo = allTokens.find((t: any) => t.address === baseToken);
    const quoteTokenInfo = allTokens.find((t: any) => t.address === quoteToken);
    
    const pair = `${baseTokenInfo?.symbol || "Unknown"}/${quoteTokenInfo?.symbol || "Unknown"}`;

    const newOrder: LimitOrder = {
      id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
      walletAddress,
      pair,
      baseToken,
      quoteToken,
      type,
      amount: parseFloat(amount),
      limitPrice: parseFloat(limitPrice),
      status: "active",
      createdAt: new Date()
    };

    const orders = await loadOrders();
    orders.push(newOrder);
    await saveOrders(orders);

    console.log("Neue Limit Order erstellt:", {
      id: newOrder.id,
      pair: newOrder.pair,
      type: newOrder.type,
      amount: newOrder.amount,
      limitPrice: newOrder.limitPrice
    });

    return NextResponse.json({
      success: true,
      order: newOrder,
      message: `Limit Order für ${pair} erstellt`
    });

  } catch (error: unknown) {
    console.error("Fehler beim Erstellen der Limit Order:", error);
    const errorMessage = error instanceof Error ? error.message : 'Unbekannter Fehler';
    return NextResponse.json(
      { error: "Fehler beim Erstellen der Limit Order", details: errorMessage },
      { status: 500 }
    );
  }
}

// DELETE: Storniere Limit Order
export async function DELETE(request: NextRequest) {
  try {
    const { orderId } = await request.json();
    
    if (!orderId) {
      return NextResponse.json(
        { error: "Order-ID ist erforderlich" },
        { status: 400 }
      );
    }

    const orders = await loadOrders();
    const orderIndex = orders.findIndex(order => order.id === orderId);
    
    if (orderIndex === -1) {
      return NextResponse.json(
        { error: "Order nicht gefunden" },
        { status: 404 }
      );
    }

    const order = orders[orderIndex];
    if (order.status !== "active") {
      return NextResponse.json(
        { error: "Nur aktive Orders können storniert werden" },
        { status: 400 }
      );
    }

    // Order als storniert markieren
    orders[orderIndex] = {
      ...order,
      status: "cancelled",
      cancelledAt: new Date()
    };

    await saveOrders(orders);

    console.log("Limit Order storniert:", {
      id: orderId,
      pair: order.pair
    });

    return NextResponse.json({
      success: true,
      message: `Order ${orderId} erfolgreich storniert`
    });

  } catch (error: unknown) {
    console.error("Fehler beim Stornieren der Order:", error);
    const errorMessage = error instanceof Error ? error.message : 'Unbekannter Fehler';
    return NextResponse.json(
      { error: "Fehler beim Stornieren der Order", details: errorMessage },
      { status: 500 }
    );
  }
}
