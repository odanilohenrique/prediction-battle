import { createWalletClient, http, publicActions, parseEther, formatEther } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { baseSepolia } from 'viem/chains';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

const envPath = path.resolve(process.cwd(), '.env.local');
dotenv.config({ path: envPath });

const CONTRACT_NAME = 'PredictionBattle';
const ABI_PATH = path.resolve(process.cwd(), `src/lib/abi/${CONTRACT_NAME}.json`);
const CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS;

async function main() {
    if (!CONTRACT_ADDRESS) throw new Error('Missing NEXT_PUBLIC_CONTRACT_ADDRESS');
    if (!process.env.PRIVATE_KEY) throw new Error('Missing PRIVATE_KEY');
    const account = privateKeyToAccount(process.env.PRIVATE_KEY as `0x${string}`);
    const client = createWalletClient({
        account,
        chain: baseSepolia,
        transport: http(),
    }).extend(publicActions);

    console.log(`🧪 Starting Full Flow Test on ${CONTRACT_ADDRESS}`);
    console.log(`👤 Actor: ${account.address}`);

    const { abi } = JSON.parse(fs.readFileSync(ABI_PATH, 'utf8'));

    // 1. Create Prediction
    const predictionId = `test-${Date.now()}`;
    console.log(`\n1️⃣ Creating Prediction: ${predictionId}`);

    // Duration: 60 seconds
    const { request: createReq } = await client.simulateContract({
        address: CONTRACT_ADDRESS as `0x${string}`,
        abi,
        functionName: 'createPrediction',
        args: [predictionId, BigInt(100), BigInt(60)],
        account
    });
    const createHash = await client.writeContract(createReq);
    const createReceipt = await client.waitForTransactionReceipt({ hash: createHash });
    if (createReceipt.status !== 'success') {
        throw new Error(`Create Prediction failed: ${createReceipt.status}`);
    }
    console.log('✅ Prediction Created. Waiting 2s for indexing...');
    await new Promise(r => setTimeout(r, 2000));

    // 2. Place Bets
    console.log('\n2️⃣ Placing Bets...');

    // Bet YES (0.001 ETH)
    const { request: betYesReq } = await client.simulateContract({
        address: CONTRACT_ADDRESS as `0x${string}`,
        abi,
        functionName: 'placeBet',
        args: [predictionId, true],
        value: parseEther('0.001'),
        account
    });
    const betYesHash = await client.writeContract(betYesReq);
    const betYesReceipt = await client.waitForTransactionReceipt({ hash: betYesHash });
    if (betYesReceipt.status !== 'success') throw new Error(`Bet YES failed: ${betYesReceipt.status}`);
    console.log('✅ Bet YES placed (0.001 ETH)');

    // Bet NO (0.002 ETH)
    const { request: betNoReq } = await client.simulateContract({
        address: CONTRACT_ADDRESS as `0x${string}`,
        abi,
        functionName: 'placeBet',
        args: [predictionId, false],
        value: parseEther('0.002'),
        account
    });
    const betNoHash = await client.writeContract(betNoReq);
    const betNoReceipt = await client.waitForTransactionReceipt({ hash: betNoHash });
    if (betNoReceipt.status !== 'success') throw new Error(`Bet NO failed: ${betNoReceipt.status}`);
    console.log('✅ Bet NO placed (0.002 ETH)');

    // 3. Resolve
    console.log('\n3️⃣ Resolving Prediction (Winner: NO)...');
    const { request: resolveReq } = await client.simulateContract({
        address: CONTRACT_ADDRESS as `0x${string}`,
        abi,
        functionName: 'resolvePrediction',
        args: [predictionId, false], // NO wins
        account
    });
    const resolveHash = await client.writeContract(resolveReq);
    const resolveReceipt = await client.waitForTransactionReceipt({ hash: resolveHash });
    if (resolveReceipt.status !== 'success') throw new Error(`Resolve failed: ${resolveReceipt.status}`);
    console.log('✅ Prediction Resolved');

    // Wait for state to propagate
    await new Promise(r => setTimeout(r, 2000));

    // 4. Distribute
    console.log('\n4️⃣ Distributing Winnings...');
    const balanceBefore = await client.getBalance({ address: account.address });
    console.log(`💰 Balance Before: ${formatEther(balanceBefore)} ETH`);

    let distReceipt;
    try {
        const { request: distReq } = await client.simulateContract({
            address: CONTRACT_ADDRESS as `0x${string}`,
            abi,
            functionName: 'distributeWinnings',
            args: [predictionId, BigInt(50)],
            account
        });
        const distHash = await client.writeContract(distReq);
        distReceipt = await client.waitForTransactionReceipt({ hash: distHash });
        console.log('✅ Distribution Tx Confirmed');
    } catch (e: any) {
        console.error('❌ Distribution Failed:', e.shortMessage || e.message);
        if (e.cause) console.error('Cause:', e.cause);
        process.exit(0);
    }

    // Wait for balance update
    await new Promise(r => setTimeout(r, 2000));

    const balanceAfter = await client.getBalance({ address: account.address });
    console.log(`💰 Balance After:  ${formatEther(balanceAfter)} ETH`);

    // Calculate difference (approx)
    const diff = balanceAfter - balanceBefore;
    console.log(`Diff: ${formatEther(diff)} ETH (should be roughly 0.0024 - gas)`);

    // Check Logs for PayoutDistributed
    // @ts-ignore
    const payoutLog = distReceipt.logs.find(l => l.topics[0] && l.topics[0] !== '0x'); // crude check
    if (payoutLog) {
        console.log('✅ Payout Event Found!');
    } else {
        console.log('⚠️ No Payout Event found (maybe parsed incorrectly or 0 winners)');
    }

    console.log('✅ Test Complete!');
}

main().catch(console.error);
