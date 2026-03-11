// Configuration for Prediction Battle - TESTNET ONLY (Base Sepolia)

const TESTNET_CONTRACT_ADDRESS = '0x8ce4f5A398D6D80F8387687bEae494Cd8fA2A1E9'; // V10 Audited (Reopen + Flexible Admin)

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
    contractAddress: '0x8ce4f5A398D6D80F8387687bEae494Cd8fA2A1E9', // Base Sepolia V10 Audited
};

// Always use testnet config
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
    '0x1cb36C90dd0278906295D6bc890A2A76E4D8f80b'.toLowerCase(), // Contract Owner (New Wallet)
    '0xFbb847E4bA555fa38C737CAA3E3591B6448cE987'.toLowerCase(), // Operator (New Wallet)
].filter(Boolean);

// Operator address for resolution
export const OPERATOR_ADDRESS = '0xFbb847E4bA555fa38C737CAA3E3591B6448cE987'.toLowerCase();

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
 * FEE STRUCTURE (defined in smart contract V2):
 * - House Fee: 10% (goes to admin wallet) - or 15% if no referrer
 * - Creator Fee: 5% (goes to market creator wallet)
 * - Referrer Fee: 5% (goes to referrer if valid)
 * - Net Bet: 80% (goes to pool)
 * 
 * BOOST CONFIG:
 * - Max Weight: 1.5x (early bets)
 * - Min Weight: 1.0x (after bonus period)
 */
export const HOUSE_FEE_PERCENT = 10;
export const CREATOR_FEE_PERCENT = 5;
export const REFERRER_FEE_PERCENT = 5;
export const NET_BET_PERCENT = 80;
export const MAX_BOOST_MULTIPLIER = 1.5;
export const MIN_BOOST_MULTIPLIER = 1.0;

