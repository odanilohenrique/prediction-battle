// Configuration for Prediction Battle - TESTNET ONLY (Base Sepolia)

// New deployed contract with creator fee + void support
const TESTNET_CONTRACT_ADDRESS = '0x0c930e311be41816da03b0634808636fb176df25';

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
    contractAddress: TESTNET_CONTRACT_ADDRESS,
};

export const MAINNET_CONFIG = {
    chainId: 8453, // Base Mainnet
    chainName: 'Base Mainnet',
    rpcUrl: 'https://mainnet.base.org',
    blockExplorer: 'https://basescan.org',
    nativeCurrency: {
        name: 'Ethereum',
        symbol: 'ETH',
        decimals: 18,
    },
    usdcAddress: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', // USDC on Base Mainnet
    contractAddress: '', // To be deployed
};

// For now, always use testnet
export const CURRENT_CONFIG = TESTNET_CONFIG;

// Helper that NEVER returns empty - use this everywhere
export function getContractAddress(): `0x${string}` {
    const addr = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS || TESTNET_CONTRACT_ADDRESS;
    if (!addr || addr.length < 10) {
        console.warn('[CONFIG] Contract address missing, using hardcoded fallback');
        return TESTNET_CONTRACT_ADDRESS as `0x${string}`;
    }
    return addr as `0x${string}`;
}

// Helper for USDC address
export function getUsdcAddress(): `0x${string}` {
    return TESTNET_CONFIG.usdcAddress as `0x${string}`;
}

// Admin wallet addresses (whitelist)
export const ADMIN_ADDRESSES = [
    process.env.NEXT_PUBLIC_ADMIN_ADDRESS?.toLowerCase() || '',
    '0xfbb847e4ba555fa38c737caa3e3591b6448ce987', // User's Admin Wallet
    '0xfa278965a56a16252ccb850d3bb354f6a6e9fb02', // Operator Wallet
].filter(Boolean);

// Operator address for resolution
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

/**
 * FEE STRUCTURE (defined in smart contract):
 * - Platform Fee: 20% (goes to admin wallet)
 * - Creator Fee: 5% (goes to market creator wallet)
 * - Winners Pool: 75% (distributed to winners)
 * 
 * MULTIPLIER for UI: 1.75x max (since 75% of pool goes to winners)
 */
export const PLATFORM_FEE_PERCENT = 20;
export const CREATOR_FEE_PERCENT = 5;
export const WINNERS_POOL_PERCENT = 75;
export const MAX_MULTIPLIER = 1.75;
