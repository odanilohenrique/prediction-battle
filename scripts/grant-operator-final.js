
const fs = require('fs');
const path = require('path');
const { createWalletClient, http, publicActions } = require('viem');
const { privateKeyToAccount } = require('viem/accounts');
const { baseSepolia } = require('viem/chains');
const PredictionBattleABI = require('../src/lib/abi/PredictionBattle.json');

const CONTRACT_ADDRESS = '0xfdb080e141a8fecee5d904bfec4bcd24af4338f2';
const NEW_OPERATOR = '0xFA278965A56a16252ccB850d3bB354f6a6E9fB02';

function loadPrivateKey() {
    const envPath = path.resolve(process.cwd(), '.env.local');
    const targetPath = fs.existsSync(envPath) ? envPath : path.resolve(process.cwd(), '.env');

    console.log(`Loading env from: ${targetPath}`);

    if (fs.existsSync(targetPath)) {
        let envContent = fs.readFileSync(targetPath, 'utf8');
        if (envContent.charCodeAt(0) === 0xFEFF) envContent = envContent.slice(1);

        const lines = envContent.split('\n');
        for (const line of lines) {
            const parts = line.trim().split('=');
            if (parts.length < 2) continue;
            const key = parts[0].trim().replace(/\s+/g, '');

            if (key === 'PRIVATE_KEY' || key === 'DEPLOYER_PRIVATE_KEY') {
                let val = parts.slice(1).join('=').trim().replace(/^["']|["']$/g, '');
                const cleanVal = val.replace(/[\s\uFEFF\x00]+/g, '');
                if (cleanVal.length >= 64) return cleanVal;
            }
        }
    }
    return '';
}

async function main() {
    console.log("----------------------------------------");
    console.log("Granting Operator Role Script (Final JS)");
    console.log("----------------------------------------");

    let rawKey = loadPrivateKey();
    if (!rawKey) {
        console.error("ERROR: Could not find valid PRIVATE_KEY in .env or .env.local");
        process.exit(1);
    }

    if (!rawKey.startsWith('0x')) rawKey = `0x${rawKey}`;

    const account = privateKeyToAccount(rawKey);
    console.log(`Signer Address: ${account.address}`);
    console.log(`Target Operator: ${NEW_OPERATOR}`);

    const client = createWalletClient({
        account,
        chain: baseSepolia,
        transport: http()
    }).extend(publicActions);

    try {
        const adminArgs = await client.readContract({
            address: CONTRACT_ADDRESS,
            abi: PredictionBattleABI.abi,
            functionName: 'admin',
        });
        const adminAddr = String(adminArgs);
        console.log(`Contract Admin: ${adminAddr}`);

        if (adminAddr.toLowerCase() !== account.address.toLowerCase()) {
            console.error("CRITICAL: Signer is NOT the contract admin.");
            const owner = await client.readContract({
                address: CONTRACT_ADDRESS,
                abi: PredictionBattleABI.abi,
                functionName: 'owner', // check owner just in case
            }).catch(() => 'N/A');
            console.log(`Owner: ${owner}`);
            process.exit(1);
        }
    } catch (e) {
        console.error("Failed to check admin status:", e.message);
    }

    try {
        console.log("Sending setOperator transaction...");
        const hash = await client.writeContract({
            address: CONTRACT_ADDRESS,
            abi: PredictionBattleABI.abi,
            functionName: 'setOperator',
            args: [NEW_OPERATOR, true]
        });

        console.log(`Transaction Hash: ${hash}`);
        console.log("Waiting for confirmation...");

        await client.waitForTransactionReceipt({ hash });
        console.log("SUCCESS: Operator role granted.");
    } catch (e) {
        console.error("Transaction failed:", e.message);
    }
}

main().catch(console.error);
