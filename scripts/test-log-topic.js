const { createPublicClient, http, keccak256, encodePacked, stringToBytes } = require('viem');
const { baseSepolia } = require('viem/chains');

const client = createPublicClient({
    chain: baseSepolia,
    transport: http('https://sepolia.base.org'),
});

async function main() {
    // Let's get the receipt for the recent market creation
    // To find the transaction hash, we can search the most recent transactions for the creator `0xEF7eb01f92f333805eA974d8d5a0d71032286436`
    // Wait, let's just use the ID we know: 0xb3e3d2a8853d41e93462e2694c1c08c54b57cbffaf5abbae8b4521a42e6632d4
    // We can fetch the logs for the contract to find MarketCreated
    const CONTRACT = '0xF8623E94364b58246BC6FaBeA10710563d2dB6ae';
    const MARKET_CREATED_TOPIC = keccak256(stringToBytes("MarketCreated(string,address,uint256,uint256)"));

    console.log(`Topic 0 expected: ${MARKET_CREATED_TOPIC}`);

    // The raw string ID we established for this market:
    const id = "0xb3e3d2a8853d41e93462e2694c1c08c54b57cbffaf5abbae8b4521a42e6632d4";

    // Hash the ID as solidity would for an indexed string
    const idHash = keccak256(stringToBytes(id));
    console.log(`Topic 1 expected (id Hash): ${idHash}`);
}

main().catch(console.error);
