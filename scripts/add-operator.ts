// Script to add operator to the PredictionBattleUSDC contract
// Run with: npx ts-node scripts/add-operator.ts

import { createWalletClient, createPublicClient, http, parseAbi } from 'viem';
import { baseSepolia } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

// Load .env.local
dotenv.config({ path: '.env.local' });

// Contract address
const CONTRACT_ADDRESS = '0x3df1475c9cb9dfb469d9ade86d3d3c41ac9984f7';

// The wallet to add as operator
const OPERATOR_TO_ADD = '0xFA278965A56a16252ccB850d3bB354f6a6E9fB02';

// Minimal ABI for setOperator function
const ABI = parseAbi([
    'function setOperator(address _operator, bool _status) external',
    'function admin() view returns (address)',
    'function operators(address) view returns (bool)',
]);

async function main() {
    console.log('=== Add Operator Script ===\n');

    // Debug: Check if file exists and print content (masked)
    const envPath = path.resolve(process.cwd(), '.env.local');
    if (fs.existsSync(envPath)) {
        console.log('✅ .env.local exists at:', envPath);
        const content = fs.readFileSync(envPath, 'utf8');
        console.log('--- CONTENT START ---');
        content.split('\n').forEach(line => {
            if (line.includes('PRIVATE')) {
                const parts = line.split('=');
                console.log(`${parts[0]}=${parts[1] ? parts[1].substring(0, 6) + '...' : '(no value)'}`);
            } else if (line.trim()) {
                console.log(line.substring(0, 10) + '...');
            }
        });
        console.log('--- CONTENT END ---');
    } else {
        console.error('❌ .env.local DOES NOT EXIST at:', envPath);
        console.log('Files in dir:', fs.readdirSync(process.cwd()));
    }

    // Manually read .env.local to avoid dotenv issues
    let privateKey = process.env.PRIVATE_KEY;

    if (!privateKey) {
        try {
            const envContent = fs.readFileSync(path.resolve(process.cwd(), '.env.local'), 'utf8');
            // TRICK: Remove all spaces/invisible chars from each line to match "PRIVATE_KEY="
            const lines = envContent.split('\n');
            for (const line of lines) {
                const cleanLine = line.replace(/\s/g, '').replace(/[\u0000-\u001F\u007F-\u009F]/g, ""); // Remove spaces and control chars
                if (cleanLine.startsWith('PRIVATE_KEY=')) {
                    // Extract value from original line based on assumption or just cleaner
                    // Since the KEY has spaces, likely the VALUE is just the rest
                    // But if key is "P R I V A T E _ K E Y =", value starts after '='
                    const parts = line.split('=');
                    if (parts.length >= 2) {
                        const rawValue = parts.slice(1).join('=').trim();
                        // Also clean value if it looks like "0 x 1 2 3" ??
                        // Let's assume value is fine or user spaced it too.
                        // Let's rely on the clean line part for the value if hex
                        const cleanValue = cleanLine.split('=')[1];
                        if (cleanValue && cleanValue.startsWith('0x')) {
                            privateKey = cleanValue;
                            console.log('✅ Found PRIVATE_KEY in .env.local (fuzzy parse)');
                            break;
                        } else if (rawValue.startsWith('0x')) {
                            privateKey = rawValue;
                            console.log('✅ Found PRIVATE_KEY in .env.local (fuzzy parse raw)');
                            break;
                        }
                    }
                }
            }
        } catch (e) {
            console.warn('Could not read .env.local manually');
        }
    }


    // Fallback locally just in case
    // if (!privateKey) privateKey = process.env.OPERATOR_PRIVATE_KEY; 

    if (!privateKey) {
        console.error('❌ PRIVATE_KEY not found in .env.local');
        console.log('Make sure your .env.local has the PRIVATE_KEY of the contract ADMIN (deployer) wallet');
        process.exit(1);
    }

    // Clean private key
    const cleanKey = privateKey.startsWith('0x') ? privateKey : `0x${privateKey}`;

    try {
        const account = privateKeyToAccount(cleanKey as `0x${string}`);
        console.log('📍 Signing with wallet:', account.address);

        const publicClient = createPublicClient({
            chain: baseSepolia,
            transport: http('https://sepolia.base.org'),
        });

        const walletClient = createWalletClient({
            account,
            chain: baseSepolia,
            transport: http('https://sepolia.base.org'),
        });

        // Check current admin
        const currentAdmin = await publicClient.readContract({
            address: CONTRACT_ADDRESS as `0x${string}`,
            abi: ABI,
            functionName: 'admin',
        });
        console.log('📋 Contract admin:', currentAdmin);

        if (account.address.toLowerCase() !== (currentAdmin as string).toLowerCase()) {
            console.error('\n❌ ERROR: Your wallet is NOT the admin of this contract!');
            console.log(`   Your wallet: ${account.address}`);
            console.log(`   Contract admin: ${currentAdmin}`);
            console.log('\n⚠️  You need to use the wallet that deployed the contract.');
            process.exit(1);
        }

        // Check if already operator
        const isAlreadyOperator = await publicClient.readContract({
            address: CONTRACT_ADDRESS as `0x${string}`,
            abi: ABI,
            functionName: 'operators',
            args: [OPERATOR_TO_ADD as `0x${string}`],
        });

        if (isAlreadyOperator) {
            console.log(`\n✅ ${OPERATOR_TO_ADD} is already an operator!`);
            process.exit(0);
        }

        console.log(`\n🔧 Adding ${OPERATOR_TO_ADD} as operator...`);

        // Send transaction
        const hash = await walletClient.writeContract({
            address: CONTRACT_ADDRESS as `0x${string}`,
            abi: ABI,
            functionName: 'setOperator',
            args: [OPERATOR_TO_ADD as `0x${string}`, true],
        });

        console.log('📝 Transaction hash:', hash);
        console.log('⏳ Waiting for confirmation...');

        const receipt = await publicClient.waitForTransactionReceipt({ hash });

        if (receipt.status === 'success') {
            console.log('\n✅ SUCCESS! Operator added successfully!');
            console.log(`   Block: ${receipt.blockNumber}`);
            console.log(`   Gas used: ${receipt.gasUsed}`);
        } else {
            console.error('\n❌ Transaction failed!');
        }

    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}

main();
