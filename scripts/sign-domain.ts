
import { createWalletClient, http, toHex } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { optimism } from 'viem/chains';

// Configuration
const PRIVATE_KEY = process.env.PRIVATE_KEY;
const APP_FID = 915390; // The App FID (e.g. from Warpcast) - User needs to fill this
const DOMAIN = 'prediction-battle.vercel.app'; // Your domain

async function main() {
    if (!PRIVATE_KEY) {
        console.error('❌ Error: PRIVATE_KEY environment variable is required.');
        console.log('Usage: PRIVATE_KEY=0x... node scripts/sign-domain.js');
        process.exit(1);
    }

    const account = privateKeyToAccount(PRIVATE_KEY as `0x${string}`);
    const client = createWalletClient({
        account,
        chain: optimism,
        transport: http()
    });

    // 1. Construct the header (EIP-712 style or simple JSON for Farcaster?)
    // Actually Farcaster domain verification usually uses a specific EIP-712 typed data signature.
    // Spec: https://docs.farcaster.xyz/learn/architecture/frames-domains

    // Header
    const header = {
        fid: APP_FID,
        type: 'custody', // or 'app_key'
        key: account.address,
    };

    // Payload
    const payload = {
        domain: DOMAIN,
    };

    // Prepare JSON strings for base64
    const headerB64 = Buffer.from(JSON.stringify(header)).toString('base64url');
    const payloadB64 = Buffer.from(JSON.stringify(payload)).toString('base64url');

    console.log('--- Farcaster Domain Signature Generation ---');
    console.log(`Domain: ${DOMAIN}`);
    console.log(`FID: ${APP_FID}`);
    console.log(`Signer: ${account.address}`);
    console.log('\nGenerating signature...');

    // The signature is usually on the string "header.payload"
    const message = `${headerB64}.${payloadB64}`;
    const signature = await account.signMessage({ message });

    console.log('\n✅ COPY THESE VALUES TO public/.well-known/farcaster.json:');
    console.log('---------------------------------------------------------');
    console.log(`"header": "${headerB64}",`);
    console.log(`"payload": "${payloadB64}",`);
    console.log(`"signature": "${signature}"`);
    console.log('---------------------------------------------------------');
}

main().catch(console.error);
