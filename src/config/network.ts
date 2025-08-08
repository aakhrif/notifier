export type NetworkType = 'mainnet' | 'devnet' | 'testnet';

export interface NetworkConfig {
  name: string;
  rpcEndpoint: string;
  jupiterApiBase: string;
  explorerBase: string;
  description: string;
  isTestnet: boolean;
}

export const NETWORK_CONFIGS: Record<NetworkType, NetworkConfig> = {
  mainnet: {
    name: 'Mainnet',
    rpcEndpoint: 'https://api.mainnet-beta.solana.com',
    jupiterApiBase: 'https://quote-api.jup.ag/v6',
    explorerBase: 'https://solscan.io',
    description: 'Echtes Solana Mainnet - Echte Transaktionen!',
    isTestnet: false
  },
  devnet: {
    name: 'Devnet',
    rpcEndpoint: 'https://api.devnet.solana.com',
    jupiterApiBase: 'https://quote-api.jup.ag/v6', // Jupiter unterstützt auch Devnet
    explorerBase: 'https://solscan.io',
    description: 'Solana Devnet - Sicher zum Testen',
    isTestnet: true
  },
  testnet: {
    name: 'Testnet', 
    rpcEndpoint: 'https://api.testnet.solana.com',
    jupiterApiBase: 'https://quote-api.jup.ag/v6',
    explorerBase: 'https://solscan.io',
    description: 'Solana Testnet - Experimentelles Netzwerk',
    isTestnet: true
  }
};

// Standard-Netzwerk (kann per Environment Variable überschrieben werden)
export const DEFAULT_NETWORK: NetworkType = (process.env.NEXT_PUBLIC_SOLANA_NETWORK as NetworkType) || 'devnet';

export function getNetworkConfig(network?: NetworkType): NetworkConfig {
  return NETWORK_CONFIGS[network || DEFAULT_NETWORK];
}

export function getCurrentNetwork(): NetworkType {
  if (typeof window !== 'undefined') {
    const stored = localStorage.getItem('solana-network');
    if (stored && (stored === 'mainnet' || stored === 'devnet' || stored === 'testnet')) {
      return stored as NetworkType;
    }
  }
  return DEFAULT_NETWORK;
}

export function setCurrentNetwork(network: NetworkType): void {
  if (typeof window !== 'undefined') {
    localStorage.setItem('solana-network', network);
  }
}

// Testnet Token-Adressen (für Devnet/Testnet)
export const TESTNET_TOKENS = {
  SOL: 'So11111111111111111111111111111111111111112', // SOL ist überall gleich
  USDC_DEVNET: '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU', // USDC auf Devnet
  // Weitere Testnet-Token können hier hinzugefügt werden
};

// Mainnet Token-Adressen
export const MAINNET_TOKENS = {
  SOL: 'So11111111111111111111111111111111111111112',
  USDC: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
  USDT: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB',
};

export function getQuoteTokensForNetwork(network: NetworkType) {
  if (network === 'mainnet') {
    return [
      {
        address: MAINNET_TOKENS.SOL,
        symbol: 'SOL',
        name: 'Solana',
        decimals: 9,
      },
      {
        address: MAINNET_TOKENS.USDC,
        symbol: 'USDC',
        name: 'USD Coin',
        decimals: 6,
      }
    ];
  } else {
    return [
      {
        address: TESTNET_TOKENS.SOL,
        symbol: 'SOL',
        name: 'Solana',
        decimals: 9,
      },
      {
        address: TESTNET_TOKENS.USDC_DEVNET,
        symbol: 'USDC',
        name: 'USD Coin (Devnet)',
        decimals: 6,
      }
    ];
  }
}
