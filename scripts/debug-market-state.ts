import { createPublicClient, http } from 'viem';
import { baseSepolia } from 'viem/chains';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const MARKET_ID = 'pred_1769624319168_n123orr'; // newest market
const CONTRACT_ADDRESS = '0x661766afe3e2c7f6c7fecc8b229b7211fcd6e907'; // lowercase to avoid checksum issues
const RPC_URL = 'https://sepolia.base.org';

const ABI = [
    {
        "inputs": [{ "internalType": "string", "name": "", "type": "string" }],
        "name": "markets",
        "outputs": [
            { "internalType": "string", "name": "id", "type": "string" },
            { "internalType": "address", "name": "creator", "type": "address" },
            { "internalType": "string", "name": "question", "type": "string" },
            { "internalType": "uint256", "name": "creationTime", "type": "uint256" },
            { "internalType": "uint256", "name": "bonusDuration", "type": "uint256" },
            { "internalType": "uint256", "name": "deadline", "type": "uint256" },
            { "internalType": "uint8", "name": "state", "type": "uint8" },
            { "internalType": "bool", "name": "result", "type": "bool" },
            { "internalType": "bool", "name": "isVoid", "type": "bool" },
            { "internalType": "address", "name": "proposer", "type": "address" },
            { "internalType": "bool", "name": "proposedResult", "type": "bool" },
            { "internalType": "uint256", "name": "proposalTime", "type": "uint256" },
            { "internalType": "uint256", "name": "bondAmount", "type": "uint256" },
            { "internalType": "string", "name": "evidenceUrl", "type": "string" },
            { "internalType": "address", "name": "challenger", "type": "address" },
            { "internalType": "uint256", "name": "challengeBondAmount", "type": "uint256" },
            { "internalType": "string", "name": "challengeEvidenceUrl", "type": "string" },
            { "internalType": "uint256", "name": "challengeTime", "type": "uint256" },
            { "internalType": "uint256", "name": "totalYes", "type": "uint256" },
            { "internalType": "uint256", "name": "totalNo", "type": "uint256" }
        ],
        "stateMutability": "view",
        "type": "function"
    }
] as const;

const STATE_NAMES = ['OPEN', 'LOCKED', 'PROPOSED', 'DISPUTED', 'RESOLVED'];

async function main() {
    console.log('='.repeat(60));
    console.log('DEBUG: Reading On-Chain Market State');
    console.log('='.repeat(60));
    console.log(`Contract: ${CONTRACT_ADDRESS}`);
    console.log(`Market ID: ${MARKET_ID}`);
    console.log(`RPC: ${RPC_URL}`);
    console.log('='.repeat(60));

    const client = createPublicClient({
        chain: baseSepolia,
        transport: http(RPC_URL),
    });

    try {
        const data = await client.readContract({
            address: CONTRACT_ADDRESS as `0x${string}`,
            abi: ABI,
            functionName: 'markets',
            args: [MARKET_ID],
        });

        console.log('\n📊 MARKET DATA:');
        console.log('-'.repeat(60));
        console.log(`ID:              ${data[0]}`);
        console.log(`Creator:         ${data[1]}`);
        console.log(`Question:        ${data[2]}`);
        console.log(`Creation Time:   ${new Date(Number(data[3]) * 1000).toISOString()}`);
        console.log(`Deadline:        ${new Date(Number(data[5]) * 1000).toISOString()}`);
        console.log(`State:           ${data[6]} (${STATE_NAMES[data[6]] || 'UNKNOWN'})`);
        console.log(`Result:          ${data[7]}`);
        console.log(`Is Void:         ${data[8]}`);

        console.log('\n🗳️ VERIFICATION DATA:');
        console.log('-'.repeat(60));
        console.log(`Proposer:        ${data[9]}`);
        console.log(`Proposed Result: ${data[10]}`);
        console.log(`Proposal Time:   ${Number(data[11]) > 0 ? new Date(Number(data[11]) * 1000).toISOString() : 'N/A'}`);
        console.log(`Bond Amount:     ${data[12]}`);
        console.log(`Evidence URL:    ${data[13] || 'None'}`);

        console.log('\n⚔️ DISPUTE DATA:');
        console.log('-'.repeat(60));
        console.log(`Challenger:      ${data[14]}`);
        console.log(`Challenge Bond:  ${data[15]}`);
        console.log(`Challenge Evid:  ${data[16] || 'None'}`);
        console.log(`Challenge Time:  ${Number(data[17]) > 0 ? new Date(Number(data[17]) * 1000).toISOString() : 'N/A'}`);

        console.log('\n💰 POOL DATA:');
        console.log('-'.repeat(60));
        console.log(`Total YES:       ${data[18]}`);
        console.log(`Total NO:        ${data[19]}`);

        console.log('\n='.repeat(60));
        console.log('ANALYSIS:');
        console.log('-'.repeat(60));

        const stateNum = data[6];
        const proposer = data[9];
        const challenger = data[14];
        const isZeroAddress = (addr: string) => addr === '0x0000000000000000000000000000000000000000';

        if (stateNum === 3) { // DISPUTED
            console.log('✅ Market is in DISPUTED state.');
            if (isZeroAddress(proposer)) {
                console.log('⚠️ WARNING: Proposer address is 0x0000... (empty)');
            }
            if (isZeroAddress(challenger)) {
                console.log('⚠️ WARNING: Challenger address is 0x0000... (empty)');
            }
        } else {
            console.log(`❌ Market is NOT in DISPUTED state. Current: ${STATE_NAMES[stateNum]}`);
        }

        console.log('='.repeat(60));

    } catch (error) {
        console.error('❌ Error reading contract:', error);
    }
}

main();
