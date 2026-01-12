// Testnet Configuration for Base Sepolia

export const TESTNET_CONFIG = {
    chainId: 84532, // Base Sepolia
    chainName: 'Base Sepolia',
    rpcUrl: 'https://sepolia.base.org',
    blockExplorer: 'https://sepolia.basescan.org',
    nativeCurrency: {
        name: 'Ethereum',
        symbol: 'ETH',
        decimals: 18,
    },
    usdcAddress: '0x036CbD53842c5426634e7929541eC2318f3dCF7e', // USDC on Base Sepolia
    contractAddress: process.env.NEXT_PUBLIC_CONTRACT_ADDRESS || '0x8d511d4e58021b2847aab2cbdd031dee9a3f445c',
};

export const MAINNET_CONFIG = {
    chainId: 8453, // Base Mainnet
    chainName: 'Base',
    rpcUrl: 'https://mainnet.base.org',
    blockExplorer: 'https://basescan.org',
    nativeCurrency: {
        name: 'Ethereum',
        symbol: 'ETH',
        decimals: 18,
    },
    usdcAddress: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', // USDC on Base Mainnet
    contractAddress: '', // Fill when deployed to mainnet
};

// Use dynamic config based on LocalStorage (Client) or Env (Server)
const isMainnetEnv = process.env.NEXT_PUBLIC_USE_MAINNET === 'true';

const getMainnetState = () => {
    if (typeof window !== 'undefined') {
        const stored = localStorage.getItem('prediction-battle-is-mainnet');
        if (stored !== null) return stored === 'true';
    }
    return isMainnetEnv;
}

export const CURRENT_CONFIG = getMainnetState()
    ? MAINNET_CONFIG
    : TESTNET_CONFIG;

// Admin wallet addresses (whitelist)
export const ADMIN_ADDRESSES = [
    // Add your admin wallet address here
    process.env.NEXT_PUBLIC_ADMIN_ADDRESS?.toLowerCase() || '',
    '0xfbb847e4ba555fa38c737caa3e3591b6448ce987', // User's Wallet
].filter(Boolean);

export const OPERATOR_ADDRESS = '0xFA278965A56a16252ccB850d3bB354f6a6E9fB02'.toLowerCase();

// Check if address is admin
export function isAdmin(address: string): boolean {
    return ADMIN_ADDRESSES.includes(address.toLowerCase());
}

// Faucets for testnet tokens
export const TESTNET_FAUCETS = {
    eth: 'https://www.coinbase.com/faucets/base-ethereum-goerli-faucet',
    usdc: 'https://faucet.circle.com/', // Circle USDC faucet
};

export const LEGACY_CONTRACT_ADDRESS = '0x1e57a200b5aa90e44701e4bba0b70a02c7d074c4'; // Prior to creator fee / void fix

export function getContractAddressForBet(createdAt: number): string {
    // Cutoff: Creation time of the deployment (Approx 2026-01-12 18:00 UTC)
    // Timestamp: 1768245000000 
    const CUTOFF_TIMESTAMP = 1768245000000;

    if (createdAt < CUTOFF_TIMESTAMP) {
        return LEGACY_CONTRACT_ADDRESS;
    }
    return CURRENT_CONFIG.contractAddress;
}
