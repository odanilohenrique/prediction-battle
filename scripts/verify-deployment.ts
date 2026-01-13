
import { createPublicClient, http } from 'viem';
import { baseSepolia } from 'viem/chains';

async function main() {
    const address = '0x7b4b24aa26db29fc0afaadcd6388fdc61571c181';

    console.log(`Checking code at ${address}...`);

    const client = createPublicClient({
        chain: baseSepolia,
        transport: http()
    });

    const code = await client.getBytecode({ address });

    if (code && code.length > 2) {
        console.log('✅ CONTRACT VERIFIED!');
        console.log(`Bytecode length: ${code.length}`);
        console.log(`View on Explorer: https://sepolia.basescan.org/address/${address}`);
    } else {
        console.error('❌ NO CONTRACT CODE FOUND at this address.');
    }
}

main().catch(console.error);
