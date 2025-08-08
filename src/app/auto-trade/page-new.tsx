"use client";

import { useState, useCallback, useEffect } from "react";
import { useLoadingToast } from "@/components/ui/loading-toast";
import ImprovedTokenSelector from "@/components/ImprovedTokenSelector";

interface Token {
  address: string;
  symbol: string;
  name: string;
  decimals: number;
  uiAmount?: number;
}

interface WalletInfo {
  publicKey: string;
  balance: number;
  rpcEndpoint: string;
}

interface WalletProvider {
  name: string;
  icon: string;
  connect: () => Promise<{ publicKey: string }>;
  disconnect: () => Promise<void>;
}

declare global {
  interface Window {
    solana?: {
      isPhantom?: boolean;
      connect: () => Promise<{ publicKey: { toString: () => string } }>;
      disconnect: () => Promise<void>;
    };
  }
}

export default function AutoTradePage() {
  const { show, hide } = useLoadingToast();
  
  // Wallet & Authentication
  const [walletInfo, setWalletInfo] = useState<WalletInfo | null>(null);
  const [availableWallets, setAvailableWallets] = useState<WalletProvider[]>([]);
  
  // Token Data
  const [tokens, setTokens] = useState<Token[]>([]);
  const [walletTokens, setWalletTokens] = useState<Token[]>([]);
  
  // Quote Tokens (nur SOL und USDC)
  const QUOTE_TOKENS: Token[] = [
    {
      address: "So11111111111111111111111111111111111111112",
      symbol: "SOL",
      name: "Solana",
      decimals: 9,
    },
    {
      address: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
      symbol: "USDC",
      name: "USD Coin",
      decimals: 6,
    }
  ];
  
  // Trading State
  const [selectedBaseToken, setSelectedBaseToken] = useState("");
  const [selectedQuoteToken, setSelectedQuoteToken] = useState("");
  const [selectedBaseTokenPrice, setSelectedBaseTokenPrice] = useState<number | null>(null);
  const [selectedQuoteTokenPrice, setSelectedQuoteTokenPrice] = useState<number | null>(null);
  
  // Order Configuration
  const [orderType, setOrderType] = useState<"market" | "limit">("market");
  const [tradeAction, setTradeAction] = useState<"buy" | "sell">("buy");
  const [amount, setAmount] = useState("");
  const [limitPrice, setLimitPrice] = useState("");
  const [slippage, setSlippage] = useState(0.5);
  
  // Limit Orders
  const [limitOrders, setLimitOrders] = useState<any[]>([]);

  // Wallet Detection
  const detectWalletProviders = useCallback(() => {
    const providers: WalletProvider[] = [];
    
    if (typeof window !== 'undefined') {
      if (window.solana?.isPhantom) {
        providers.push({
          name: "Phantom",
          icon: "👻",
          connect: async () => {
            const response = await window.solana!.connect();
            return { publicKey: response.publicKey.toString() };
          },
          disconnect: async () => {
            await window.solana!.disconnect();
          }
        });
      }
    }
    
    setAvailableWallets(providers);
  }, []);

  // Load available tokens
  const loadTokens = useCallback(async () => {
    try {
      const response = await fetch("/api/solana/token-search?q=");
      const data = await response.json();
      setTokens(data.tokens || []);
    } catch (error) {
      console.error("Fehler beim Laden der Token:", error);
    }
  }, []);

  // Load wallet tokens
  const loadWalletTokens = useCallback(async () => {
    if (!walletInfo) return;
    
    try {
      const response = await fetch("/api/solana/wallet-tokens", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ publicKey: walletInfo.publicKey }),
      });
      
      if (response.ok) {
        const data = await response.json();
        setWalletTokens(data.walletTokens || []);
      }
    } catch (error) {
      console.error("Fehler beim Laden der Wallet-Token:", error);
    }
  }, [walletInfo]);

  // Load limit orders
  const loadLimitOrders = useCallback(async () => {
    if (!walletInfo) return;
    
    try {
      const response = await fetch(`/api/orders?wallet=${encodeURIComponent(walletInfo.publicKey)}`);
      
      if (response.ok) {
        const data = await response.json();
        setLimitOrders(data.orders || []);
      }
    } catch (error) {
      console.error("Fehler beim Laden der Limit Orders:", error);
    }
  }, [walletInfo]);

  // Fetch token price
  const fetchTokenPrice = useCallback(async (tokenAddress: string) => {
    if (!tokenAddress) return null;
    
    try {
      const response = await fetch("/api/solana/token-price", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tokenAddress }),
      });
      
      if (response.ok) {
        const data = await response.json();
        return data.priceUSD;
      }
    } catch (error) {
      console.error("Fehler beim Abrufen des Token-Preises:", error);
    }
    return null;
  }, []);

  // Execute market order
  const executeMarketOrder = async () => {
    if (!walletInfo || !selectedBaseToken || !selectedQuoteToken || !amount) {
      alert("Bitte alle Felder ausfüllen");
      return;
    }

    show("Market Order wird ausgeführt...");
    try {
      console.log("Executing trade:", {
        baseToken: selectedBaseToken,
        quoteToken: selectedQuoteToken,
        amount: parseFloat(amount),
        type: tradeAction,
        slippage: slippage * 100
      });

      const response = await fetch("/api/trading/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          walletAddress: walletInfo.publicKey,
          baseToken: selectedBaseToken,
          quoteToken: selectedQuoteToken,
          amount: parseFloat(amount),
          type: tradeAction,
          slippage: slippage * 100
        }),
      });

      const data = await response.json();
      console.log("API Response:", data);
      
      if (response.ok && data.success) {
        console.log("Swap Transaction:", data.transaction);
        console.log("Trade Details:", data.details);
        
        alert(`✅ ${data.message}\n\nTrade Details:\n- Input: ${data.details.inputAmount}\n- Expected Output: ${data.details.expectedOutput.toFixed(6)}\n- Price Impact: ${data.details.priceImpact}%\n\n⚠️ Transaction bereit für Signierung!\n(In echter Implementierung würde jetzt die Wallet geöffnet)`);
        
        setAmount("");
        loadWalletTokens();
      } else {
        const errorMsg = data.error || "Unbekannter Fehler";
        const details = data.details || response.statusText;
        console.error("Trading failed:", data);
        alert(`❌ Fehler beim Ausführen der Order:\n\n${errorMsg}\n\nDetails: ${details}\n\nStatus: ${response.status}`);
      }
    } catch (error) {
      console.error("Trading Error:", error);
      const errorMsg = error instanceof Error ? error.message : "Netzwerk-Fehler";
      alert(`❌ Market Order fehlgeschlagen:\n\n${errorMsg}\n\nBitte prüfen Sie:\n- Internetverbindung\n- Jupiter API Status\n- Token-Verfügbarkeit`);
    } finally {
      hide();
    }
  };

  // Create limit order
  const createLimitOrder = async () => {
    if (!walletInfo || !selectedBaseToken || !selectedQuoteToken || !amount || !limitPrice) {
      alert("Bitte alle Felder ausfüllen");
      return;
    }

    show("Limit Order wird erstellt...");
    try {
      const response = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          walletAddress: walletInfo.publicKey,
          baseToken: selectedBaseToken,
          quoteToken: selectedQuoteToken,
          amount: parseFloat(amount),
          limitPrice: parseFloat(limitPrice),
          type: tradeAction
        }),
      });

      const data = await response.json();
      
      if (response.ok) {
        alert(`${data.message}\n\nOrder ID: ${data.order.id}`);
        setAmount("");
        setLimitPrice("");
        loadLimitOrders();
      } else {
        alert(`Fehler: ${data.error}\n${data.details || ''}`);
      }
    } catch (error) {
      console.error("Limit Order Error:", error);
      alert("Limit Order-Erstellung fehlgeschlagen");
    } finally {
      hide();
    }
  };

  // Cancel limit order
  const cancelLimitOrder = async (orderId: string) => {
    show("Order wird storniert...");
    try {
      const response = await fetch("/api/orders", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId }),
      });

      const data = await response.json();
      
      if (response.ok) {
        alert(data.message);
        loadLimitOrders();
      } else {
        alert(`Fehler: ${data.error}`);
      }
    } catch (error) {
      console.error("Cancel Order Error:", error);
      alert("Order-Stornierung fehlgeschlagen");
    } finally {
      hide();
    }
  };

  // Connect wallet
  const connectWallet = async (provider: WalletProvider) => {
    show("Wallet wird verbunden...");
    try {
      const connection = await provider.connect();
      
      const response = await fetch("/api/solana/wallet-info", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ publicKey: connection.publicKey }),
      });

      if (response.ok) {
        const data = await response.json();
        setWalletInfo({
          publicKey: connection.publicKey,
          balance: data.balance,
          rpcEndpoint: data.rpcEndpoint
        });
      }
    } catch (error) {
      console.error("Wallet Verbindungsfehler:", error);
      alert("Wallet-Verbindung fehlgeschlagen");
    } finally {
      hide();
    }
  };

  // Disconnect wallet
  const disconnectWallet = async () => {
    try {
      if (window.solana?.disconnect) {
        await window.solana.disconnect();
      }
      setWalletInfo(null);
      setWalletTokens([]);
    } catch (error) {
      console.error("Wallet Disconnection Error:", error);
    }
  };

  // Effects
  useEffect(() => {
    detectWalletProviders();
    loadTokens();
  }, [detectWalletProviders, loadTokens]);

  useEffect(() => {
    if (walletInfo) {
      loadLimitOrders();
      loadWalletTokens();
    }
  }, [walletInfo, loadLimitOrders, loadWalletTokens]);

  useEffect(() => {
    if (selectedBaseToken) {
      fetchTokenPrice(selectedBaseToken).then(setSelectedBaseTokenPrice);
    }
  }, [selectedBaseToken, fetchTokenPrice]);

  useEffect(() => {
    if (selectedQuoteToken) {
      fetchTokenPrice(selectedQuoteToken).then(setSelectedQuoteTokenPrice);
    }
  }, [selectedQuoteToken, fetchTokenPrice]);

  return (
    <main className="min-h-screen bg-gray-50 p-4">
      {/* Wallet Integration - Top Right */}
      <div className="fixed top-4 right-4 z-50">
        {!walletInfo ? (
          <div className="space-x-2">
            {availableWallets.map((wallet) => (
              <button
                key={wallet.name}
                onClick={() => connectWallet(wallet)}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition cursor-pointer shadow-lg"
              >
                <span>{wallet.icon}</span>
                <span className="hidden sm:inline">{wallet.name}</span>
              </button>
            ))}
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow-lg p-4 min-w-64">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-700">Wallet</span>
              <button
                onClick={disconnectWallet}
                className="text-xs px-2 py-1 bg-red-100 hover:bg-red-200 text-red-700 rounded cursor-pointer"
              >
                Trennen
              </button>
            </div>
            <div className="text-xs text-gray-600 font-mono break-all mb-2">
              {walletInfo.publicKey.slice(0, 8)}...{walletInfo.publicKey.slice(-8)}
            </div>
            <div className="text-sm font-semibold text-gray-900">
              {walletInfo.balance.toFixed(4)} SOL
            </div>
          </div>
        )}
      </div>

      <div className="max-w-6xl mx-auto pt-16 pb-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Trading Form */}
          <div className="lg:col-span-2 space-y-6">
            {/* Token Selection */}
            <div className="bg-white rounded-lg shadow-md p-6">
              <h3 className="text-lg font-semibold mb-4">Token Auswahl</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Base Token */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Base Token
                  </label>
                  <ImprovedTokenSelector
                    selectedToken={selectedBaseToken}
                    onTokenSelect={setSelectedBaseToken}
                    tokenList={tokens}
                    walletTokens={walletTokens}
                    placeholder="Token wählen..."
                    allowAddressPaste={true}
                  />
                  {selectedBaseTokenPrice && (
                    <p className="text-sm text-gray-600 mt-1">
                      Preis: ${selectedBaseTokenPrice.toFixed(6)}
                    </p>
                  )}
                </div>

                {/* Quote Token */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Quote Token
                  </label>
                  <ImprovedTokenSelector
                    selectedToken={selectedQuoteToken}
                    onTokenSelect={setSelectedQuoteToken}
                    tokenList={QUOTE_TOKENS}
                    placeholder="Quote Token wählen..."
                    filterQuoteOnly={true}
                    quoteTokens={QUOTE_TOKENS}
                  />
                  {selectedQuoteTokenPrice && (
                    <p className="text-sm text-gray-600 mt-1">
                      Preis: ${selectedQuoteTokenPrice.toFixed(6)}
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Trading Interface */}
            <div className="bg-white rounded-lg shadow-md p-6">
              <h3 className="text-lg font-semibold mb-4">Trading</h3>
              
              {/* Order Type Selection */}
              <div className="flex gap-2 mb-4">
                <button
                  onClick={() => setOrderType("market")}
                  className={`px-4 py-2 rounded cursor-pointer ${
                    orderType === "market" 
                      ? "bg-blue-600 text-white" 
                      : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                  }`}
                >
                  Market Order
                </button>
                <button
                  onClick={() => setOrderType("limit")}
                  className={`px-4 py-2 rounded cursor-pointer ${
                    orderType === "limit" 
                      ? "bg-blue-600 text-white" 
                      : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                  }`}
                >
                  Limit Order
                </button>
              </div>

              {/* Buy/Sell Selection */}
              <div className="flex gap-2 mb-4">
                <button
                  onClick={() => setTradeAction("buy")}
                  className={`px-4 py-2 rounded cursor-pointer ${
                    tradeAction === "buy" 
                      ? "bg-green-600 text-white" 
                      : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                  }`}
                >
                  Kaufen
                </button>
                <button
                  onClick={() => setTradeAction("sell")}
                  className={`px-4 py-2 rounded cursor-pointer ${
                    tradeAction === "sell" 
                      ? "bg-red-600 text-white" 
                      : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                  }`}
                >
                  Verkaufen
                </button>
              </div>

              {/* Amount Input */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Menge
                </label>
                <input
                  type="number"
                  step="any"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.00"
                  className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Limit Price (nur bei Limit Orders) */}
              {orderType === "limit" && (
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Limit Preis
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={limitPrice}
                    onChange={(e) => setLimitPrice(e.target.value)}
                    placeholder="0.00"
                    className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              )}

              {/* Slippage (nur bei Market Orders) */}
              {orderType === "market" && (
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Slippage ({slippage}%)
                  </label>
                  <input
                    type="range"
                    min="0.1"
                    max="5"
                    step="0.1"
                    value={slippage}
                    onChange={(e) => setSlippage(parseFloat(e.target.value))}
                    className="w-full"
                  />
                  <div className="flex justify-between text-xs text-gray-500 mt-1">
                    <span>0.1%</span>
                    <span>5%</span>
                  </div>
                </div>
              )}

              {/* Execute Button */}
              <button
                onClick={orderType === "market" ? executeMarketOrder : createLimitOrder}
                disabled={!walletInfo || !selectedBaseToken || !selectedQuoteToken || !amount || (orderType === "limit" && !limitPrice)}
                className="w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white rounded-lg cursor-pointer disabled:cursor-not-allowed"
              >
                {orderType === "market" 
                  ? `${tradeAction === "buy" ? "Kaufen" : "Verkaufen"} (Market)` 
                  : "Limit Order erstellen"
                }
              </button>
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Wallet Tokens */}
            {walletTokens.length > 0 && (
              <div className="bg-white rounded-lg shadow-md p-6">
                <h3 className="text-lg font-semibold mb-4">Wallet Tokens</h3>
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {walletTokens.map((token) => (
                    <div key={token.address} className="flex justify-between items-center p-2 bg-gray-50 rounded">
                      <div>
                        <div className="font-medium">{token.symbol}</div>
                        <div className="text-xs text-gray-500">{token.name}</div>
                      </div>
                      <div className="text-sm font-medium">
                        {token.uiAmount?.toFixed(4) || '0'}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Active Limit Orders */}
            {limitOrders.length > 0 && (
              <div className="bg-white rounded-lg shadow-md p-6">
                <h3 className="text-lg font-semibold mb-4">Aktive Limit Orders</h3>
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {limitOrders.map((order) => (
                    <div key={order.id} className="p-3 bg-gray-50 rounded">
                      <div className="flex justify-between items-start mb-2">
                        <div className="text-sm">
                          <span className={`px-2 py-1 rounded text-xs ${
                            order.type === "buy" ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"
                          }`}>
                            {order.type.toUpperCase()}
                          </span>
                        </div>
                        <button
                          onClick={() => cancelLimitOrder(order.id)}
                          className="text-xs px-2 py-1 bg-red-100 hover:bg-red-200 text-red-700 rounded cursor-pointer"
                        >
                          Stornieren
                        </button>
                      </div>
                      <div className="text-sm">
                        <div>Menge: {order.amount}</div>
                        <div>Preis: {order.limitPrice}</div>
                        <div className="text-xs text-gray-500">
                          {new Date(order.createdAt).toLocaleString()}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Help */}
            <div className="bg-white rounded-lg shadow-md p-6">
              <h3 className="text-lg font-semibold mb-4">Trading Guide</h3>
              <div className="text-sm text-gray-600 space-y-2">
                <p><strong>Market Order:</strong> Sofortige Ausführung zum aktuellen Marktpreis</p>
                <p><strong>Limit Order:</strong> Ausführung nur wenn der gewünschte Preis erreicht wird</p>
                <p><strong>Slippage:</strong> Toleranz für Preisabweichungen (Standard: 0.5%)</p>
                <p><strong>Base Token:</strong> Das Token, das Sie handeln möchten</p>
                <p><strong>Quote Token:</strong> Das Token, gegen das Sie handeln (SOL/USDC)</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
