
import { createWalletClient, createPublicClient, http, publicActions, parseUnits, formatUnits } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { baseSepolia } from 'viem/chains';
import { CURRENT_CONFIG } from '../src/lib/config';
import PredictionBattleABI from '../src/lib/abi/PredictionBattle.json';
import * as dotenv from 'dotenv';
import path from 'path';

// Load env from .env.local
const envPath = path.resolve(process.cwd(), '.env.local');
dotenv.config({ path: envPath });

const USDC_ABI = [
    {
        name: 'approve',
        type: 'function',
        stateMutability: 'nonpayable',
        inputs: [{ name: 'spender', type: 'address' }, { name: 'amount', type: 'uint256' }],
        outputs: [{ type: 'bool' }]
    }
] as const;

async function main() {
    if (!process.env.PRIVATE_KEY) throw new Error('Missing PRIVATE_KEY');

    // Setup clients
    const account = privateKeyToAccount(process.env.PRIVATE_KEY as `0x${string}`);
    const client = createWalletClient({
        account,
        chain: baseSepolia,
        transport: http(process.env.NEXT_PUBLIC_RPC_URL || 'https://sepolia.base.org'),
    }).extend(publicActions);

    const publicClient = createPublicClient({
        chain: baseSepolia,
        transport: http(process.env.NEXT_PUBLIC_RPC_URL || 'https://sepolia.base.org'),
    });

    const CONTRACT_ADDRESS = CURRENT_CONFIG.contractAddress as `0x${string}`;
    const USDC_ADDRESS = CURRENT_CONFIG.usdcAddress as `0x${string}`;

    console.log(`🧪 Testing Bond Logic on V3 Contract: ${CONTRACT_ADDRESS}`);
    console.log(`👤 Actor: ${account.address}`);

    // 1. Create Market
    const marketId = `test-bond-${Date.now()}`;
    const seedAmount = parseUnits('2', 6); // 2 USDC Seed (Must be even)
    console.log(`\n1️⃣ Creating Market: ${marketId}`);

    // Approve Seed
    console.log('Approving USDC for seed...');
    const approveHash = await client.writeContract({
        address: USDC_ADDRESS,
        abi: USDC_ABI,
        functionName: 'approve',
        args: [CONTRACT_ADDRESS, parseUnits('1000', 6)], // Approve plenty
    });
    // await publicClient.waitForTransactionReceipt({ hash: approveHash }); 
    // Optimization: Don't wait strictly if nonce is handled, but here let's wait to be safe.
    await publicClient.waitForTransactionReceipt({ hash: approveHash });
    console.log('Approved.');

    // Create Market
    const { request: createReq } = await publicClient.simulateContract({
        address: CONTRACT_ADDRESS,
        abi: PredictionBattleABI.abi,
        functionName: 'createMarket',
        args: [marketId, "Will bond scale?", seedAmount, 3600n, 3600n],
        account
    });
    const createHash = await client.writeContract(createReq);
    await publicClient.waitForTransactionReceipt({ hash: createHash });
    console.log('✅ Market Created.');

    // 2. Place LARGE Bet to exceed 20 USDC pool
    // Need > 20 USDC pool. 
    // Seed is 2. We need +19 more. 
    // Bet 50 USDC.
    const betAmount = parseUnits('50', 6);
    console.log(`\n2️⃣ Placing Bet of 50 USDC...`);

    const { request: betReq } = await publicClient.simulateContract({
        address: CONTRACT_ADDRESS,
        abi: PredictionBattleABI.abi,
        functionName: 'placeBet',
        args: [marketId, true, betAmount, '0x0000000000000000000000000000000000000000'],
        account
    });
    const betHash = await client.writeContract(betReq);
    await publicClient.waitForTransactionReceipt({ hash: betHash });
    console.log('✅ Bet Placed.');

    // 3. Check Bond
    console.log(`\n3️⃣ Verifying Bond...`);

    // Get Market Info
    const marketInfo = await publicClient.readContract({
        address: CONTRACT_ADDRESS,
        abi: PredictionBattleABI.abi,
        functionName: 'getMarketInfo',
        args: [marketId]
    }) as any;

    const totalYes = marketInfo[4];
    const totalNo = marketInfo[5];
    const totalPool = totalYes + totalNo;

    console.log(`Total Pool in Contract: ${formatUnits(totalPool, 6)} USDC`);

    // Get Required Bond
    const requiredBond = await publicClient.readContract({
        address: CONTRACT_ADDRESS,
        abi: PredictionBattleABI.abi,
        functionName: 'getRequiredBond',
        args: [marketId]
    }) as bigint;

    console.log(`Required Bond from Contract: ${formatUnits(requiredBond, 6)} USDC`);

    // Verification
    // 5% of Pool
    const expected = (totalPool * 500n) / 10000n;
    const finalExpected = expected > parseUnits('1', 6) ? expected : parseUnits('1', 6);

    console.log(`Expected (5%): ${formatUnits(expected, 6)} USDC`);
    console.log(`Min Bond Floor: 1.0 USDC`);

    if (requiredBond > parseUnits('1', 6)) {
        console.log("SUCCESS: Bond scaled above 1 USDC!");
        console.log(`Bond is: ${formatUnits(requiredBond, 6)} USDC`);
    } else {
        console.log("FAILURE? Bond stuck at 1 USDC?");
    }
}

main().catch(console.error);
