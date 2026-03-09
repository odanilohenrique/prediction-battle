const { createPublicClient, http, decodeFunctionData } = require('viem');
const { baseSepolia } = require('viem/chains');

const client = createPublicClient({ chain: baseSepolia, transport: http('https://sepolia.base.org') });

const abiFile = require('../src/lib/abi/PredictionBattleV10.json');
const abi = abiFile.abi;

async function main() {
    const hashes = [
        '0xcdaf26712440b4a318643b9a93c9f79158d4f00c224638552902f79f9723df9c',
        '0x844bea6b9247a3acf20198bc53e1ee7a7f45396b1173328775a15cb0e977265f',
        '0x56f481a16cee2195ba03f74baf5edac71f4040a5643302b9c33488b43346b485',
        '0x55ff8837d7348f9c652c5c5bc63e4eff809351ace71a451180217cc74025ed52'
    ];

    for (const hash of hashes) {
        try {
            const tx = await client.getTransaction({ hash });
            console.log(`\nDecoding transaction: ${hash}`);
            const decoded = decodeFunctionData({
                abi,
                data: tx.input
            });

            console.log(`Function Name: ${decoded.functionName}`);
            console.log(`Arguments:`, decoded.args);
        } catch (e) {
            console.log(`Failed to decode tx ${hash}`);
        }
    }
}

main().catch(console.error);
