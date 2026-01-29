import { createPublicClient, http, formatUnits, parseUnits } from 'viem';
import { baseSepolia } from 'viem/chains';
import { store } from '../src/lib/store';
import { CURRENT_CONFIG } from '../src/lib/config';
import PredictionBattleABI from '../src/lib/abi/PredictionBattle.json';
import * as dotenv from 'dotenv';
import path from 'path';

// Load env vars
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

// Setup Client
const client = createPublicClient({
    chain: baseSepolia,
    transport: http(process.env.NEXT_PUBLIC_RPC_URL || 'https://sepolia.base.org')
});

async function main() {
    console.log('🔍 STARTING ON-CHAIN AUDIT...\n');

    // 1. Get Market ID
    let marketId: string;

    const args = process.argv.slice(2);
    if (args.length > 0) {
        marketId = args[0];
        console.log(`Querying provided Market ID: ${marketId}`);
    } else {
        console.log('No Market ID provided. Fetching latest from DB...');
        const bets = await store.getBets();
        const target = bets.find(b => b.status === 'completed') || bets[0];
        if (!target) {
            console.error('❌ No markets found in DB.');
            process.exit(1);
        }
        marketId = target.id;
        console.log(`Audit Target (Latest): ${marketId} (${target.status})`);
    }

    const contractAddr = CURRENT_CONFIG.contractAddress as `0x${string}`;
    console.log(`\n📡 Fetching On-Chain Data for: ${marketId}`);
    console.log(`   Contract Address: ${contractAddr} (Base Sepolia)`);

    // Check code existence
    const code = await client.getBytecode({ address: contractAddr });
    if (!code) {
        console.error(`❌ No contract code found at ${contractAddr}. Address might be wrong or on wrong network.`);
        process.exit(1);
    }

    try {
        const marketData = await client.readContract({
            address: contractAddr,
            abi: PredictionBattleABI.abi,
            functionName: 'markets',
            args: [marketId]
        }) as any[];

        if (!marketData || marketData.length === 0) {
            console.error('❌ Market not found on-chain!');
            process.exit(1);
        }

        const stateEnum = ['OPEN', 'LOCKED', 'PROPOSED', 'DISPUTED', 'RESOLVED'];

        const creator = marketData[1];
        const question = marketData[2];
        const state = Number(marketData[6]);
        const result = marketData[7] as boolean;
        const isVoid = marketData[8] as boolean;
        const proposer = marketData[9];
        const bondAmount = BigInt(marketData[12]);
        const challenger = marketData[14];
        const challengeBondAmount = BigInt(marketData[15]);

        const totalYes = BigInt(marketData[18]);
        const totalNo = BigInt(marketData[19]);
        const totalPool = totalYes + totalNo;

        console.log(`\n📊 MARKET STATUS: ${stateEnum[state] || state}`);
        console.log(`Question: ${question}`);
        console.log(`Creator: ${creator}`);
        console.log(`VOIDED: ${isVoid}`);
        if (state === 4) {
            if (isVoid) {
                console.log(`RESULT: ⚠️ VOID (REFUND)`);
            } else {
                console.log(`RESULT: 🏆 ${result ? 'YES' : 'NO'}`);
            }
        }

        console.log(`\n💰 POOL STATS:`);
        console.log(`Total YES: $${formatUnits(totalYes, 6)}`);
        console.log(`Total NO:  $${formatUnits(totalNo, 6)}`);
        console.log(`TOTAL POT: $${formatUnits(totalPool, 6)}`);

        // Creator Fees
        const creatorBalance = await client.readContract({
            address: contractAddr,
            abi: PredictionBattleABI.abi,
            functionName: 'creatorBalance',
            args: [creator]
        }) as bigint;

        console.log(`\n💸 CREATOR FEES:`);
        console.log(`Unclaimed Balance for ${creator}: $${formatUnits(creatorBalance, 6)}`);

        // Verification
        console.log(`\n🛡️ VERIFICATION:`);
        console.log(`Proposer: ${proposer}`);
        console.log(`Proposer Bond: $${formatUnits(bondAmount, 6)}`);
        if (challenger && challenger !== '0x0000000000000000000000000000000000000000') {
            console.log(`Challenger: ${challenger}`);
            console.log(`Challenger Bond: $${formatUnits(challengeBondAmount, 6)}`);
        } else {
            console.log(`Challenger: None`);
        }

        // Winners check
        console.log(`\n🏆 USER VERIFICATION (From DB Record):`);
        const dbBet = await store.getBet(marketId);
        if (dbBet) {
            const participants = [
                ...dbBet.participants.yes.map(p => ({ ...p, side: 'yes' })),
                ...dbBet.participants.no.map(p => ({ ...p, side: 'no' }))
            ];

            for (const p of participants) {
                const mappingName = p.side === 'yes' ? 'yesBets' : 'noBets';
                const betData = await client.readContract({
                    address: contractAddr,
                    abi: PredictionBattleABI.abi,
                    functionName: mappingName,
                    args: [marketId, p.userId]
                }) as any[];

                const amount = BigInt(betData[0]);
                const claimed = betData[3] as boolean;

                if (amount === 0n) continue;

                console.log(`\n👤 User: ${p.userId} (${p.side.toUpperCase()})`);
                console.log(`   Bet: $${formatUnits(amount, 6)}`);
                console.log(`   Claimed: ${claimed ? '✅ YES' : '❌ NO'}`);

                if (isVoid) {
                    console.log(`   Expected: REFUND $${formatUnits(amount, 6)}`);
                } else if ((p.side === 'yes') === result) {
                    console.log(`   Expected: WIN (Payout > Bet)`);
                } else {
                    console.log(`   Expected: LOSS $0`);
                }
            }
        }
    } catch (err) {
        console.error('Audit failed:', err);
    }
}

main().catch(console.error);
