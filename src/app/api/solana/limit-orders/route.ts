import { NextRequest, NextResponse } from "next/server";

interface LimitOrder {
  id: string;
  userWallet: string;
  pair: string;
  baseToken: string;
  quoteToken: string;
  type: "buy" | "sell";
  amount: number;
  limitPrice: number;
  status: "active" | "filled" | "cancelled";
  createdAt: string;
  privateKey: string;
}

// In-Memory Storage für Demo (in Produktion: Datenbank verwenden)
let limitOrders: LimitOrder[] = [];

export async function GET() {
  return NextResponse.json({ orders: limitOrders });
}

export async function POST(request: NextRequest) {
  try {
    const { action, orderData } = await request.json();
    
    switch (action) {
      case "create":
        const newOrder: LimitOrder = {
          id: Date.now().toString(),
          userWallet: orderData.userWallet,
          pair: orderData.pair,
          baseToken: orderData.baseToken,
          quoteToken: orderData.quoteToken,
          type: orderData.type,
          amount: orderData.amount,
          limitPrice: orderData.limitPrice,
          status: "active",
          createdAt: new Date().toISOString(),
          privateKey: orderData.privateKey,
        };
        
        limitOrders.push(newOrder);
        
        return NextResponse.json({ 
          success: true, 
          order: { ...newOrder, privateKey: undefined } 
        });
        
      case "cancel":
        const orderId = orderData.orderId;
        const orderIndex = limitOrders.findIndex(order => order.id === orderId);
        
        if (orderIndex === -1) {
          return NextResponse.json(
            { error: "Order nicht gefunden" },
            { status: 404 }
          );
        }
        
        limitOrders[orderIndex].status = "cancelled";
        
        return NextResponse.json({ 
          success: true, 
          order: { ...limitOrders[orderIndex], privateKey: undefined }
        });
        
      case "check":
        // Prüfe alle aktiven Orders auf Ausführung
        const userWallet = orderData.userWallet;
        const userOrders = limitOrders.filter(
          order => order.userWallet === userWallet && order.status === "active"
        );
        
        // Hier würde normalerweise die Preisüberprüfung und automatische Ausführung stattfinden
        // Für Demo-Zwecke nur die aktiven Orders zurückgeben
        
        return NextResponse.json({ 
          orders: userOrders.map(order => ({ ...order, privateKey: undefined }))
        });
        
      default:
        return NextResponse.json(
          { error: "Unbekannte Aktion" },
          { status: 400 }
        );
    }
    
  } catch (error) {
    console.error("Limit Order Fehler:", error);
    return NextResponse.json(
      { error: "Limit Order Operation fehlgeschlagen" },
      { status: 500 }
    );
  }
}

// Hilfsfunktion für automatische Order-Ausführung (würde in einem Cron-Job laufen)
export async function checkAndExecuteOrders() {
  const activeOrders = limitOrders.filter(order => order.status === "active");
  
  for (const order of activeOrders) {
    try {
      // Aktuellen Preis abrufen
      const priceResponse = await fetch(`/api/solana/price`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          inputMint: order.type === "buy" ? order.quoteToken : order.baseToken,
          outputMint: order.type === "buy" ? order.baseToken : order.quoteToken,
          amount: 1000000, // 1 Token für Preisermittlung
        }),
      });
      
      if (priceResponse.ok) {
        const priceData = await priceResponse.json();
        const currentPrice = priceData.price;
        
        // Prüfen ob Order ausgeführt werden soll
        const shouldExecute = 
          (order.type === "buy" && currentPrice <= order.limitPrice) ||
          (order.type === "sell" && currentPrice >= order.limitPrice);
          
        if (shouldExecute) {
          // Order ausführen
          const tradeResponse = await fetch(`/api/solana/trade`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              privateKey: order.privateKey,
              action: order.type,
              inputMint: order.type === "buy" ? order.quoteToken : order.baseToken,
              outputMint: order.type === "buy" ? order.baseToken : order.quoteToken,
              amount: order.amount * 1e6,
              slippageBps: 300,
            }),
          });
          
          if (tradeResponse.ok) {
            // Order als ausgeführt markieren
            const orderIndex = limitOrders.findIndex(o => o.id === order.id);
            if (orderIndex !== -1) {
              limitOrders[orderIndex].status = "filled";
            }
          }
        }
      }
    } catch (error) {
      console.error(`Fehler bei Order ${order.id}:`, error);
    }
  }
}
