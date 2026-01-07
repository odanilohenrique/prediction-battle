import fs from 'fs';
import path from 'path';
// @ts-ignore
import solc from 'solc';
import { createWalletClient, http, publicActions } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { baseSepolia } from 'viem/chains';
import dotenv from 'dotenv';

const envPath = path.resolve(process.cwd(), '.env.local');
console.log(`Loading env from: ${envPath}`);
console.log('Env keys:', Object.keys(process.env).filter(k => k.includes('PRIVATE')));
dotenv.config({ path: envPath });
console.log('Env keys after load:', Object.keys(process.env).filter(k => k.includes('PRIVATE')));

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
    const privateKey = process.env.PRIVATE_KEY;
    if (!privateKey) {
        throw new Error('PRIVATE_KEY not found in .env');
    }

    const account = privateKeyToAccount(privateKey as `0x${string}`);
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

        // Optionally save the address to a config file or .env
        // For now, valid for manual copying
    } else {
        console.error('Deployment failed: No contract address in receipt.');
    }
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
