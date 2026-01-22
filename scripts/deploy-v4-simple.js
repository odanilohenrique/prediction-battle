/**
 * Deploy PredictionBattleV4 (already compiled)
 * 
 * Usage:
 *   node scripts/deploy-v4-simple.js
 */

require('dotenv').config({ path: '.env.local' });
const { createWalletClient, createPublicClient, http } = require('viem');
const { privateKeyToAccount } = require('viem/accounts');
const { baseSepolia } = require('viem/chains');
const fs = require('fs');
const path = require('path');

const USDC_ADDRESS_SEPOLIA = '0x036CbD53842c5426634e7929541eC2318f3dCF7e';

async function main() {
    console.log('🚀 PredictionBattleV4 Deployment\n');
    console.log('='.repeat(50));

    const privateKey = process.env.OPERATOR_PRIVATE_KEY;
    if (!privateKey) {
        console.error('❌ OPERATOR_PRIVATE_KEY not found in .env.local');
        process.exit(1);
    }

    const formattedKey = privateKey.startsWith('0x') ? privateKey : `0x${privateKey}`;
    const account = privateKeyToAccount(formattedKey);

    console.log('\n📍 Network: Base Sepolia (Testnet)');
    console.log('👤 Deployer:', account.address);
    console.log('💰 USDC Address:', USDC_ADDRESS_SEPOLIA);

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

    if (balance < BigInt(1e15)) {
        console.error('\n❌ Insufficient ETH for gas');
        console.log('Get testnet ETH from: https://www.alchemy.com/faucets/base-sepolia');
        process.exit(1);
    }

    // Read compiled artifacts
    const binPath = path.join(__dirname, '../artifacts/PredictionBattleV4.bin');
    const abiPath = path.join(__dirname, '../artifacts/PredictionBattleV4.abi');

    if (!fs.existsSync(binPath)) {
        console.error('❌ Bytecode not found. Run: node scripts/compile-v4.js');
        process.exit(1);
    }

    const bytecode = `0x${fs.readFileSync(binPath, 'utf8').trim()}`;
    const abi = JSON.parse(fs.readFileSync(abiPath, 'utf8'));

    console.log('\n📄 Bytecode size:', (bytecode.length / 2 - 1), 'bytes');

    // Deploy
    console.log('\n🚀 Deploying contract...');

    try {
        const hash = await walletClient.deployContract({
            abi,
            bytecode,
            args: [USDC_ADDRESS_SEPOLIA],
        });

        console.log('📝 Transaction hash:', hash);
        console.log('⏳ Waiting for confirmation (15-60 seconds)...');

        const receipt = await publicClient.waitForTransactionReceipt({
            hash,
            timeout: 120_000
        });

        if (receipt.status === 'success' && receipt.contractAddress) {
            console.log('\n' + '='.repeat(50));
            console.log('✅ CONTRACT DEPLOYED SUCCESSFULLY!');
            console.log('='.repeat(50));
            console.log('\n📍 Contract Address:', receipt.contractAddress);
            console.log('🔗 Basescan:', `https://sepolia.basescan.org/address/${receipt.contractAddress}`);
            console.log('⛽ Gas Used:', receipt.gasUsed.toString());

            // Auto-update config
            const configPath = path.join(__dirname, '../src/lib/config.ts');
            let configContent = fs.readFileSync(configPath, 'utf8');

            configContent = configContent.replace(
                /const TESTNET_CONTRACT_ADDRESS_V4 = '[^']*'/,
                `const TESTNET_CONTRACT_ADDRESS_V4 = '${receipt.contractAddress}'`
            );

            fs.writeFileSync(configPath, configContent);
            console.log('\n✅ config.ts auto-updated with new contract address!');

            console.log('\n📋 NEXT STEPS:');
            console.log('1. Set Operator (if needed):');
            console.log(`   The deployer ${account.address} is already admin`);
            console.log('\n2. Verify on Basescan (optional):');
            console.log(`   Visit: https://sepolia.basescan.org/verifyContract?a=${receipt.contractAddress}`);

        } else {
            console.error('\n❌ Deployment failed - transaction reverted');
        }
    } catch (error) {
        console.error('\n❌ Deployment error:', error.shortMessage || error.message);
        process.exit(1);
    }
}

main().catch(console.error);
