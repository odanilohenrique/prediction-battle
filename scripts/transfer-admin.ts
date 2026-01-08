import fs from 'fs';
import path from 'path';
import { createWalletClient, http, publicActions } from 'viem';
import { privateKeyToAccount, mnemonicToAccount } from 'viem/accounts';
import { baseSepolia } from 'viem/chains';

// Configuration
const NEW_CONTRACT = '0x5ad3587dad161f4afa7c8a9d1b561a4615eb482a';
const USER_WALLET = '0xfbb847e4ba555fa38c737caa3e3591b6448ce987';

// Load ABI safely
const abiPath = path.resolve(process.cwd(), 'src/lib/abi/PredictionBattle.json');
const PredictionBattleABI = JSON.parse(fs.readFileSync(abiPath, 'utf8'));

// Load Env
const envPath = path.resolve(process.cwd(), '.env.local');
let loadedPrivateKey = '';

if (fs.existsSync(envPath)) {
    let envContent = fs.readFileSync(envPath, 'utf8');
    envContent = envContent.replace(/\r\n/g, '\n').replace(/\r/g, '\n').replace(/\x00/g, '');

    envContent.split('\n').forEach(line => {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) return;
        const parts = trimmed.split('=');
        if (parts.length < 2) return;
        const key = parts[0].trim().replace(/\s+/g, '');
        const val = parts.slice(1).join('=').trim().replace(/^["']|["']$/g, '');

        if (key === 'PRIVATE_KEY') {
            loadedPrivateKey = val.replace(/[\s\uFEFF\x00]+/g, '');
        }
    });
}

async function main() {
    if (!loadedPrivateKey) throw new Error('Private key not found');

    const account = loadedPrivateKey.includes(' ')
        ? mnemonicToAccount(loadedPrivateKey)
        : privateKeyToAccount(loadedPrivateKey as `0x${string}`);

    const client = createWalletClient({
        account,
        chain: baseSepolia,
        transport: http(),
    }).extend(publicActions);

    console.log(`Transferring Admin rights...`);
    console.log(`From: ${account.address} (Deployer)`);
    console.log(`To:   ${USER_WALLET} (User)`);
    console.log(`Contract: ${NEW_CONTRACT}`);

    const hash = await client.writeContract({
        address: NEW_CONTRACT as `0x${string}`,
        abi: PredictionBattleABI.abi,
        functionName: 'setAdmin',
        args: [USER_WALLET],
    });

    console.log(`Transaction sent: ${hash}`);

    const receipt = await client.waitForTransactionReceipt({ hash });
    if (receipt.status === 'success') {
        console.log('✅ Admin rights transferred successfully!');
    } else {
        console.error('❌ Transfer failed.');
    }
}

main().catch(console.error);
