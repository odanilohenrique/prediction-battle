export const BLOCK_TIME_SECONDS = 2; // Base (Mainnet & Sepolia) approx 2s per block

/**
 * Estimates the timestamp (ms) for a given future block number.
 * @param deadlineBlock The target block number (bigint or number)
 * @param currentBlock The current block number (bigint or number)
 * @returns Estimated timestamp in milliseconds
 */
export function estimateTimeFromBlocks(deadlineBlock: bigint | number, currentBlock: bigint | number): number {
    const blocksRemaining = Number(deadlineBlock) - Number(currentBlock);
    if (blocksRemaining <= 0) return Date.now();

    const secondsRemaining = blocksRemaining * BLOCK_TIME_SECONDS;
    return Date.now() + (secondsRemaining * 1000);
}

/**
 * Formats remaining blocks into a human-readable duration string.
 * @param deadlineBlock 
 * @param currentBlock 
 * @returns "2h 30m" or "Expired"
 */
export function formatBlockDuration(deadlineBlock: bigint | number, currentBlock: bigint | number): string {
    const blocksRemaining = Number(deadlineBlock) - Number(currentBlock);
    if (blocksRemaining <= 0) return 'Expired';

    const seconds = blocksRemaining * BLOCK_TIME_SECONDS;
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);

    if (hours > 24) {
        const days = Math.floor(hours / 24);
        return `${days}d ${hours % 24}h`;
    }

    return `${hours}h ${minutes}m`;
}
