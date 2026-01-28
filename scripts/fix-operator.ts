import { createWalletClient, http, publicActions } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { baseSepolia } from 'viem/chains';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const CONTRACT_ADDRESS = '0x1b33d24d726e3d010e39b2bafbecdde750d2ec41';
const OPERATOR_TO_ADD = '0xFA278965A56a16252ccB850d3bB354f6a6E9fB02'; // The wallet causing issues

const ABI = [
    {
        "inputs": [
            { "internalType": "address", "name": "_operator", "type": "address" },
            { "internalType": "bool", "name": "_status", "type": "bool" }
        ],
        "name": "setOperator",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    }
] as const;

async function main() {
    console.log('='.repeat(60));
    console.log('Access Control Fix: Adding Operator');
    console.log('='.repeat(60));

    // Valid admin/deployer key
    const adminKey = process.env.PRIVATE_KEY;
    if (!adminKey) {
        throw new Error('PRIVATE_KEY not found in .env.local');
    }

    const account = privateKeyToAccount(adminKey as `0x${string}`);
    console.log(`Admin (Sender): ${account.address}`);
    console.log(`Target Operator: ${OPERATOR_TO_ADD}`);

    const client = createWalletClient({
        account,
        chain: baseSepolia,
        transport: http(),
    }).extend(publicActions);

    try {
        console.log('Sending transaction...');
        const hash = await client.writeContract({
            address: CONTRACT_ADDRESS as `0x${string}`,
            abi: ABI,
            functionName: 'setOperator',
            args: [OPERATOR_TO_ADD as `0x${string}`, true],
        });

        console.log(`✅ Transaction sent! Hash: ${hash}`);
        console.log('Waiting for confirmation...');

        await client.waitForTransactionReceipt({ hash });
        console.log('✅ Operator added successfully!');

    } catch (error: any) {
        console.error('❌ Failed to add operator:', error.message);
    }
}

main();
