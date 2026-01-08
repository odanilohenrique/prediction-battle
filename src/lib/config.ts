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
    contractAddress: process.env.NEXT_PUBLIC_CONTRACT_ADDRESS || '0x5ad3587dad161f4afa7c8a9d1b561a4615eb482a',
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

// Use testnet by default, can be changed via env var
export const CURRENT_CONFIG = process.env.NEXT_PUBLIC_USE_MAINNET === 'true'
    ? MAINNET_CONFIG
    : TESTNET_CONFIG;

// Admin wallet addresses (whitelist)
export const ADMIN_ADDRESSES = [
    // Add your admin wallet address here
    process.env.NEXT_PUBLIC_ADMIN_ADDRESS?.toLowerCase() || '',
    '0xfbb847e4ba555fa38c737caa3e3591b6448ce987', // User's Wallet
].filter(Boolean);

// Check if address is admin
export function isAdmin(address: string): boolean {
    return ADMIN_ADDRESSES.includes(address.toLowerCase());
}

// Faucets for testnet tokens
export const TESTNET_FAUCETS = {
    eth: 'https://www.coinbase.com/faucets/base-ethereum-goerli-faucet',
    usdc: 'https://faucet.circle.com/', // Circle USDC faucet
};
