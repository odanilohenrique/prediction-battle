
import fs from 'fs';
import path from 'path';
// @ts-ignore
import solc from 'solc';
import { createWalletClient, http, publicActions } from 'viem';
import { privateKeyToAccount, mnemonicToAccount } from 'viem/accounts';
import { baseSepolia } from 'viem/chains';

const envPath = path.resolve(process.cwd(), '.env.local');
console.log(`Loading env from: ${envPath}`);

let loadedPrivateKey = '';

if (fs.existsSync(envPath)) {
    let envContent = fs.readFileSync(envPath, 'utf8');
    if (envContent.charCodeAt(0) === 0xFEFF) {
        envContent = envContent.slice(1);
        console.log('Stripped UTF-8 BOM.');
    }
    envContent = envContent.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    // Strip null bytes (UTF-16 to UTF-8 conversion hack)
    envContent = envContent.replace(/\x00/g, '');

    // Also remove any non-printable characters just in case, except newlines
    // envContent = envContent.replace(/[^\x20-\x7E\n\r]/g, ''); 

    console.log('File size after cleanup:', envContent.length);
    envContent.split('\n').forEach(line => {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) return;

        // Handle cases where = might be surrounded by weird spaces
        const parts = trimmed.split('=');
        if (parts.length < 2) return;

        const key = parts[0].trim();
        const val = parts.slice(1).join('=').trim().replace(/^["']|["']$/g, '');

        // Aggressive key cleaning: remove all internal whitespace from key just in case
        const cleanKey = key.replace(/\s+/g, '');

        console.log(`Found key: "${cleanKey}"`);

        if (cleanKey === 'PRIVATE_KEY' || cleanKey === 'DEPLOYER_PRIVATE_KEY') {
            console.log(`MATCH! Found Key (${cleanKey}). Raw Value: "${val.substring(0, 10)}..." (len: ${val.length})`);

            // Aggressively clean value: remove ALL whitespace/nulls to fix encoding/copy-paste issues
            const cleanVal = val.replace(/[\s\uFEFF\x00]+/g, '');
            console.log(`Cleaned Value Length: ${cleanVal.length}`);

            loadedPrivateKey = cleanVal;
            process.env.PRIVATE_KEY = cleanVal;
        }
    });
} else {
    console.warn('.env.local not found!');
}

console.log('Final Loaded Key Length:', loadedPrivateKey.length);

// Configuration for USDC Contract V2
const CONTRACT_FILENAME = 'PredictionBattleV2.sol';
const CONTRACT_NAME = 'PredictionBattleV2';
const SOURCES_DIR = path.resolve(process.cwd(), 'contracts');
const OUTPUT_DIR = path.resolve(process.cwd(), 'src/lib/abi');

// USDC Address on Base Sepolia
const USDC_ADDRESS = '0x036CbD53842c5426634e7929541eC2318f3dCF7e';

async function main() {
    console.log(`Starting compilation and deployment for ${CONTRACT_NAME}...`);

    // 1. Read Contract Source
    const contractPath = path.join(SOURCES_DIR, CONTRACT_FILENAME);
    const sourceCode = fs.readFileSync(contractPath, 'utf8');

    // 2. Compile
    const input = {
        language: 'Solidity',
        sources: {
            [CONTRACT_FILENAME]: {
                content: sourceCode,
            },
        },
        settings: {
            optimizer: {
                enabled: true,
                runs: 200,
            },
            viaIR: true,
            outputSelection: {
                '*': {
                    '*': ['*'],
                },
            },
        },
    };

    console.log('Compiling...');
    const output = JSON.parse(solc.compile(JSON.stringify(input)));

    if (output.errors) {
        let hasError = false;
        output.errors.forEach((err: any) => {
            if (err.severity === 'error') hasError = true;
            console.error(err.formattedMessage);
        });
        if (hasError) throw new Error('Compilation failed');
    }

    const contract = output.contracts[CONTRACT_FILENAME][CONTRACT_NAME];
    const abi = contract.abi;
    const bytecode = contract.evm.bytecode.object;

    console.log('Compilation successful.');

    // 3. Save ABI (overwrite the old one)
    if (!fs.existsSync(OUTPUT_DIR)) {
        fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    }
    fs.writeFileSync(
        path.join(OUTPUT_DIR, 'PredictionBattle.json'),
        JSON.stringify({ abi, bytecode }, null, 2)
    );
    console.log(`ABI saved to ${path.join(OUTPUT_DIR, 'PredictionBattle.json')}`);

    // 4. Deploy
    if (!loadedPrivateKey) {
        throw new Error('PRIVATE_KEY not found in .env.local (loadedPrivateKey is empty)');
    }

    let account;
    if (loadedPrivateKey.includes(' ')) {
        console.log('Detected Mnemonic seed phrase.');
        account = mnemonicToAccount(loadedPrivateKey);
    } else {
        console.log('Detected Private Key.');
        const pk = loadedPrivateKey.startsWith('0x') ? loadedPrivateKey : `0x${loadedPrivateKey}`;
        account = privateKeyToAccount(pk as `0x${string}`);
    }

    const client = createWalletClient({
        account,
        chain: baseSepolia,
        transport: http(),
    }).extend(publicActions);

    console.log(`Deploying from ${account.address} to Base Sepolia...`);
    console.log(`Constructor arg: USDC Address = ${USDC_ADDRESS}`);

    const hash = await client.deployContract({
        abi,
        bytecode: `0x${bytecode}`,
        args: [USDC_ADDRESS], // Constructor argument for PredictionBattleUSDC
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
