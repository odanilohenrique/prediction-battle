import fs from 'fs';
import path from 'path';
import { createWalletClient, http, publicActions, parseUnits } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { baseSepolia } from 'viem/chains';
import dotenv from 'dotenv';

// Custom Env Parser
const envPath = path.resolve(process.cwd(), '.env.local');
let loadedPrivateKey = '';

if (fs.existsSync(envPath)) {
    let envContent = fs.readFileSync(envPath, 'utf8');
    if (envContent.charCodeAt(0) === 0xFEFF) envContent = envContent.slice(1);
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

        if (cleanKey === 'NEXT_PUBLIC_CONTRACT_ADDRESS' && !process.env.NEXT_PUBLIC_CONTRACT_ADDRESS) {
            process.env.NEXT_PUBLIC_CONTRACT_ADDRESS = val.replace(/[\s\uFEFF\x00]+/g, '');
        }
    });
}

// Configuration
const CONTRACT_ADDRESS = '0x1e57a200b5aa90e44701e4bba0b70a02c7d074c4';
const USDC_ADDRESS = '0x036CbD53842c5426634e7929541eC2318f3dCF7e'; // Base Sepolia USDC
const PRIVATE_KEY = loadedPrivateKey || process.env.PRIVATE_KEY;

async function main() {
    console.log("--- DEBUG BET FLOW ---");
    if (!PRIVATE_KEY) throw new Error("Missing PRIVATE_KEY");
    if (!CONTRACT_ADDRESS) throw new Error("Missing CONTRACT_ADDRESS");

    // Remove whitespace/BOM from key
    const cleanKey = PRIVATE_KEY.replace(/[\s\uFEFF\x00]+/g, '');
    const account = privateKeyToAccount((cleanKey.startsWith('0x') ? cleanKey : `0x${cleanKey}`) as `0x${string}`);

    const client = createWalletClient({
        account,
        chain: baseSepolia,
        transport: http(),
    }).extend(publicActions);

    console.log(`Wallet: ${account.address}`);
    console.log(`Contract: ${CONTRACT_ADDRESS}`);

    // 1. Check USDC Balance
    const usdcAbi = [{
        name: 'balanceOf', type: 'function', stateMutability: 'view', inputs: [{ name: 'account', type: 'address' }], outputs: [{ name: '', type: 'uint256' }]
    }, {
        name: 'approve', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'spender', type: 'address' }, { name: 'amount', type: 'uint256' }], outputs: [{ name: '', type: 'bool' }]
    }, {
        name: 'allowance', type: 'function', stateMutability: 'view', inputs: [{ name: 'owner', type: 'address' }, { name: 'spender', type: 'address' }], outputs: [{ name: '', type: 'uint256' }]
    }];

    const balance = await client.readContract({
        address: USDC_ADDRESS as `0x${string}`,
        abi: usdcAbi,
        functionName: 'balanceOf',
        args: [account.address]
    }) as bigint;

    console.log(`USDC Balance: ${balance.toString()} (Raw)`);
    if (balance === BigInt(0)) {
        throw new Error("Wallet has 0 USDC. Cannot test bet flow.");
    }

    // 2. Create Prediction
    const predictionId = `debug-${Date.now()}`;
    console.log(`Creating Prediction ID: ${predictionId}`);

    // Read App ABI
    const abiPath = path.resolve(process.cwd(), 'src/lib/abi/PredictionBattle.json');
    const { abi } = JSON.parse(fs.readFileSync(abiPath, 'utf8'));

    try {
        const createHash = await client.writeContract({
            address: CONTRACT_ADDRESS as `0x${string}`,
            abi,
            functionName: 'createPrediction',
            args: [predictionId, BigInt(100), BigInt(3600)] // Target 100, 1 hour duration
        });
        console.log(`Create Tx: ${createHash}`);
        await client.waitForTransactionReceipt({ hash: createHash });
        console.log("✅ Prediction Created");
    } catch (e) {
        console.error("Creation Failed:", e);
        return;
    }

    // 3. Approve
    const betAmount = parseUnits('0.1', 6);
    console.log(`Approving ${betAmount} USDC...`);

    const currentAllowance = await client.readContract({
        address: USDC_ADDRESS as `0x${string}`,
        abi: usdcAbi,
        functionName: 'allowance',
        args: [account.address, CONTRACT_ADDRESS as `0x${string}`]
    }) as bigint;

    if (currentAllowance < betAmount) {
        try {
            const approveHash = await client.writeContract({
                address: USDC_ADDRESS as `0x${string}`,
                abi: usdcAbi,
                functionName: 'approve',
                args: [CONTRACT_ADDRESS as `0x${string}`, betAmount]
            });
            console.log(`Approve Tx: ${approveHash}`);
            await client.waitForTransactionReceipt({ hash: approveHash });
            console.log("✅ USDC Approved");
        } catch (e) {
            console.error("Approval Failed:", e);
            return;
        }
    } else {
        console.log("✅ Already Approved");
    }

    // 4. Place Bet
    console.log("Placing Bet...");
    try {
        const betHash = await client.writeContract({
            address: CONTRACT_ADDRESS as `0x${string}`,
            abi,
            functionName: 'placeBet',
            args: [predictionId, true, betAmount] // YES vote
        });
        console.log(`Bet Tx: ${betHash}`);
        const receipt = await client.waitForTransactionReceipt({ hash: betHash });
        if (receipt.status === 'success') {
            console.log("✅ Bet Placed Successfully!");
        } else {
            console.error("❌ Bet Transaction Reverted on-chain.");
        }
    } catch (e) {
        console.error("Bet Placement Failed:", e);
    }
}

main().catch(console.error);
