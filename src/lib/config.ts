// Configuration for Prediction Battle - TESTNET ONLY (Base Sepolia)

// V4 Contract with on-chain referral system
// IMPORTANT: Update this address after deploying PredictionBattleV4.sol
const TESTNET_CONTRACT_ADDRESS_V4 = '0x4c86ae8355468eea52d0b82d12ac54a69483b65b'; // TODO: Deploy V4 and update
const MAINNET_CONTRACT_ADDRESS_V4 = ''; // TODO: Deploy to mainnet

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
    contractAddress: TESTNET_CONTRACT_ADDRESS_V4,
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
    contractAddress: MAINNET_CONTRACT_ADDRESS_V4,
};

// For now, always use testnet
export const CURRENT_CONFIG = TESTNET_CONFIG;

// Helper that NEVER returns empty - use this everywhere
export function getContractAddress(): `0x${string}` {
    const addr = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS || TESTNET_CONTRACT_ADDRESS_V4;
    if (!addr || addr.length < 10) {
        console.warn('[CONFIG] Contract address missing, using hardcoded fallback');
        return TESTNET_CONTRACT_ADDRESS_V4 as `0x${string}`;
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
 * FEE STRUCTURE (PredictionBattleV4.sol):
 * 
 * Total Pool = 100%
 * 
 * Platform Fee: 20% of total pool
 *   - 75% to Admin (15% of total)
 *   - 25% to Referral Pool (5% of total, distributed proportionally)
 * 
 * Creator Fee: 5% of total pool
 * 
 * Winners Pool: 75% of total pool
 * 
 * Referral Distribution:
 *   Each referrer gets: (referred_amount / total_referred) * referral_pool
 */
export const PLATFORM_FEE_PERCENT = 20;
export const CREATOR_FEE_PERCENT = 5;
export const REFERRAL_SHARE_PERCENT = 25; // 25% of platform fee = 5% of total
export const HOUSE_NET_PERCENT = 15; // 75% of platform fee = 15% of total
export const WINNERS_POOL_PERCENT = 75;

