
const { ethers } = require("hardhat");
require('dotenv').config({ path: '.env.local' });

async function main() {
    const rpcUrl = "https://base-sepolia-rpc.publicnode.com";
    const provider = new ethers.JsonRpcProvider(rpcUrl);

    const contractAddress = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS;
    console.log(`Analyzing contract at: ${contractAddress}`);

    const abi = [
        "event MarketCreated(string indexed id, address indexed creator, uint256 deadlineBlock, uint256 bonusDuration)",
        "event BetPlaced(string indexed id, address indexed user, bool side, uint256 amount, uint256 shares, address referrer, uint256 weight)"
    ];

    const contract = new ethers.Contract(contractAddress, abi, provider);
    const currentBlock = await provider.getBlockNumber();
    const fromBlock = currentBlock - 20000;

    console.log(`Scanning ALL events from block ${fromBlock} to ${currentBlock}...`);

    // 1. Fetch ALL MarketCreated
    const markets = await contract.queryFilter(contract.filters.MarketCreated(), fromBlock);
    console.log(`Found ${markets.length} MarketCreated events.`);
    markets.forEach((m, i) => {
        console.log(`[Market ${i}] Tx: ${m.transactionHash} | Topic[1] (ID Hash): ${m.topics[1]}`);
    });

    // 2. Fetch ALL BetPlaced (no filter on ID)
    const bets = await contract.queryFilter(contract.filters.BetPlaced(), fromBlock);
    console.log(`Found ${bets.length} BetPlaced events.`);

    bets.forEach((b, i) => {
        console.log(`[Bet ${i}] Market Hash: ${b.topics[1]} | User: ${b.args.user} | Amount: ${b.args.amount}`);
    });

    if (bets.length === 0) {
        console.log("No bets found globally on this contract in range.");
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
