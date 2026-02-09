
import fs from 'fs';
import path from 'path';
import { createWalletClient, http, publicActions } from 'viem';
import { privateKeyToAccount, mnemonicToAccount } from 'viem/accounts';
import { baseSepolia } from 'viem/chains';
import * as dotenv from 'dotenv';

// Load env
const envPath = path.resolve(process.cwd(), '.env.local');
if (fs.existsSync(envPath)) {
    console.log(`Loading env from: ${envPath}`);
    const envConfig = dotenv.parse(fs.readFileSync(envPath));
    for (const k in envConfig) {
        process.env[k] = envConfig[k];
    }
}

const ARTIFACT_PATH = path.resolve(process.cwd(), 'artifacts/contracts/PredictionBattleV9.sol/PredictionBattleV9.json');
const OUTPUT_DIR = path.resolve(process.cwd(), 'src/lib/abi');

async function main() {
    console.log(`Starting deployment for PredictionBattleV9 using Hardhat artifacts...`);

    let loadedPrivateKey = process.env.PRIVATE_KEY || process.env.DEPLOYER_PRIVATE_KEY || '';
    if (!loadedPrivateKey) {
        throw new Error('PRIVATE_KEY not found in .env.local');
    }

    // Clean Key
    loadedPrivateKey = loadedPrivateKey.replace(/[\s\uFEFF\x00]+/g, '');

    let account;
    if (loadedPrivateKey.includes(' ')) {
        account = mnemonicToAccount(loadedPrivateKey);
    } else {
        const pk = loadedPrivateKey.startsWith('0x') ? loadedPrivateKey : `0x${loadedPrivateKey}`;
        account = privateKeyToAccount(pk as `0x${string}`);
    }

    console.log(`Deployer Address: ${account.address}`);

    // 1. Read Artifact
    if (!fs.existsSync(ARTIFACT_PATH)) {
        throw new Error(`Artifact not found at ${ARTIFACT_PATH}. Please run 'npx hardhat compile' first.`);
    }

    const artifact = JSON.parse(fs.readFileSync(ARTIFACT_PATH, 'utf8'));
    const abi = artifact.abi;
    const bytecode = artifact.bytecode;

    console.log('Artifact loaded successfully.');

    // 2. Save ABI for Frontend
    if (!fs.existsSync(OUTPUT_DIR)) {
        fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    }
    fs.writeFileSync(
        path.join(OUTPUT_DIR, 'PredictionBattle.json'),
        JSON.stringify({ abi, bytecode }, null, 2)
    );
    console.log(`ABI saved to ${path.join(OUTPUT_DIR, 'PredictionBattle.json')}`);

    // 3. Deploy
    const client = createWalletClient({
        account,
        chain: baseSepolia,
        transport: http(),
    }).extend(publicActions);

    console.log(`Deploying to Base Sepolia...`);

    // Constructor Args: _admin, _operator, _treasury
    // We use the deployer address for all 3 for now.
    const ARGS = [account.address, account.address, account.address];
    console.log(`Constructor Args:`, ARGS);

    const hash = await client.deployContract({
        abi,
        bytecode: bytecode as `0x${string}`,
        args: ARGS,
    });

    console.log(`Transaction hash: ${hash}`);

    const receipt = await client.waitForTransactionReceipt({ hash });

    if (receipt.contractAddress) {
        console.log(`✅ Contract Deployed at: ${receipt.contractAddress}`);
        console.log(`\n📋 NEXT STEP: Update your .env.local with:`);
        console.log(`   NEXT_PUBLIC_CONTRACT_ADDRESS=${receipt.contractAddress}`);
    } else {
        console.error('Deployment failed: No contract address in receipt.');
    }
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
