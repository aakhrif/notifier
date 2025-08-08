"use client";

import { useState, useEffect, useRef } from "react";

interface Token {
  address: string;
  symbol: string;
  name: string;
  decimals: number;
  uiAmount?: number;
}

interface TokenSelectorProps {
  selectedToken: string;
  onTokenSelect: (address: string) => void;
  tokenList: Token[];
  walletTokens?: Token[];
  placeholder: string;
  allowAddressPaste?: boolean;
  filterQuoteOnly?: boolean;
  quoteTokens?: Token[];
}

export default function ImprovedTokenSelector({
  selectedToken,
  onTokenSelect,
  tokenList,
  walletTokens = [],
  placeholder,
  allowAddressPaste = false,
  filterQuoteOnly = false,
  quoteTokens = []
}: TokenSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [filteredTokens, setFilteredTokens] = useState<Token[]>([]);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Get the selected token info for display
  const selectedTokenInfo = [...tokenList, ...walletTokens].find(token => token.address === selectedToken);

  // Filter tokens based on search query
  useEffect(() => {
    const availableTokens = filterQuoteOnly ? quoteTokens : tokenList;
    
    if (searchQuery.length < 2) {
      setFilteredTokens(availableTokens.slice(0, 10));
      return;
    }

    const isAddress = searchQuery.length >= 32 && searchQuery.length <= 44;
    
    if (isAddress && allowAddressPaste) {
      // Search by exact address
      const exactMatch = availableTokens.find(token => 
        token.address.toLowerCase() === searchQuery.toLowerCase()
      );
      setFilteredTokens(exactMatch ? [exactMatch] : []);
    } else {
      // Search by symbol or name
      const filtered = availableTokens.filter(token =>
        token.symbol.toLowerCase().includes(searchQuery.toLowerCase()) ||
        token.name.toLowerCase().includes(searchQuery.toLowerCase())
      );
      setFilteredTokens(filtered.slice(0, 20));
    }
  }, [searchQuery, tokenList, allowAddressPaste, filterQuoteOnly, quoteTokens]);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setSearchQuery("");
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Focus input when dropdown opens
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  const handleTokenSelect = (tokenAddress: string) => {
    onTokenSelect(tokenAddress);
    setIsOpen(false);
    setSearchQuery("");
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Selected Token Display */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full p-3 bg-gray-800 rounded-lg text-left hover:bg-gray-700 transition-colors cursor-pointer border border-gray-700 focus:border-blue-500 focus:outline-none"
      >
        {selectedTokenInfo ? (
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <div className="font-medium text-white">{selectedTokenInfo.symbol}</div>
              <div className="text-sm text-gray-400">{selectedTokenInfo.name}</div>
            </div>
            {selectedTokenInfo.uiAmount !== undefined && (
              <div className="text-sm text-green-400">
                {selectedTokenInfo.uiAmount.toFixed(4)}
              </div>
            )}
          </div>
        ) : (
          <span className="text-gray-400">{placeholder}</span>
        )}
        <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
          <svg className={`w-5 h-5 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-gray-800 rounded-lg border border-gray-700 z-50 max-h-80 overflow-hidden shadow-xl">
          {/* Search Input */}
          <div className="p-3 border-b border-gray-700">
            <input
              ref={inputRef}
              type="text"
              placeholder={allowAddressPaste 
                ? "Token suchen (Name, Symbol oder Adresse)" 
                : "Token suchen (Name oder Symbol)"
              }
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full p-2 bg-gray-700 rounded text-white placeholder-gray-400 border border-gray-600 focus:border-blue-500 focus:outline-none"
            />
          </div>

          {/* Token List */}
          <div className="max-h-60 overflow-y-auto">
            {/* Wallet Tokens Section */}
            {walletTokens.length > 0 && searchQuery.length < 2 && !filterQuoteOnly && (
              <>
                <div className="px-3 py-2 text-xs text-gray-400 bg-gray-700 sticky top-0">
                  🔗 Wallet Tokens
                </div>
                {walletTokens.slice(0, 5).map((token) => (
                  <button
                    key={`wallet-${token.address}`}
                    onClick={() => handleTokenSelect(token.address)}
                    className="w-full px-3 py-3 text-sm text-white hover:bg-gray-600 cursor-pointer text-left flex items-center gap-3 transition-colors"
                  >
                    <div className="flex-1">
                      <div className="font-medium">{token.symbol}</div>
                      <div className="text-xs text-gray-400">{token.name}</div>
                    </div>
                    <div className="text-xs text-green-400 font-medium">
                      {token.uiAmount?.toFixed(4) || '0'}
                    </div>
                  </button>
                ))}
              </>
            )}

            {/* Available Tokens Section */}
            {filteredTokens.length > 0 && (
              <>
                <div className="px-3 py-2 text-xs text-gray-400 bg-gray-700 sticky top-0">
                  {filterQuoteOnly ? '💱 Quote Tokens' : '🔍 Suchergebnisse'}
                </div>
                {filteredTokens.map((token) => (
                  <button
                    key={`search-${token.address}`}
                    onClick={() => handleTokenSelect(token.address)}
                    className="w-full px-3 py-3 text-sm text-white hover:bg-gray-600 cursor-pointer text-left transition-colors"
                  >
                    <div className="font-medium">{token.symbol}</div>
                    <div className="text-xs text-gray-400">{token.name}</div>
                    {allowAddressPaste && (
                      <div className="text-xs text-gray-500 font-mono mt-1">
                        {token.address.slice(0, 8)}...{token.address.slice(-8)}
                      </div>
                    )}
                  </button>
                ))}
              </>
            )}

            {/* No Results */}
            {searchQuery.length >= 2 && filteredTokens.length === 0 && (
              <div className="px-3 py-4 text-center text-gray-400">
                <div className="text-sm">Keine Token gefunden</div>
                {allowAddressPaste && searchQuery.length >= 32 && (
                  <div className="text-xs mt-1">
                    Stellen Sie sicher, dass die Adresse korrekt ist
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
