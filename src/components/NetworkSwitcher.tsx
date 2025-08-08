"use client";

import { useState, useEffect } from 'react';
import { NetworkType, getNetworkConfig, getCurrentNetwork, setCurrentNetwork, NETWORK_CONFIGS } from '@/config/network';

interface NetworkSwitcherProps {
  onNetworkChange?: (network: NetworkType) => void;
}

export default function NetworkSwitcher({ onNetworkChange }: NetworkSwitcherProps) {
  const [currentNetwork, setCurrentNetworkState] = useState<NetworkType>('devnet');
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    setCurrentNetworkState(getCurrentNetwork());
  }, []);

  const handleNetworkChange = (network: NetworkType) => {
    setCurrentNetwork(network);
    setCurrentNetworkState(network);
    setIsOpen(false);
    onNetworkChange?.(network);
    
    // Seite neu laden um alle Konfigurationen zu aktualisieren
    window.location.reload();
  };

  const currentConfig = getNetworkConfig(currentNetwork);

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium border transition-colors ${
          currentNetwork === 'mainnet' 
            ? 'bg-red-600 hover:bg-red-700 border-red-500 text-white' 
            : 'bg-green-600 hover:bg-green-700 border-green-500 text-white'
        }`}
      >
        <div className={`w-2 h-2 rounded-full ${
          currentNetwork === 'mainnet' ? 'bg-red-300' : 'bg-green-300'
        }`}></div>
        <span>{currentConfig.name}</span>
        <span className="text-xs opacity-75">
          {currentConfig.isTestnet ? '🧪' : '⚠️'}
        </span>
        <svg 
          className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} 
          fill="none" 
          stroke="currentColor" 
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-1 bg-gray-800 rounded-lg border border-gray-700 shadow-lg z-50 min-w-[250px]">
          <div className="p-2">
            <div className="text-xs text-gray-400 mb-2 px-2">Netzwerk auswählen:</div>
            {Object.entries(NETWORK_CONFIGS).map(([key, config]) => {
              const networkKey = key as NetworkType;
              const isSelected = networkKey === currentNetwork;
              
              return (
                <button
                  key={networkKey}
                  onClick={() => handleNetworkChange(networkKey)}
                  className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                    isSelected 
                      ? 'bg-gray-700 text-white' 
                      : 'text-gray-300 hover:bg-gray-700 hover:text-white'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${
                      networkKey === 'mainnet' ? 'bg-red-400' : 'bg-green-400'
                    }`}></div>
                    <div>
                      <div className="font-medium flex items-center gap-1">
                        {config.name}
                        {config.isTestnet ? <span className="text-xs">🧪</span> : <span className="text-xs">⚠️</span>}
                        {isSelected && <span className="text-xs text-green-400">✓</span>}
                      </div>
                      <div className="text-xs text-gray-400">{config.description}</div>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
          
          <div className="border-t border-gray-700 p-2">
            <div className="text-xs text-gray-400 px-2">
              {currentConfig.isTestnet ? (
                <span className="text-green-400">
                  ✅ Sicher zum Testen - Keine echten Kosten
                </span>
              ) : (
                <span className="text-red-400">
                  ⚠️ ACHTUNG: Echtes Mainnet - Echte Kosten!
                </span>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
