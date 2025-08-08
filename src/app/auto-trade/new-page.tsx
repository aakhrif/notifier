"use client";

import { useState, useEffect } from "react";
import { useLoadingOverlay } from "../components/LoadingOverlay";

interface WalletInfo {
  publicKey: string;
  balance: number;
  rpcEndpoint: string;
}

interface Token {
  address: string;
  symbol: string;
  name: string;
  decimals: number;
}

interface LimitOrder {
  id: string;
  pair: string;
  type: "buy" | "sell";
  amount: number;
  limitPrice: number;
  status: "active" | "filled" | "cancelled";
  createdAt: Date;
}

interface WalletProvider {
  name: string;
  icon: string;
  connect: () => Promise<{ publicKey: string }>;
  disconnect?: () => Promise<void>;
}

declare global {
  interface Window {
    solana?: any;
    solflare?: any;
    backpack?: any;
  }
}

export default function AutoTradePage() {
  const { show, hide } = useLoadingOverlay();
  const [walletInfo, setWalletInfo] = useState<WalletInfo | null>(null);
  const [availableWallets, setAvailableWallets] = useState<WalletProvider[]>([]);
  const [tokens, setTokens] = useState<Token[]>([]);
  
  // Trading Pair Selection
  const [selectedBaseToken, setSelectedBaseToken] = useState("");
  const [selectedQuoteToken, setSelectedQuoteToken] = useState("");
  const [currentPrice, setCurrentPrice] = useState<number | null>(null);
  
  // Order Configuration
  const [orderType, setOrderType] = useState<"market" | "limit">("market");
  const [tradeAction, setTradeAction] = useState<"buy" | "sell">("buy");
  const [amount, setAmount] = useState("");
  const [limitPrice, setLimitPrice] = useState("");
  const [slippage, setSlippage] = useState(300);
  
  // Limit Orders
  const [limitOrders, setLimitOrders] = useState<LimitOrder[]>([]);

  useEffect(() => {
    loadTokens();
    detectWalletProviders();
  }, []);

  useEffect(() => {
    if (walletInfo) {
      loadLimitOrders();
    }
  }, [walletInfo]);

  useEffect(() => {
    if (selectedBaseToken && selectedQuoteToken && selectedBaseToken !== selectedQuoteToken) {
      fetchCurrentPrice();
    }
  }, [selectedBaseToken, selectedQuoteToken]);

  const detectWalletProviders = () => {
    const providers: WalletProvider[] = [];
    
    if (typeof window !== 'undefined') {
      if (window.solana?.isPhantom) {
        providers.push({
          name: "Phantom",
          icon: "👻",
          connect: async () => {
            const response = await window.solana.connect();
            return { publicKey: response.publicKey.toString() };
          },
          disconnect: async () => {
            await window.solana.disconnect();
          }
        });
      }
      
      if (window.solflare?.isSolflare) {
        providers.push({
          name: "Solflare",
          icon: "🔥",
          connect: async () => {
            const response = await window.solflare.connect();
            return { publicKey: response.publicKey.toString() };
          }
        });
      }
      
      if (window.backpack?.isBackpack) {
        providers.push({
          name: "Backpack",
          icon: "🎒",
          connect: async () => {
            const response = await window.backpack.connect();
            return { publicKey: response.publicKey.toString() };
          }
        });
      }
    }
    
    setAvailableWallets(providers);
  };

  const loadTokens = async () => {
    try {
      const response = await fetch("/api/solana/tokens");
      const data = await response.json();
      setTokens(data.popularTokens || []);
      
      const solToken = data.popularTokens?.find((t: Token) => t.symbol === "SOL");
      if (solToken) {
        setSelectedQuoteToken(solToken.address);
      }
    } catch (error) {
      console.error("Fehler beim Laden der Token:", error);
    }
  };

  const fetchCurrentPrice = async () => {
    try {
      const response = await fetch("/api/solana/price", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          inputMint: selectedBaseToken,
          outputMint: selectedQuoteToken,
          amount: 1000000
        }),
      });
      
      if (response.ok) {
        const data = await response.json();
        setCurrentPrice(data.price);
      }
    } catch (error) {
      console.error("Fehler beim Abrufen des Preises:", error);
    }
  };

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

  const loadLimitOrders = async () => {
    if (!walletInfo) return;
    
    try {
      const response = await fetch("/api/solana/limit-orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "check",
          orderData: { userWallet: walletInfo.publicKey }
        }),
      });
      
      if (response.ok) {
        const data = await response.json();
        setLimitOrders(data.orders || []);
      }
    } catch (error) {
      console.error("Fehler beim Laden der Limit Orders:", error);
    }
  };

  const executeMarketOrder = async () => {
    if (!walletInfo || !selectedBaseToken || !selectedQuoteToken || !amount) {
      alert("Bitte alle Felder ausfüllen");
      return;
    }

    alert("Market Orders sind momentan nicht implementiert - bitte nutzen Sie Limit Orders");
  };

  const placeLimitOrder = async () => {
    if (!selectedBaseToken || !selectedQuoteToken || !amount || !limitPrice || !walletInfo) {
      alert("Bitte alle Felder für Limit Order ausfüllen");
      return;
    }

    const baseToken = tokens.find(t => t.address === selectedBaseToken);
    const quoteToken = tokens.find(t => t.address === selectedQuoteToken);
    
    if (!baseToken || !quoteToken) return;

    try {
      const response = await fetch("/api/solana/limit-orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create",
          orderData: {
            userWallet: walletInfo.publicKey,
            pair: `${baseToken.symbol}/${quoteToken.symbol}`,
            baseToken: selectedBaseToken,
            quoteToken: selectedQuoteToken,
            type: tradeAction,
            amount: parseFloat(amount),
            limitPrice: parseFloat(limitPrice),
          }
        }),
      });

      if (response.ok) {
        alert(`Limit ${tradeAction === "buy" ? "Buy" : "Sell"} Order platziert!`);
        loadLimitOrders();
        setAmount("");
        setLimitPrice("");
      } else {
        const error = await response.json();
        alert(`Fehler beim Platzieren der Order: ${error.error}`);
      }
    } catch (error) {
      console.error("Limit Order Fehler:", error);
      alert("Limit Order fehlgeschlagen");
    }
  };

  const cancelLimitOrder = async (orderId: string) => {
    try {
      const response = await fetch("/api/solana/limit-orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "cancel",
          orderData: { orderId }
        }),
      });

      if (response.ok) {
        loadLimitOrders();
      }
    } catch (error) {
      console.error("Cancel Order Fehler:", error);
    }
  };

  const getSelectedPairDisplay = () => {
    const baseToken = tokens.find(t => t.address === selectedBaseToken);
    const quoteToken = tokens.find(t => t.address === selectedQuoteToken);
    
    if (baseToken && quoteToken) {
      return `${baseToken.symbol}/${quoteToken.symbol}`;
    }
    return "Pair auswählen";
  };

  return (
    <div className="max-w-7xl mx-auto p-8">
      <h1 className="text-3xl font-bold mb-6 text-white">
        Auto Trade
      </h1>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
        {/* Wallet Verbindung */}
        <div className="bg-[#1a1b1e] rounded-xl shadow-lg p-6 border border-gray-700">
          <h2 className="text-xl font-semibold mb-4 text-white">Wallet Verbindung</h2>
          
          {!walletInfo ? (
            <div className="space-y-3">
              {availableWallets.length === 0 ? (
                <p className="text-gray-300 text-center py-4">
                  Keine Wallet-Provider gefunden. Bitte installieren Sie eine Solana Wallet wie Phantom, Solflare oder Backpack.
                </p>
              ) : (
                availableWallets.map((provider) => (
                  <button
                    key={provider.name}
                    onClick={() => connectWallet(provider)}
                    className="w-full flex items-center gap-3 bg-[#28ebcf] text-black px-4 py-3 rounded-lg hover:bg-[#20cbb0] transition cursor-pointer font-medium"
                  >
                    <span className="text-lg">{provider.icon}</span>
                    <span>Mit {provider.name} verbinden</span>
                  </button>
                ))
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <div className="p-4 bg-gray-800 rounded-lg">
                <p className="text-sm text-gray-300"><strong>Wallet:</strong> {walletInfo.publicKey.slice(0, 20)}...</p>
                <p className="text-sm text-gray-300"><strong>Balance:</strong> {walletInfo.balance.toFixed(4)} SOL</p>
              </div>
              <button
                onClick={() => setWalletInfo(null)}
                className="w-full bg-red-500 text-white px-4 py-2 rounded-lg hover:bg-red-600 transition cursor-pointer"
              >
                Wallet trennen
              </button>
            </div>
          )}
        </div>

        {/* Trading Interface */}
        <div className="bg-[#1a1b1e] rounded-xl shadow-lg p-6 border border-gray-700">
          <h2 className="text-xl font-semibold mb-4 text-white">Trading Interface</h2>
          
          {/* Trading Pair Selection */}
          <div className="mb-6 p-4 bg-gray-800 rounded-lg">
            <h3 className="font-medium mb-3 text-white">Trading Pair: {getSelectedPairDisplay()}</h3>
            
            <div className="grid grid-cols-2 gap-3 mb-3">
              <div>
                <label className="block text-xs font-medium mb-1 text-gray-300">Base Token</label>
                <select
                  value={selectedBaseToken}
                  onChange={(e) => setSelectedBaseToken(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-gray-700 text-white border border-gray-600 rounded focus:ring-1 focus:ring-[#28ebcf] cursor-pointer"
                >
                  <option value="">Base wählen...</option>
                  {tokens.map((token) => (
                    <option key={token.address} value={token.address}>
                      {token.symbol}
                    </option>
                  ))}
                </select>
              </div>
              
              <div>
                <label className="block text-xs font-medium mb-1 text-gray-300">Quote Token</label>
                <select
                  value={selectedQuoteToken}
                  onChange={(e) => setSelectedQuoteToken(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-gray-700 text-white border border-gray-600 rounded focus:ring-1 focus:ring-[#28ebcf] cursor-pointer"
                >
                  <option value="">Quote wählen...</option>
                  {tokens.map((token) => (
                    <option key={token.address} value={token.address}>
                      {token.symbol}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            
            {currentPrice && (
              <p className="text-sm text-gray-400">
                Aktueller Preis: {currentPrice.toFixed(6)}
              </p>
            )}
          </div>

          {/* Order Type Selection */}
          <div className="mb-4">
            <label className="block text-sm font-medium mb-2 text-white">Order Type</label>
            <div className="flex bg-gray-800 rounded-lg p-1">
              <button
                onClick={() => setOrderType("market")}
                className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition cursor-pointer ${
                  orderType === "market"
                    ? "bg-[#28ebcf] text-black shadow"
                    : "text-gray-300 hover:text-white"
                }`}
              >
                Market Order
              </button>
              <button
                onClick={() => setOrderType("limit")}
                className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition cursor-pointer ${
                  orderType === "limit"
                    ? "bg-[#28ebcf] text-black shadow"
                    : "text-gray-300 hover:text-white"
                }`}
              >
                Limit Order
              </button>
            </div>
          </div>

          {/* Buy/Sell Selection */}
          <div className="mb-4">
            <label className="block text-sm font-medium mb-2 text-white">Aktion</label>
            <div className="flex bg-gray-800 rounded-lg p-1">
              <button
                onClick={() => setTradeAction("buy")}
                className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition cursor-pointer ${
                  tradeAction === "buy"
                    ? "bg-green-500 text-white shadow"
                    : "text-gray-300 hover:text-white"
                }`}
              >
                Buy
              </button>
              <button
                onClick={() => setTradeAction("sell")}
                className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition cursor-pointer ${
                  tradeAction === "sell"
                    ? "bg-red-500 text-white shadow"
                    : "text-gray-300 hover:text-white"
                }`}
              >
                Sell
              </button>
            </div>
          </div>

          {/* Amount Input */}
          <div className="mb-4">
            <label className="block text-sm font-medium mb-2 text-white">Menge</label>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full px-4 py-2 bg-gray-700 text-white border border-gray-600 rounded-lg focus:ring-2 focus:ring-[#28ebcf] focus:border-transparent"
              placeholder="0.0"
              step="0.000001"
            />
          </div>

          {/* Limit Price (nur bei Limit Orders) */}
          {orderType === "limit" && (
            <div className="mb-4">
              <label className="block text-sm font-medium mb-2 text-white">Limit Preis</label>
              <input
                type="number"
                value={limitPrice}
                onChange={(e) => setLimitPrice(e.target.value)}
                className="w-full px-4 py-2 bg-gray-700 text-white border border-gray-600 rounded-lg focus:ring-2 focus:ring-[#28ebcf] focus:border-transparent"
                placeholder="0.0"
                step="0.000001"
              />
            </div>
          )}

          {/* Slippage (nur bei Market Orders) */}
          {orderType === "market" && (
            <div className="mb-4">
              <label className="block text-sm font-medium mb-2 text-white">Slippage ({slippage / 100}%)</label>
              <input
                type="range"
                min="50"
                max="1000"
                value={slippage}
                onChange={(e) => setSlippage(parseInt(e.target.value))}
                className="w-full accent-[#28ebcf] cursor-pointer"
              />
            </div>
          )}

          {/* Execute Button */}
          <button
            onClick={orderType === "market" ? executeMarketOrder : placeLimitOrder}
            disabled={!walletInfo}
            className={`w-full px-4 py-2 rounded-lg font-medium transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
              tradeAction === "buy"
                ? "bg-green-500 hover:bg-green-600 text-white"
                : "bg-red-500 hover:bg-red-600 text-white"
            }`}
          >
            {orderType === "market" 
              ? `${tradeAction === "buy" ? "Buy" : "Sell"} (Market)`
              : `Place Limit ${tradeAction === "buy" ? "Buy" : "Sell"}`
            }
          </button>
        </div>

        {/* Limit Orders */}
        <div className="bg-[#1a1b1e] rounded-xl shadow-lg p-6 border border-gray-700">
          <h2 className="text-xl font-semibold mb-4 text-white">Limit Orders</h2>
          
          <div className="space-y-3">
            {limitOrders.length === 0 ? (
              <p className="text-gray-400 text-center py-4">Keine aktiven Limit Orders</p>
            ) : (
              limitOrders.map((order) => (
                <div key={order.id} className="p-3 bg-gray-800 border border-gray-700 rounded-lg">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <p className="font-medium text-white">{order.pair}</p>
                      <p className={`text-sm ${order.type === "buy" ? "text-green-400" : "text-red-400"}`}>
                        {order.type.toUpperCase()} {order.amount} @ {order.limitPrice}
                      </p>
                    </div>
                    <div className="text-right">
                      <span className={`inline-block px-2 py-1 rounded text-xs ${
                        order.status === "active" ? "bg-blue-900 text-blue-300" :
                        order.status === "filled" ? "bg-green-900 text-green-300" :
                        "bg-gray-900 text-gray-400"
                      }`}>
                        {order.status.toUpperCase()}
                      </span>
                    </div>
                  </div>
                  
                  {order.status === "active" && (
                    <button
                      onClick={() => cancelLimitOrder(order.id)}
                      className="text-red-400 text-xs hover:text-red-300 cursor-pointer"
                    >
                      Cancel
                    </button>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
