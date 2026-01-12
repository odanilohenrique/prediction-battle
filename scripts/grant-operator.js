
const { createWalletClient, http, publicActions } = require('viem');
const { privateKeyToAccount } = require('viem/accounts');
const { baseSepolia } = require('viem/chains');
require('dotenv').config();
const PredictionBattleABI = require('../src/lib/abi/PredictionBattle.json');

const CONTRACT_ADDRESS = '0x1e57a200b5aa90e44701e4bba0b70a02c7d074c4';
const NEW_OPERATOR = '0xFA278965A56a16252ccB850d3bB354f6a6E9fB02';

async function main() {
    console.log(`Granting Operator Role to ${NEW_OPERATOR}...`);

    const privateKey = process.env.PRIVATE_KEY || process.env.DEPLOYER_PRIVATE_KEY;
    if (!privateKey) throw new Error("Missing PRIVATE_KEY in .env");

    const account = privateKeyToAccount(privateKey.startsWith('0x') ? privateKey : `0x${privateKey}`);

    const client = createWalletClient({
        account,
        chain: baseSepolia,
        transport: http()
    }).extend(publicActions);

    console.log(`Signer: ${account.address}`);

    // Check if already admin
    const admin = await client.readContract({
        address: CONTRACT_ADDRESS,
        abi: PredictionBattleABI.abi,
        functionName: 'admin',
    });
    console.log(`Contract Admin is: ${admin}`);

    if (admin.toLowerCase() !== account.address.toLowerCase()) {
        console.error("ERROR: The Private Key in .env is NOT the Admin of this contract.");
        // Check if it's the operator logic or just wrong key
        return;
    }

    try {
        const hash = await client.writeContract({
            address: CONTRACT_ADDRESS,
            abi: PredictionBattleABI.abi,
            functionName: 'setOperator',
            args: [NEW_OPERATOR, true]
        });

        console.log(`Transaction Sent: ${hash}`);
        console.log("Waiting for confirmation...");

        const receipt = await client.waitForTransactionReceipt({ hash });
        console.log(`Success! ${NEW_OPERATOR} is now an Operator.`);

    } catch (e) {
        console.error("Failed to set operator:", e.message);
    }
}

main();
