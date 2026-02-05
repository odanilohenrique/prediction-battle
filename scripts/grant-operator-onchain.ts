
import { createWalletClient, http, publicActions, parseAbiItem, keccak256, stringToBytes } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { baseSepolia } from 'viem/chains';
import 'dotenv/config';

// TARGET CONFIG
const TARGET_ADDRESS = "0xFA278965a56a16252ccb850d3bb354f6a6e9fb02"; // User's Wallet
const CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS as `0x${string}`;

async function main() {
    console.log('👑 Granting OPERATOR_ROLE on-chain...');

    if (!process.env.PRIVATE_KEY) {
        throw new Error('❌ Missing PRIVATE_KEY in .env');
    }

    if (!CONTRACT_ADDRESS) {
        throw new Error('❌ Missing NEXT_PUBLIC_CONTRACT_ADDRESS in .env');
    }

    const account = privateKeyToAccount(process.env.PRIVATE_KEY as `0x${string}`);
    const client = createWalletClient({
        account,
        chain: baseSepolia,
        transport: http("https://sepolia.base.org"),
    }).extend(publicActions);

    console.log(`🔗 Contract: ${CONTRACT_ADDRESS}`);
    console.log(`👤 Admin: ${account.address}`);
    console.log(`🎯 Target: ${TARGET_ADDRESS}`);

    // Role Hash
    const OPERATOR_ROLE = keccak256(stringToBytes("OPERATOR_ROLE"));
    console.log(`🔑 Role Hash: ${OPERATOR_ROLE}`);

    // Check if already has role
    const hasRole = await client.readContract({
        address: CONTRACT_ADDRESS,
        abi: [parseAbiItem('function hasRole(bytes32 role, address account) view returns (bool)')],
        functionName: 'hasRole',
        args: [OPERATOR_ROLE, TARGET_ADDRESS]
    });

    if (hasRole) {
        console.log('✅ Target ALREADY has OPERATOR_ROLE.');
        return;
    }

    console.log('⏳ Sending transaction...');
    const hash = await client.writeContract({
        address: CONTRACT_ADDRESS,
        abi: [parseAbiItem('function grantRole(bytes32 role, address account) external')],
        functionName: 'grantRole',
        args: [OPERATOR_ROLE, TARGET_ADDRESS]
    });

    console.log(`✅ Tx Sent! Hash: ${hash}`);
    console.log(`Waiting for confirmation...`);

    const receipt = await client.waitForTransactionReceipt({ hash });

    if (receipt.status === 'success') {
        console.log('🎉 Role Granted Successfully!');
    } else {
        console.error('❌ Transaction Failed:', receipt);
    }
}

main().catch(console.error);
