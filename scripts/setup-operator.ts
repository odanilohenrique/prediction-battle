import fs from 'fs';
import path from 'path';
import { createWalletClient, http, publicActions } from 'viem';
import { privateKeyToAccount, mnemonicToAccount } from 'viem/accounts';
import { baseSepolia } from 'viem/chains';

const envPath = path.resolve(process.cwd(), '.env.local');
let loadedPrivateKey = '';

// ROBUST ENV PARSER (Reused from compile-deploy.ts)
if (fs.existsSync(envPath)) {
    let envContent = fs.readFileSync(envPath, 'utf8');
    if (envContent.charCodeAt(0) === 0xFEFF) envContent = envContent.slice(1); // BOM
    envContent = envContent.replace(/\r\n/g, '\n').replace(/\r/g, '\n').replace(/\x00/g, '');

    envContent.split('\n').forEach(line => {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) return;
        const parts = trimmed.split('=');
        if (parts.length < 2) return;

        const key = parts[0].trim();
        const val = parts.slice(1).join('=').trim().replace(/^["']|["']$/g, '');
        const cleanKey = key.replace(/\s+/g, '');

        if (cleanKey === 'PRIVATE_KEY' || cleanKey === 'DEPLOYER_PRIVATE_KEY') {
            const cleanVal = val.replace(/[\s\uFEFF\x00]+/g, '');
            loadedPrivateKey = cleanVal;
        }

        // Also load CONTRACT ADDRESS
        if (cleanKey === 'NEXT_PUBLIC_CONTRACT_ADDRESS') {
            process.env.NEXT_PUBLIC_CONTRACT_ADDRESS = val.replace(/[\s\uFEFF\x00]+/g, '');
        }
    });
}

const CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS;
const OPERATOR_ADDRESS = '0xFA278965A56a16252ccB850d3bB354f6a6E9fB02'; // Operational Wallet

async function main() {
    if (!CONTRACT_ADDRESS) throw new Error("Missing NEXT_PUBLIC_CONTRACT_ADDRESS");
    if (!loadedPrivateKey) throw new Error("Missing PRIVATE_KEY (Deployer) in env");

    console.log(`Setting up Operator on Contract: ${CONTRACT_ADDRESS}`);
    console.log(`Operator Address: ${OPERATOR_ADDRESS}`);

    let account;
    if (loadedPrivateKey.includes(' ')) {
        account = mnemonicToAccount(loadedPrivateKey);
    } else {
        const pk = loadedPrivateKey.startsWith('0x') ? loadedPrivateKey : `0x${loadedPrivateKey}`;
        account = privateKeyToAccount(pk as `0x${string}`);
    }

    const client = createWalletClient({
        account,
        chain: baseSepolia,
        transport: http(),
    }).extend(publicActions);

    // Read ABI
    const abiPath = path.resolve(process.cwd(), 'src/lib/abi/PredictionBattle.json');
    const { abi } = JSON.parse(fs.readFileSync(abiPath, 'utf8'));

    console.log("Sending Transaction...");
    const hash = await client.writeContract({
        address: CONTRACT_ADDRESS as `0x${string}`,
        abi,
        functionName: 'setOperator',
        args: [OPERATOR_ADDRESS, true]
    });

    console.log(`Tx Hash: ${hash}`);
    await client.waitForTransactionReceipt({ hash });
    console.log("✅ Operator Authorized Successfully!");
}

main().catch(console.error);
