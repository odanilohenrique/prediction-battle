/**
 * Deploy PredictionBattleV4 Contract
 * 
 * Usage:
 *   npx ts-node scripts/deploy-v4.ts
 * 
 * Prerequisites:
 *   - Set OPERATOR_PRIVATE_KEY in .env.local
 *   - Have ETH on Base Sepolia for gas
 */

import { createWalletClient, createPublicClient, http } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { baseSepolia } from 'viem/chains';
import * as fs from 'fs';
import * as path from 'path';

// You'll need to compile the contract first and get the bytecode
// Use: npx solc --optimize --bin contracts/PredictionBattleV4.sol

const USDC_ADDRESS_SEPOLIA = '0x036CbD53842c5426634e7929541eC2318f3dCF7e';

async function main() {
    const privateKey = process.env.OPERATOR_PRIVATE_KEY;

    if (!privateKey) {
        console.error('❌ OPERATOR_PRIVATE_KEY not set in environment');
        console.log('\nTo deploy:');
        console.log('1. Set OPERATOR_PRIVATE_KEY in your .env.local');
        console.log('2. Compile the contract: npx solc --optimize --bin --abi -o ./artifacts contracts/PredictionBattleV4.sol');
        console.log('3. Run this script again');
        process.exit(1);
    }

    const formattedKey = privateKey.startsWith('0x') ? privateKey : `0x${privateKey}`;
    const account = privateKeyToAccount(formattedKey as `0x${string}`);

    console.log('🚀 Deploying PredictionBattleV4...');
    console.log('📍 Network: Base Sepolia');
    console.log('👤 Deployer:', account.address);
    console.log('💰 USDC Address:', USDC_ADDRESS_SEPOLIA);

    const publicClient = createPublicClient({
        chain: baseSepolia,
        transport: http(),
    });

    const walletClient = createWalletClient({
        account,
        chain: baseSepolia,
        transport: http(),
    });

    // Check if bytecode file exists
    const bytecodePath = path.join(__dirname, '../artifacts/PredictionBattleV4.bin');

    if (!fs.existsSync(bytecodePath)) {
        console.error('❌ Bytecode not found at:', bytecodePath);
        console.log('\nCompile the contract first:');
        console.log('npx solc --optimize --bin --abi -o ./artifacts contracts/PredictionBattleV4.sol');
        process.exit(1);
    }

    const bytecode = fs.readFileSync(bytecodePath, 'utf8').trim();
    const abiPath = path.join(__dirname, '../artifacts/PredictionBattleV4.abi');
    const abi = JSON.parse(fs.readFileSync(abiPath, 'utf8'));

    console.log('\n⏳ Deploying contract...');

    try {
        const hash = await walletClient.deployContract({
            abi,
            bytecode: `0x${bytecode}` as `0x${string}`,
            args: [USDC_ADDRESS_SEPOLIA],
        });

        console.log('📝 Transaction hash:', hash);
        console.log('⏳ Waiting for confirmation...');

        const receipt = await publicClient.waitForTransactionReceipt({ hash });

        if (receipt.status === 'success') {
            console.log('\n✅ Contract deployed successfully!');
            console.log('📍 Contract Address:', receipt.contractAddress);
            console.log('\n🔧 Next steps:');
            console.log(`1. Update TESTNET_CONTRACT_ADDRESS_V4 in src/lib/config.ts to: '${receipt.contractAddress}'`);
            console.log('2. Verify on Basescan: npx hardhat verify --network baseSepolia', receipt.contractAddress, USDC_ADDRESS_SEPOLIA);
            console.log('3. Set operator: call setOperator(operatorAddress, true)');
        } else {
            console.error('❌ Deployment failed');
        }
    } catch (error) {
        console.error('❌ Deployment error:', error);
    }
}

main();
