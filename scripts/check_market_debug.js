
const { createPublicClient, http, parseAbiItem, defineChain } = require('viem');

// Base Sepolia Chain Definition
const baseSepolia = defineChain({
    id: 84532,
    name: 'Base Sepolia',
    network: 'base-sepolia',
    nativeCurrency: {
        decimals: 18,
        name: 'Ether',
        symbol: 'ETH',
    },
    rpcUrls: {
        default: { http: ['https://sepolia.base.org'] },
        public: { http: ['https://sepolia.base.org'] },
    },
    blockExplorers: {
        default: { name: 'Basescan', url: 'https://sepolia.basescan.org' },
    },
    testnet: true,
});

const client = createPublicClient({
    chain: baseSepolia,
    transport: http(),
});

const CONTRACT_ADDRESS = '0xf3fa5c49a17850bf2147fbe5fb731194a59d0301';

const ABI = [
    {
        "inputs": [{ "name": "", "type": "string" }],
        "name": "markets",
        "outputs": [
            { "name": "id", "type": "string" },
            { "name": "creator", "type": "address" },
            { "name": "question", "type": "string" },
            { "name": "creationTime", "type": "uint256" },
            { "name": "bonusDuration", "type": "uint256" },
            { "name": "deadline", "type": "uint256" },
            { "name": "state", "type": "uint8" },
            { "name": "result", "type": "bool" },
            { "name": "isVoid", "type": "bool" },
            { "name": "proposer", "type": "address" },
            { "name": "proposedResult", "type": "bool" },
            { "name": "proposalTime", "type": "uint256" },
            { "name": "bondAmount", "type": "uint256" },
            { "name": "evidenceUrl", "type": "string" },
            { "name": "challenger", "type": "address" },
            { "name": "challengeBondAmount", "type": "uint256" },
            { "name": "challengeEvidenceUrl", "type": "string" },
            { "name": "challengeTime", "type": "uint256" },
            { "name": "totalYes", "type": "uint256" },
            { "name": "totalNo", "type": "uint256" }
        ],
        "stateMutability": "view",
        "type": "function"
    }
];

const MARKET_ID = 'pred_1769797871455_asvlrck';

async function checkMarket() {
    console.log(`Checking market: ${MARKET_ID} on ${CONTRACT_ADDRESS}`);
    try {
        const adminAddress = await client.readContract({
            address: CONTRACT_ADDRESS,
            abi: [{ inputs: [], name: 'admin', outputs: [{ type: 'address' }], type: 'function' }],
            functionName: 'admin',
        });
        console.log("Contract Admin:", adminAddress);

        const data = await client.readContract({
            address: CONTRACT_ADDRESS,
            abi: ABI,
            functionName: 'markets',
            args: [MARKET_ID]
        });

        console.log("Market Data:");
        console.log("ID:", data[0]);
        console.log("Creator:", data[1]);
        console.log("State:", data[6]); // 0=Open, 1=Locked, 2=Proposed, 3=Disputed, 4=Resolved
        console.log("Proposed Result:", data[10]);
        console.log("Proposer:", data[9]);
        console.log("Challenger:", data[14]);
        console.log("Total Yes:", data[18]);
        console.log("Total No:", data[19]);

        const states = ['OPEN', 'LOCKED', 'PROPOSED', 'DISPUTED', 'RESOLVED'];
        console.log(`Current State: ${states[data[6]]} (${data[6]})`);

    } catch (error) {
        console.error("Error reading contract:", error);
    }
}

checkMarket();
