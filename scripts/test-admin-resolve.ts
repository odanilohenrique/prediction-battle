import { createWalletClient, http, publicActions, parseUnits } from 'viem';
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

    // Setup client
    const account = privateKeyToAccount(process.env.PRIVATE_KEY as `0x${string}`);
    const client = createWalletClient({
        account,
        chain: baseSepolia,
        transport: http(),
    }).extend(publicActions);

    console.log(`\n🔍 Debugging Admin Resolve on ${CONTRACT_ADDRESS}`);
    console.log(`👤 Admin: ${account.address}`);

    const { abi } = JSON.parse(fs.readFileSync(ABI_PATH, 'utf8'));

    // Check Admin Status
    try {
        const owner = await client.readContract({
            address: CONTRACT_ADDRESS as `0x${string}`,
            abi,
            functionName: 'owner',
        }).catch(() => 'Unknown');
        console.log(`👑 Contract Owner: ${owner}`);
        if (typeof owner === 'string' && owner.toLowerCase() !== account.address.toLowerCase()) {
            console.warn('⚠️ WALLET IS NOT OWNER! Admin functions will likely revert.');
        } else {
            console.log('✅ Wallet is Owner.');
        }
    } catch (e) { }

    let targetId = process.argv[2];

    if (!targetId) {
        console.log('\n📋 Fetching active predictions from contract...');
        try {
            // Try to get first 20 predictions
            // Adjust function name if needed based on ABI (getPredictions or similar)
            // V3 usually has getPrediction(id) or array getter
            // Let's rely on event logs or just try to find one if possible, 
            // OR just hardcode one if we know it exists.
            // Since we don't have an easy "getAll" without guessing IDs (uups V4 has string IDs),
            // We'll rely on the user passing one OR create a NEW one to test.

            console.log('No ID provided. Creating a TEST prediction to resolve...');
            targetId = `debug-${Date.now()}`;

            const { request } = await client.simulateContract({
                address: CONTRACT_ADDRESS as `0x${string}`,
                abi,
                functionName: 'createPrediction',
                args: [targetId, BigInt(100), BigInt(60)], // $100 bond, 60s
                account
            });
            const hash = await client.writeContract(request);
            console.log(`✨ Creating test prediction ${targetId}... Ref: ${hash}`);
            await client.waitForTransactionReceipt({ hash });
            console.log('✅ Created.');
        } catch (e) {
            console.error('Could not create test prediction:', e);
            return;
        }
    }

    console.log(`\n🎯 Target Market: ${targetId}`);

    // Attempt Verification/Resolution Simulation
    console.log('\n🔄 Simulating adminResolve(true)...');
    try {
        const { request } = await client.simulateContract({
            address: CONTRACT_ADDRESS as `0x${string}`,
            abi,
            functionName: 'adminResolve',
            args: [targetId, true], // Resolve as YES
            account
        });
        console.log('✅ Simulation Successful! Function execution would succeed.');

        // Uncomment to actually execute
        // const hash = await client.writeContract(request);
        // console.log(`🚀 Transaction sent: ${hash}`);
    } catch (e: any) {
        console.error('❌ Simulation Failed!');
        console.error('Message:', e.message || e);

        if (e.message?.includes('Ownable: caller is not the owner')) console.error('👉 REASON: Caller is not owner/admin.');
        if (e.message?.includes('Market not active')) console.error('👉 REASON: Market state is not active (maybe already resolved?).');
    }

    console.log('\n🔄 Simulating voidMarket()...');
    try {
        const { request } = await client.simulateContract({
            address: CONTRACT_ADDRESS as `0x${string}`,
            abi,
            functionName: 'voidMarket',
            args: [targetId],
            account
        });
        console.log('✅ Simulation Successful! Void would succeed.');
    } catch (e: any) {
        console.error('❌ Void Simulation Failed!');
        console.error('Message:', e.message || e);
    }
}

main().catch(console.error);
