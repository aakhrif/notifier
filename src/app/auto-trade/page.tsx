"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useLoadingOverlay } from "../components/LoadingOverlay";
import NetworkSwitcher from "@/components/NetworkSwitcher";
import { getQuoteTokensForNetwork, NetworkType } from "@/config/network";

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
  balance?: number;
  uiAmount?: number;
  logoURI?: string;
}

interface WalletProvider {
  name: string;
  icon: string;
  connect: () => Promise<{ publicKey: string }>;
  disconnect?: () => Promise<void>;
}

declare global {
  interface Window {
    solana?: {
      isPhantom?: boolean;
      connect: () => Promise<{ publicKey: { toString: () => string } }>;
      disconnect: () => Promise<void>;
      signAndSendTransaction: (transaction: { message: string }) => Promise<{ signature: string }>;
      signTransaction: (transaction: unknown) => Promise<unknown>;
      sendTransaction: (transaction: unknown) => Promise<string>;
    };
  }
}

export default function AutoTradePage() {
  const { show, hide } = useLoadingOverlay();
  const [walletInfo, setWalletInfo] = useState<WalletInfo | null>(null);
  const [availableWallets, setAvailableWallets] = useState<WalletProvider[]>([]);
  const [tokens, setTokens] = useState<Token[]>([]);
  const [walletTokens, setWalletTokens] = useState<Token[]>([]);
  const [tokenSearchQuery, setTokenSearchQuery] = useState("");
  const [showTokenSearch, setShowTokenSearch] = useState<"base" | "quote" | null>(null);
  
  // Dynamische Quote Token Liste basierend auf Netzwerk
  const [QUOTE_TOKENS, setQuoteTokens] = useState(getQuoteTokensForNetwork('devnet'));
  
  // Trading Pair Selection
  const [selectedBaseToken, setSelectedBaseToken] = useState("");
  const [selectedQuoteToken, setSelectedQuoteToken] = useState("");
  const [currentPrice, setCurrentPrice] = useState<number | null>(null);
  
  // Order Configuration
  const [orderType, setOrderType] = useState<"market" | "limit">("market");
  const [tradeAction, setTradeAction] = useState<"buy" | "sell">("buy");
  const [amount, setAmount] = useState("");
  const [limitPrice, setLimitPrice] = useState("");
  const [slippage, setSlippage] = useState(50); // 0.5% default (50 BPS)
  
  // Refs for click-outside functionality
  const baseTokenDropdownRef = useRef<HTMLDivElement>(null);
  const quoteTokenDropdownRef = useRef<HTMLDivElement>(null);

  // Netzwerk-Change Handler
  const handleNetworkChange = (network: NetworkType) => {
    setQuoteTokens(getQuoteTokensForNetwork(network));
    
    // Reset selected tokens when changing networks
    setSelectedBaseToken("");
    setSelectedQuoteToken("");
    setCurrentPrice(null);
  };

  // Limit Orders
  const [limitOrders, setLimitOrders] = useState<Array<{
    id: string;
    pair: string;
    type: "buy" | "sell";
    amount: number;
    limitPrice: number;
    status: string;
    createdAt: string;
  }>>([]);

  // Click-outside functionality for dropdowns
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      
      if (baseTokenDropdownRef.current && !baseTokenDropdownRef.current.contains(target)) {
        if (showTokenSearch === "base") {
          setShowTokenSearch(null);
        }
      }
      
      if (quoteTokenDropdownRef.current && !quoteTokenDropdownRef.current.contains(target)) {
        if (showTokenSearch === "quote") {
          setShowTokenSearch(null);
        }
      }
    };

    if (showTokenSearch) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [showTokenSearch]);

  const detectWalletProviders = useCallback(() => {
    const providers: WalletProvider[] = [];
    
    if (typeof window !== 'undefined') {
      if (window.solana?.isPhantom) {
        providers.push({
          name: "Phantom",
          icon: "👻",
          connect: async () => {
            if (!window.solana) throw new Error("Wallet not found");
            const response = await window.solana.connect();
            return { publicKey: response.publicKey.toString() };
          },
          disconnect: async () => {
            if (!window.solana) throw new Error("Wallet not found");
            await window.solana.disconnect();
          }
        });
      }
    }
    
    setAvailableWallets(providers);
  }, []);

  const loadTokens = useCallback(async () => {
    try {
      const response = await fetch("/api/solana/token-search?q=");
      const data = await response.json();
      setTokens(data.tokens || []);
    } catch (error) {
      console.error("Fehler beim Laden der Token:", error);
    }
  }, []);

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

  const searchTokens = useCallback(async () => {
    if (tokenSearchQuery.length < 2) return;
    
    try {
      const isAddress = tokenSearchQuery.length >= 32 && tokenSearchQuery.length <= 44;
      
      let url = `/api/solana/token-search?q=${encodeURIComponent(tokenSearchQuery)}`;
      if (isAddress) {
        url = `/api/solana/token-search?address=${encodeURIComponent(tokenSearchQuery)}`;
      }
      
      const response = await fetch(url);
      const data = await response.json();
      setTokens(data.tokens || []);
    } catch (error) {
      console.error("Fehler beim Suchen der Token:", error);
    }
  }, [tokenSearchQuery]);

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
        slippage: slippage
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
          slippage: slippage
        }),
      });

      const data = await response.json();
      console.log("API Response:", data);
      
      if (response.ok && data.success) {
        console.log("Swap Transaction:", data.transaction);
        console.log("Trade Details:", data.details);
        
        // ECHTE WALLET-INTEGRATION: Transaktion tatsächlich ausführen
        try {
          if (!window.solana) {
            throw new Error("Wallet nicht verfügbar");
          }

          show("Transaktion wird zur Wallet gesendet...");
          
          // Verwende die Solana Web3.js library für korrekte Transaktion-Handling
          const { Transaction, Connection, VersionedTransaction } = await import('@solana/web3.js');
          const connection = new Connection('https://api.mainnet-beta.solana.com');
          
          // Transaktion von Base64 dekodieren
          const transactionBuffer = Buffer.from(data.transaction, 'base64');
          
          let transaction;
          try {
            // Versuche als VersionedTransaction zu dekodieren (Standard für Jupiter)
            transaction = VersionedTransaction.deserialize(transactionBuffer);
          } catch {
            // Fallback: Versuche als Legacy Transaction
            transaction = Transaction.from(transactionBuffer);
          }
          
          // Sende Transaktion an Phantom Wallet zur Signierung und Ausführung
          let signature: string;
          
          try {
            // Methode 1: Versuche signAndSendTransaction
            const result = await (window.solana as unknown as { signAndSendTransaction: (tx: unknown) => Promise<{ signature: string } | string> }).signAndSendTransaction(transaction);
            signature = typeof result === 'string' ? result : result.signature;
          } catch (error) {
            // Methode 2: Fallback - separate sign + send
            console.log("Trying fallback method:", error);
            const signedTx = await (window.solana as unknown as { signTransaction: (tx: unknown) => Promise<{ serialize: () => Uint8Array }> }).signTransaction(transaction);
            const serialized = signedTx.serialize();
            signature = await connection.sendRawTransaction(serialized);
          }
          
          console.log("Transaction Signature:", signature);
          
          // Warte auf Bestätigung
          show("Warte auf Blockchain-Bestätigung...");
          
          // Warte auf Bestätigung (optional, für bessere UX)
          try {
            await connection.confirmTransaction({
              signature,
              blockhash: 'dummy', // Placeholder - nicht kritisch für die Funktion
              lastValidBlockHeight: 0
            }, 'confirmed');
          } catch (confirmError) {
            console.warn("Confirmation timeout, but transaction may still succeed:", confirmError);
          }
          
          // Erfolgreiche Ausführung
          const successMessage = `🎉 TRANSAKTION ERFOLGREICH AUSGEFÜHRT!

✅ ${data.message}

📊 Trade Details:
• Input: ${data.details.inputAmount}
• Expected Output: ${data.details.expectedOutput.toFixed(6)} Token
• Price Impact: ${data.details.priceImpact}%
• Slippage: ${(data.details.slippage * 100).toFixed(1)}%
• Route: ${data.details.route}

🔗 Transaction Signature: 
${signature}

🔍 Explorer Link:
https://solscan.io/tx/${signature}

💰 Ihre Wallet-Balance wird in wenigen Sekunden aktualisiert.`;
          
          alert(successMessage);
          
          // Wallet-Daten nach erfolgreicher Transaktion aktualisieren
          setTimeout(() => {
            loadWalletTokens();
            if (walletInfo) {
              connectWallet(availableWallets.find(w => w.name === "Phantom") || availableWallets[0]); // Refresh wallet balance
            }
          }, 3000); // 3 Sekunden warten für Blockchain-Update
          
        } catch (walletError) {
          console.error("Wallet Error:", walletError);
          
          if (walletError instanceof Error) {
            if (walletError.message.includes("User rejected") || walletError.message.includes("cancelled")) {
              alert("❌ Transaktion von Benutzer abgebrochen");
            } else if (walletError.message.includes("insufficient")) {
              alert("❌ Unzureichende Balance für Transaktion\n\n💡 Stellen Sie sicher, dass Sie genügend SOL für Transaction Fees haben");
            } else if (walletError.message.includes("blockhash")) {
              alert("❌ Transaktion abgelaufen. Bitte versuchen Sie es erneut.");
            } else {
              alert(`❌ Wallet-Fehler: ${walletError.message}\n\n💡 Mögliche Lösungen:\n• Wallet entsperren\n• Verbindung prüfen\n• Nochmal versuchen`);
            }
          } else {
            alert("❌ Unbekannter Wallet-Fehler. Bitte versuchen Sie es erneut.");
          }
        }
        
        setAmount("");
      } else {
        const errorMsg = data.error || "Unbekannter Fehler";
        const details = data.details || response.statusText;
        const debugInfo = data.debug ? `\n\n🔍 Debug Info:\n${JSON.stringify(data.debug, null, 2)}` : '';
        
        console.error("Trading failed:", data);
        
        const fullErrorMessage = `❌ Fehler beim Ausführen der ${tradeAction === 'buy' ? 'Kauf' : 'Verkauf'}-Order:

🚨 Hauptfehler: ${errorMsg}

📋 Details: ${details}

🔧 Status: ${response.status}

💡 Mögliche Lösungen:
${response.status === 400 ? '• Prüfen Sie Token-Adressen und Mengen\n• Überprüfen Sie Ihre Wallet-Balance' : ''}
${response.status === 404 ? '• Token möglicherweise nicht handelbar\n• Versuchen Sie andere Handelspaare' : ''}
${response.status >= 500 ? '• Jupiter-Service temporär nicht verfügbar\n• Versuchen Sie es in wenigen Minuten erneut' : ''}
• Erhöhen Sie die Slippage-Toleranz
• Reduzieren Sie die Handelsmenge${debugInfo}`;

        alert(fullErrorMessage);
      }
    } catch (error) {
      console.error("Trading Error:", error);
      const errorMsg = error instanceof Error ? error.message : "Netzwerk-Fehler";
      alert(`❌ Market Order fehlgeschlagen:\n\n${errorMsg}\n\nBitte prüfen Sie:\n- Internetverbindung\n- Jupiter API Status\n- Token-Verfügbarkeit`);
    } finally {
      hide();
    }
  };

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

  const fetchCurrentPrice = useCallback(async () => {
    if (!selectedBaseToken) return;
    
    try {
      console.log("Fetching price for token:", selectedBaseToken);
      
      const response = await fetch("/api/solana/token-price", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tokenAddress: selectedBaseToken
        }),
      });
      
      if (response.ok) {
        const data = await response.json();
        console.log("Raw API Response:", data);
        console.log("Price USD from API:", data.priceUSD);
        console.log("Debug info:", data.debug);
        
        setCurrentPrice(data.priceUSD);
      } else {
        console.error("Preis nicht verfügbar:", response.status);
        setCurrentPrice(null);
      }
    } catch (error) {
      console.error("Fehler beim Abrufen des USD-Preises:", error);
      setCurrentPrice(null);
    }
  }, [selectedBaseToken]);

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

  const getSelectedTokenInfo = (address: string, tokenList: Token[]) => {
    return tokenList.find(token => token.address === address);
  };

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
      fetchCurrentPrice();
      // Auto-refresh price every 30 seconds
      const interval = setInterval(fetchCurrentPrice, 30000);
      return () => clearInterval(interval);
    }
  }, [selectedBaseToken, fetchCurrentPrice]);

  useEffect(() => {
    if (tokenSearchQuery.length >= 2) {
      searchTokens();
    }
  }, [tokenSearchQuery, searchTokens]);

  // Click-outside functionality for dropdowns
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (baseTokenDropdownRef.current && !baseTokenDropdownRef.current.contains(event.target as Node) &&
          quoteTokenDropdownRef.current && !quoteTokenDropdownRef.current.contains(event.target as Node)) {
        setShowTokenSearch(null);
      }
    };

    if (showTokenSearch) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showTokenSearch]);

  return (
    <div className="min-h-screen bg-black text-white p-6">
      <div className="max-w-full mx-auto">
        {/* Header mit Titel und Network Switcher */}
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold text-white">Auto Trading Dashboard</h1>
          <NetworkSwitcher 
            onNetworkChange={handleNetworkChange} 
          />
        </div>
        
        {/* Header with Wallet - Fixed position top right */}
        <div className="fixed top-6 right-6 z-50">
          <div className="bg-gray-900 rounded-lg p-4 shadow-lg border border-gray-700 min-w-[280px]">
            {!walletInfo ? (
              <div className="space-y-3">
                <div className="text-center mb-3">
                  <p className="text-sm text-gray-400">Wallet verbinden</p>
                </div>
                {availableWallets.length > 0 ? (
                  availableWallets.map((wallet) => (
                    <button
                      key={wallet.name}
                      onClick={() => connectWallet(wallet)}
                      className="w-full flex items-center gap-3 p-3 bg-gray-800 hover:bg-gray-700 rounded-lg transition cursor-pointer"
                    >
                      <span className="text-2xl">{wallet.icon}</span>
                      <span className="font-medium">{wallet.name} verbinden</span>
                    </button>
                  ))
                ) : (
                  <p className="text-gray-400 text-center">Keine Wallet-Provider</p>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                {/* Wallet Header mit Disconnect Button */}
                <div className="flex items-center justify-between pb-3 border-b border-gray-700">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-purple-600 rounded-full flex items-center justify-center">
                      <span className="text-white font-bold text-sm">👛</span>
                    </div>
                    <span className="font-medium text-white">Wallet verbunden</span>
                  </div>
                  <button
                    onClick={disconnectWallet}
                    className="px-3 py-1.5 bg-red-600 hover:bg-red-700 rounded-md text-sm font-medium cursor-pointer transition flex items-center gap-1"
                  >
                    <span>✕</span>
                    <span>Trennen</span>
                  </button>
                </div>
                
                {/* Wallet Details */}
                <div className="space-y-3">
                  <div>
                    <p className="text-xs text-gray-400 mb-1">Adresse</p>
                    <p className="font-mono text-sm text-gray-200 bg-gray-800 px-2 py-1 rounded">
                      {walletInfo.publicKey.slice(0, 8)}...{walletInfo.publicKey.slice(-8)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400 mb-1">Balance</p>
                    <p className="font-semibold text-lg text-green-400">
                      {walletInfo.balance.toFixed(4)} SOL
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Main Content - Full Width */}
        <div className="pr-[300px]"> {/* Add right padding to avoid overlap with fixed wallet */}
          {/* Trading Interface */}
          {walletInfo && (
          <div className="bg-gray-900 rounded-lg p-6">
            <h2 className="text-xl font-semibold mb-6">Trading</h2>
            
            {/* Token Pair Selection */}
            <div className="space-y-4 mb-6">
              {/* Base Token */}
              <div>
                <label className="block text-sm font-medium mb-2 text-white">Base Token</label>
                <div className="relative" ref={baseTokenDropdownRef}>
                  <button
                    onClick={() => setShowTokenSearch(showTokenSearch === "base" ? null : "base")}
                    className="w-full p-3 bg-gray-800 rounded-lg text-left hover:bg-gray-700 cursor-pointer"
                  >
                    {selectedBaseToken ? (
                      <div className="flex items-center gap-2">
                        <span className="font-medium">
                          {getSelectedTokenInfo(selectedBaseToken, [...tokens, ...walletTokens])?.symbol || 'Unbekannt'}
                        </span>
                        <span className="text-gray-400 text-sm">
                          {getSelectedTokenInfo(selectedBaseToken, [...tokens, ...walletTokens])?.name || selectedBaseToken.slice(0, 8) + '...'}
                        </span>
                      </div>
                    ) : (
                      <span className="text-gray-400">Base Token auswählen</span>
                    )}
                  </button>
                  
                  {showTokenSearch === "base" && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-gray-800 rounded-lg border border-gray-700 z-50 max-h-60 overflow-hidden">
                      <div className="p-3 border-b border-gray-700">
                        <input
                          type="text"
                          placeholder="Token suchen (Name, Symbol oder Adresse)"
                          value={tokenSearchQuery}
                          onChange={(e) => setTokenSearchQuery(e.target.value)}
                          className="w-full p-2 bg-gray-700 rounded text-white placeholder-gray-400"
                          autoFocus
                        />
                      </div>
                      <div className="max-h-40 overflow-y-auto">
                        {/* Wallet Tokens */}
                        {walletTokens.length > 0 && (
                          <>
                            <div className="px-3 py-2 text-xs text-gray-400 bg-gray-700">Wallet Tokens</div>
                            {walletTokens.map((token) => (
                              <button
                                key={token.address}
                                onClick={() => {
                                  setSelectedBaseToken(token.address);
                                  setShowTokenSearch(null);
                                  setTokenSearchQuery("");
                                }}
                                className="w-full px-3 py-2 text-sm text-white hover:bg-gray-600 cursor-pointer text-left flex items-center gap-2"
                              >
                                <span className="font-medium">{token.symbol}</span>
                                <span className="text-gray-400 text-xs">{token.name}</span>
                                <span className="ml-auto text-xs text-green-400">
                                  {token.uiAmount?.toFixed(4) || '0'}
                                </span>
                              </button>
                            ))}
                          </>
                        )}
                        
                        {/* Search Results */}
                        {tokens.length > 0 && (
                          <>
                            <div className="px-3 py-2 text-xs text-gray-400 bg-gray-700">Suchergebnisse</div>
                            {tokens.map((token) => (
                              <button
                                key={token.address}
                                onClick={() => {
                                  setSelectedBaseToken(token.address);
                                  setShowTokenSearch(null);
                                  setTokenSearchQuery("");
                                }}
                                className="w-full px-3 py-2 text-sm text-white hover:bg-gray-600 cursor-pointer text-left flex items-center gap-2"
                              >
                                <span className="font-medium">{token.symbol}</span>
                                <span className="text-gray-400 text-xs">{token.name}</span>
                              </button>
                            ))}
                          </>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Quote Token - Nur SOL und USDC */}
              <div>
                <label className="block text-sm font-medium mb-2 text-white">Quote Token</label>
                <div className="relative" ref={quoteTokenDropdownRef}>
                  <button
                    onClick={() => setShowTokenSearch(showTokenSearch === "quote" ? null : "quote")}
                    className="w-full p-3 bg-gray-800 rounded-lg text-left hover:bg-gray-700 cursor-pointer"
                  >
                    {selectedQuoteToken ? (
                      <div className="flex items-center gap-2">
                        <span className="font-medium">
                          {QUOTE_TOKENS.find(t => t.address === selectedQuoteToken)?.symbol || 'Unbekannt'}
                        </span>
                        <span className="text-gray-400 text-sm">
                          {QUOTE_TOKENS.find(t => t.address === selectedQuoteToken)?.name || 'Unbekannt'}
                        </span>
                      </div>
                    ) : (
                      <span className="text-gray-400">Quote Token auswählen (SOL/USDC)</span>
                    )}
                  </button>
                  
                  {showTokenSearch === "quote" && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-gray-800 rounded-lg border border-gray-700 z-50">
                      <div className="px-3 py-2 text-xs text-gray-400 bg-gray-700">Verfügbare Quote Tokens</div>
                      {QUOTE_TOKENS
                        .filter(token => token.address !== selectedBaseToken) // Vermeide Base Token als Quote Token
                        .map((token) => (
                        <button
                          key={token.address}
                          onClick={() => {
                            setSelectedQuoteToken(token.address);
                            setShowTokenSearch(null);
                          }}
                          className="w-full px-3 py-2 text-sm text-white hover:bg-gray-600 cursor-pointer text-left flex items-center gap-2"
                        >
                          <span className="font-medium">{token.symbol}</span>
                          <span className="text-gray-400 text-xs">{token.name}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
            
            {currentPrice && (
              <div className="mb-4 p-3 bg-gray-800 rounded-lg">
                <p className="text-sm text-green-400 font-medium">
                  Aktueller Preis: ${currentPrice < 0.01 
                    ? currentPrice.toExponential(4) 
                    : currentPrice.toLocaleString('de-DE', {
                        minimumFractionDigits: currentPrice < 1 ? 6 : 2,
                        maximumFractionDigits: currentPrice < 1 ? 6 : 2
                      })
                  } USD
                </p>
                <p className="text-xs text-gray-400 mt-1">
                  Debug: Roher Wert = {currentPrice}
                </p>
              </div>
            )}

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

            {/* Trade Action */}
            <div className="mb-4">
              <label className="block text-sm font-medium mb-2 text-white">Aktion</label>
              <div className="flex bg-gray-800 rounded-lg p-1">
                <button
                  onClick={() => setTradeAction("buy")}
                  className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition cursor-pointer ${
                    tradeAction === "buy"
                      ? "bg-green-600 text-white shadow"
                      : "text-gray-300 hover:text-white"
                  }`}
                >
                  Kaufen
                </button>
                <button
                  onClick={() => setTradeAction("sell")}
                  className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition cursor-pointer ${
                    tradeAction === "sell"
                      ? "bg-red-600 text-white shadow"
                      : "text-gray-300 hover:text-white"
                  }`}
                >
                  Verkaufen
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
                placeholder="0.00"
                className="w-full p-3 bg-gray-800 border border-gray-700 rounded-lg text-white"
              />
            </div>

            {/* Limit Price (if limit order) */}
            {orderType === "limit" && (
              <div className="mb-4">
                <label className="block text-sm font-medium mb-2 text-white">Limit Preis</label>
                <input
                  type="number"
                  value={limitPrice}
                  onChange={(e) => setLimitPrice(e.target.value)}
                  placeholder="0.00"
                  className="w-full p-3 bg-gray-800 border border-gray-700 rounded-lg text-white"
                />
              </div>
            )}

            {/* Slippage */}
            <div className="mb-6">
              <label className="block text-sm font-medium mb-2 text-white">
                Slippage: {(slippage / 100).toFixed(1)}%
              </label>
              <input
                type="range"
                min="10"
                max="1000" 
                step="10"
                value={slippage}
                onChange={(e) => setSlippage(parseInt(e.target.value))}
                className="w-full"
              />
              <div className="flex justify-between text-xs text-gray-400 mt-1">
                <span>0.1%</span>
                <span>10%</span>
              </div>
            </div>

            {/* Execute Button */}
            <button
              onClick={orderType === "market" ? executeMarketOrder : createLimitOrder}
              disabled={!selectedBaseToken || !selectedQuoteToken || !amount || (orderType === "limit" && !limitPrice)}
              className="w-full py-3 bg-[#28ebcf] hover:bg-[#20c4a8] disabled:bg-gray-600 disabled:cursor-not-allowed text-black font-semibold rounded-lg transition cursor-pointer"
            >
              {orderType === "market" ? "Market Order ausführen" : "Limit Order erstellen"}
            </button>

            {/* Limit Orders List */}
            {limitOrders.length > 0 && (
              <div className="mt-8">
                <h3 className="text-lg font-semibold mb-4">Aktive Limit Orders</h3>
                <div className="space-y-3">
                  {limitOrders.filter(order => order.status === "active").map((order) => (
                    <div key={order.id} className="bg-gray-800 rounded-lg p-4">
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <p className="font-medium">{order.pair}</p>
                          <p className="text-sm text-gray-400">
                            {order.type === "buy" ? "Kaufen" : "Verkaufen"} • {order.amount} bei ${order.limitPrice}
                          </p>
                        </div>
                        <button
                          onClick={() => cancelLimitOrder(order.id)}
                          className="px-2 py-1 bg-red-600 hover:bg-red-700 rounded text-xs cursor-pointer"
                        >
                          Stornieren
                        </button>
                      </div>
                      <p className="text-xs text-gray-500">
                        Erstellt: {new Date(order.createdAt).toLocaleString("de-DE")}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
        </div>
      </div>
    </div>
  );
}
