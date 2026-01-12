// Deploy Script for PredictionBattleUSDC
// Run: node scripts/deploy-contract.js

const { createPublicClient, createWalletClient, http, parseAbi } = require('viem');
const { privateKeyToAccount } = require('viem/accounts');
const { baseSepolia } = require('viem/chains');
const fs = require('fs');
const path = require('path');
const solc = require('solc');

// CONFIGURATION
const PRIVATE_KEY = '0x409ca09bf89611f6158525db82bb06ed9038c2cea0a6760b6e74cf8da7345fbc';
const USDC_ADDRESS = '0x036CbD53842c5426634e7929541eC2318f3dCF7e'; // Base Sepolia USDC
const OPERATOR_ADDRESS = '0xFA278965A56a16252ccB850d3bB354f6a6E9fB02';

async function main() {
    console.log('🚀 Deploying PredictionBattleUSDC Contract');
    console.log('==========================================');

    // Load compiled contract
    const abiPath = path.join(__dirname, '..', 'src', 'lib', 'abi', 'PredictionBattle.json');

    if (!fs.existsSync(abiPath)) {
        console.error('❌ ABI file not found at:', abiPath);
        console.log('Please run: npx ts-node scripts/compile-only.ts first');
        process.exit(1);
    }

    const contractJson = JSON.parse(fs.readFileSync(abiPath, 'utf-8'));
    const abi = contractJson.abi;
    const bytecode = contractJson.bytecode;

    if (!bytecode || bytecode.length < 100) {
        console.error('❌ Bytecode not found in ABI file');
        process.exit(1);
    }

    // Setup wallet
    const account = privateKeyToAccount(PRIVATE_KEY);
    console.log('📍 Deployer Address:', account.address);

    const publicClient = createPublicClient({
        chain: baseSepolia,
        transport: http('https://sepolia.base.org')
    });

    const walletClient = createWalletClient({
        account,
        chain: baseSepolia,
        transport: http('https://sepolia.base.org')
    });

    // Check balance
    const balance = await publicClient.getBalance({ address: account.address });
    console.log('💰 ETH Balance:', (Number(balance) / 1e18).toFixed(4), 'ETH');

    if (balance < BigInt(1e15)) { // Less than 0.001 ETH
        console.error('❌ Insufficient ETH for deployment');
        process.exit(1);
    }

    // Deploy
    console.log('\n📝 Deploying contract...');

    const hash = await walletClient.deployContract({
        abi,
        bytecode: bytecode.startsWith('0x') ? bytecode : `0x${bytecode}`,
        args: [USDC_ADDRESS],
        gas: BigInt(3000000),
    });

    console.log('📤 Transaction sent:', hash);
    console.log('⏳ Waiting for confirmation...');

    const receipt = await publicClient.waitForTransactionReceipt({
        hash,
        timeout: 120000 // 2 minutes
    });

    if (receipt.status !== 'success') {
        console.error('❌ Deployment failed!');
        process.exit(1);
    }

    const contractAddress = receipt.contractAddress;
    console.log('\n✅ CONTRACT DEPLOYED!');
    console.log('📍 Address:', contractAddress);
    console.log('🔗 Explorer:', `https://sepolia.basescan.org/address/${contractAddress}`);

    // Grant operator role
    console.log('\n🔧 Granting operator role to:', OPERATOR_ADDRESS);

    const grantHash = await walletClient.writeContract({
        address: contractAddress,
        abi,
        functionName: 'setOperator',
        args: [OPERATOR_ADDRESS, true]
    });

    await publicClient.waitForTransactionReceipt({ hash: grantHash });
    console.log('✅ Operator granted!');

    // Output for config update
    console.log('\n📋 UPDATE YOUR CONFIG:');
    console.log('======================');
    console.log(`Contract Address: ${contractAddress}`);
    console.log(`\nUpdate src/lib/config.ts with:`);
    console.log(`const TESTNET_CONTRACT_ADDRESS = '${contractAddress}';`);

    // Auto-update config
    const configPath = path.join(__dirname, '..', 'src', 'lib', 'config.ts');
    let configContent = fs.readFileSync(configPath, 'utf-8');
    configContent = configContent.replace(
        /const TESTNET_CONTRACT_ADDRESS = '[^']+';/,
        `const TESTNET_CONTRACT_ADDRESS = '${contractAddress}';`
    );
    fs.writeFileSync(configPath, configContent);
    console.log('\n✅ Config auto-updated!');
}

main().catch(err => {
    console.error('Error:', err);
    process.exit(1);
});
