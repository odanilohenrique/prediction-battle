
import fs from 'fs';
import path from 'path';
// @ts-ignore
import solc from 'solc';
import { createWalletClient, http, publicActions } from 'viem';
import { privateKeyToAccount, mnemonicToAccount } from 'viem/accounts';
import { baseSepolia } from 'viem/chains';
import dotenv from 'dotenv';

const envPath = path.resolve(process.cwd(), '.env.local');
console.log(`Loading env from: ${envPath}`);

let loadedPrivateKey = '';

if (fs.existsSync(envPath)) {
    let envContent = fs.readFileSync(envPath, 'utf8');
    // Strip BOM if present
    if (envContent.charCodeAt(0) === 0xFEFF) {
        envContent = envContent.slice(1);
        console.log('Stripped UTF-8 BOM.');
    }
    // Normalize line endings
    envContent = envContent.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    // Strip null bytes (UTF-16 to UTF-8 conversion hack)
    envContent = envContent.replace(/\x00/g, '');
    console.log('File size after cleanup:', envContent.length);
    envContent.split('\n').forEach(line => {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) return;

        const [key, ...rest] = trimmed.split('=');
        const keyName = key ? key.trim() : '';
        console.log(`Found key: "${keyName}", rest.length: ${rest.length}`);
        if (keyName && rest.length > 0) {
            console.log(`Char codes of keyName: ${[...keyName].map(c => c.charCodeAt(0))}`);
            if (keyName === 'PRIVATE_KEY') {
                console.log(`DEBUG: rest[0] = "${rest[0]?.slice(0, 10)}...", length = ${rest[0]?.length}`);
                const val = rest.join('=').trim().replace(/^["']|["']$/g, '');
                console.log(`MATCH! Found PRIVATE_KEY. Raw Value Length: ${rest.join('=').length}, Processed Length: ${val.length}`);
                loadedPrivateKey = val;
                process.env.PRIVATE_KEY = val;
            }
        }
    });
} else {
    console.warn('.env.local not found!');
}

console.log('Final Loaded Key Length:', loadedPrivateKey.length);

// Configuration
const CONTRACT_FILENAME = 'PredictionBattle.sol';
const CONTRACT_NAME = 'PredictionBattle';
const SOURCES_DIR = path.resolve(process.cwd(), 'contracts');
const OUTPUT_DIR = path.resolve(process.cwd(), 'src/lib/abi');

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

    // 3. Save ABI
    if (!fs.existsSync(OUTPUT_DIR)) {
        fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    }
    fs.writeFileSync(
        path.join(OUTPUT_DIR, `${CONTRACT_NAME}.json`),
        JSON.stringify({ abi, bytecode }, null, 2)
    );
    console.log(`ABI saved to ${path.join(OUTPUT_DIR, `${CONTRACT_NAME}.json`)}`);

    // 4. Deploy
    if (!loadedPrivateKey) {
        throw new Error('PRIVATE_KEY not found in .env (loadedPrivateKey is empty)');
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

    const hash = await client.deployContract({
        abi,
        bytecode: `0x${bytecode}`,
        args: [],
    });

    console.log(`Transaction hash: ${hash}`);

    const receipt = await client.waitForTransactionReceipt({ hash });

    if (receipt.contractAddress) {
        console.log(`✅ Contract Deployed at: ${receipt.contractAddress}`);
    } else {
        console.error('Deployment failed: No contract address in receipt.');
    }
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
