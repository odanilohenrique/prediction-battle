
import { createPublicClient, http, parseAbiItem, formatUnits } from 'viem';
import { baseSepolia } from 'viem/chains';

// V6.1 Contract
const CONTRACT_ADDRESS = '0xecCCd74B321445C459305363898e5653BeAceee0';
const RPC_URL = 'https://base-sepolia-rpc.publicnode.com';

async function main() {
    const client = createPublicClient({
        chain: baseSepolia,
        transport: http(RPC_URL)
    });

    const currentBlock = await client.getBlockNumber();
    const fromBlock = currentBlock - BigInt(50000); // Last ~24h (Base has fast blocks)

    console.log(`🔍 Scanning from block ${fromBlock} to ${currentBlock}...`);

    // 1. Find last MarketResolved event
    const resolveLogs = await client.getLogs({
        address: CONTRACT_ADDRESS,
        event: parseAbiItem('event MarketResolved(string id, bool result, uint256 winnerPool)'),
        fromBlock: fromBlock
    });

    if (resolveLogs.length === 0) {
        console.log('❌ No resolved markets found.');
        return;
    }

    const lastEvent = resolveLogs[resolveLogs.length - 1];
    const marketId = lastEvent.args.id;
    console.log(`✅ Found Market: ${marketId}`);
    console.log(`   Result: ${lastEvent.args.result ? 'YES' : 'NO'}`);
    console.log(`   Block: ${lastEvent.blockNumber}`);

    // 2. Check PayoutClaimed Events for this Market
    console.log('\n🔍 Checking Payout Claims...');
    const claimLogs = await client.getLogs({
        address: CONTRACT_ADDRESS,
        event: parseAbiItem('event PayoutClaimed(string id, address user, uint256 amount)'),
        // args: { id: marketId },  <-- REMOVED to catch non-indexed events
        fromBlock: lastEvent.blockNumber
    });

    if (claimLogs.length === 0) {
        console.log('⚠️ No payouts claimed yet for this market (No events found globally).');
    } else {
        let foundClaim = false;
        claimLogs.forEach(log => {
            if (log.args.id === marketId) {
                console.log(`   💸 Claimed: ${formatUnits(log.args.amount || BigInt(0), 6)} USDC by ${log.args.user}`);
                foundClaim = true;
            }
        });

        if (!foundClaim) {
            console.log('⚠️ Payout events found, but none matched this specific Market ID.');
        }
    }

    // 3. Check Bond Withdrawals (Global, but likely triggered after this resolution)
    console.log('\n🔍 Checking Bond Withdrawals (Recent)...');
    const bondLogs = await client.getLogs({
        address: CONTRACT_ADDRESS,
        event: parseAbiItem('event BondWithdrawn(address user, uint256 amount)'),
        fromBlock: lastEvent.blockNumber
    });

    if (bondLogs.length === 0) {
        console.log('⚠️ No bonds withdrawn since resolution.');
    } else {
        bondLogs.forEach(log => {
            console.log(`   🛡️ Bond Withdrawn: ${formatUnits(log.args.amount || BigInt(0), 6)} USDC by ${log.args.user}`);
        });
    }

    // 4. Check Creator Fee Withdrawals
    console.log('\n🔍 Checking Creator Fee Withdrawals (Recent)...');
    // Note: Creator fees are not emitted with ID, so we just check recent global withdrawals
    // However, we can check the Transfer events from the contract to infer.
    // Actually, `withdrawCreatorFees` is a function, let's check ERC20 transfers from contract?
    // Simplified: Just checking if `withdrawCreatorFees` was called via logs won't show ID, but shows activity.
    // But `MarketCreated` tells us who the creator is.

    // Get creator from creation event
    /*
    const createLogs = await client.getLogs({
        address: CONTRACT_ADDRESS,
        event: parseAbiItem('event MarketCreated(string id, address creator, uint256 deadline, uint256 bonusDuration)'),
        args: { id: marketId },
        fromBlock: 0n
    });
    const creator = createLogs[0]?.args.creator;
    console.log(`   🎨 Creator: ${creator}`);
    */

    // Actually simpler to check balance. If balance is 0, they likely claimed (or never had fees).
}

main().catch(console.error);
