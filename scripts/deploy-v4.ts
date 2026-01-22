/**
 * Compile and Deploy PredictionBattleV4
 * 
 * Usage:
 *   npx ts-node scripts/deploy-v4.ts
 * 
 * Make sure OPERATOR_PRIVATE_KEY is set in .env.local
 */

import { createWalletClient, createPublicClient, http, encodeDeployData } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { baseSepolia } from 'viem/chains';
import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';
import { fileURLToPath } from 'url';

// ESM compatibility
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config({ path: '.env.local' });

const USDC_ADDRESS_SEPOLIA = '0x036CbD53842c5426634e7929541eC2318f3dCF7e';

async function main() {
    console.log('🚀 PredictionBattleV4 Deployment Script\n');
    console.log('='.repeat(50));

    // Check private key
    const privateKey = process.env.OPERATOR_PRIVATE_KEY;
    if (!privateKey) {
        console.error('\n❌ ERROR: OPERATOR_PRIVATE_KEY not found in .env.local');
        console.log('\nPlease add your private key to .env.local:');
        console.log('OPERATOR_PRIVATE_KEY=0xyour_private_key_here\n');
        process.exit(1);
    }

    const formattedKey = privateKey.startsWith('0x') ? privateKey : `0x${privateKey}`;
    const account = privateKeyToAccount(formattedKey as `0x${string}`);

    console.log('\n📍 Network: Base Sepolia (Testnet)');
    console.log('👤 Deployer:', account.address);
    console.log('💰 USDC Address:', USDC_ADDRESS_SEPOLIA);

    // Create clients
    const publicClient = createPublicClient({
        chain: baseSepolia,
        transport: http('https://sepolia.base.org'),
    });

    const walletClient = createWalletClient({
        account,
        chain: baseSepolia,
        transport: http('https://sepolia.base.org'),
    });

    // Check balance
    const balance = await publicClient.getBalance({ address: account.address });
    console.log('💎 ETH Balance:', (Number(balance) / 1e18).toFixed(4), 'ETH');

    if (balance < BigInt(1e15)) { // Less than 0.001 ETH
        console.error('\n❌ ERROR: Insufficient ETH for gas');
        console.log('Get testnet ETH from: https://www.alchemy.com/faucets/base-sepolia');
        process.exit(1);
    }

    // Step 1: Compile Contract
    console.log('\n📦 Step 1: Compiling contract...');

    const contractPath = path.join(__dirname, '../contracts/PredictionBattleV4.sol');
    const outputDir = path.join(__dirname, '../artifacts');

    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
    }

    try {
        execSync(
            `npx solc --optimize --optimize-runs 200 --bin --abi --base-path . --include-path node_modules -o "${outputDir}" "${contractPath}"`,
            { stdio: 'pipe', cwd: path.join(__dirname, '..') }
        );
        console.log('✅ Compilation successful!');
    } catch (error: any) {
        console.error('❌ Compilation failed:', error.message);
        // Try alternative compilation
        try {
            execSync(
                `npx solc --optimize --bin --abi -o "${outputDir}" "${contractPath}"`,
                { stdio: 'pipe' }
            );
            console.log('✅ Compilation successful (alternative method)!');
        } catch (e: any) {
            console.error('❌ Both compilation methods failed');
            console.error(e.stderr?.toString() || e.message);
            process.exit(1);
        }
    }

    // Read compiled output
    const binPath = path.join(outputDir, 'PredictionBattleV4.bin');
    const abiPath = path.join(outputDir, 'PredictionBattleV4.abi');

    if (!fs.existsSync(binPath)) {
        console.error('❌ Bytecode file not found at:', binPath);
        console.log('Available files in artifacts:', fs.readdirSync(outputDir));
        process.exit(1);
    }

    const bytecode = `0x${fs.readFileSync(binPath, 'utf8').trim()}` as `0x${string}`;
    const abi = JSON.parse(fs.readFileSync(abiPath, 'utf8'));

    console.log('📄 Bytecode size:', (bytecode.length / 2 - 1), 'bytes');

    // Step 2: Deploy Contract
    console.log('\n🚀 Step 2: Deploying contract...');

    try {
        const hash = await walletClient.deployContract({
            abi,
            bytecode,
            args: [USDC_ADDRESS_SEPOLIA],
        });

        console.log('📝 Transaction hash:', hash);
        console.log('⏳ Waiting for confirmation (this may take 15-30 seconds)...');

        const receipt = await publicClient.waitForTransactionReceipt({
            hash,
            timeout: 120_000 // 2 minutes
        });

        if (receipt.status === 'success' && receipt.contractAddress) {
            console.log('\n' + '='.repeat(50));
            console.log('✅ CONTRACT DEPLOYED SUCCESSFULLY!');
            console.log('='.repeat(50));
            console.log('\n📍 Contract Address:', receipt.contractAddress);
            console.log('🔗 Basescan:', `https://sepolia.basescan.org/address/${receipt.contractAddress}`);
            console.log('⛽ Gas Used:', receipt.gasUsed.toString());

            console.log('\n📋 NEXT STEPS:');
            console.log('1. Update src/lib/config.ts:');
            console.log(`   const TESTNET_CONTRACT_ADDRESS_V4 = '${receipt.contractAddress}';`);
            console.log('\n2. Set Operator (run in browser console or separate script):');
            console.log(`   contract.setOperator("${account.address}", true)`);
            console.log('\n3. Verify on Basescan (optional):');
            console.log(`   Visit: https://sepolia.basescan.org/verifyContract?a=${receipt.contractAddress}`);

            // Auto-update config
            const configPath = path.join(__dirname, '../src/lib/config.ts');
            let configContent = fs.readFileSync(configPath, 'utf8');

            // Replace the contract address
            configContent = configContent.replace(
                /const TESTNET_CONTRACT_ADDRESS_V4 = '[^']*'/,
                `const TESTNET_CONTRACT_ADDRESS_V4 = '${receipt.contractAddress}'`
            );

            fs.writeFileSync(configPath, configContent);
            console.log('\n✅ config.ts auto-updated with new contract address!');

        } else {
            console.error('\n❌ Deployment failed - transaction reverted');
        }
    } catch (error: any) {
        console.error('\n❌ Deployment error:', error.shortMessage || error.message);
        if (error.cause) {
            console.error('Cause:', error.cause);
        }
        process.exit(1);
    }
}

main().catch(console.error);
