import { NextRequest, NextResponse } from 'next/server';
import { kv } from '@vercel/kv';
import { customAlphabet } from 'nanoid';

// Custom alphabet for short codes (alphanumeric, no ambiguous chars)
const generateCode = customAlphabet('23456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz', 6);

export async function POST(req: NextRequest) {
    try {
        const { address } = await req.json();

        if (!address || typeof address !== 'string' || !address.startsWith('0x')) {
            return NextResponse.json({ success: false, error: 'Invalid address' }, { status: 400 });
        }

        const normalizedAddress = address.toLowerCase();

        // 1. Check if user already has a code
        // Key pattern: referral:address:<ADDRESS> -> CODE
        const existingCode = await kv.get<string>(`referral:address:${normalizedAddress}`);

        if (existingCode) {
            return NextResponse.json({ success: true, code: existingCode });
        }

        // 2. Generate new code (retry if collision)
        let code = generateCode();
        let retries = 0;
        let isUnique = false;

        while (retries < 3 && !isUnique) {
            // Check if code exists
            // Key pattern: referral:code:<CODE> -> ADDRESS
            const exists = await kv.exists(`referral:code:${code}`);

            if (exists === 0) {
                isUnique = true;
            } else {
                code = generateCode();
                retries++;
            }
        }

        if (!isUnique) {
            throw new Error('Failed to generate unique code');
        }

        // 3. Save mapping (Atomic transaction ideally, but pipeline is fine for now)
        // We set NO expiration, these are permanent
        const pipeline = kv.pipeline();
        pipeline.set(`referral:code:${code}`, normalizedAddress);
        pipeline.set(`referral:address:${normalizedAddress}`, code);
        await pipeline.exec();

        return NextResponse.json({ success: true, code });

    } catch (error: any) {
        console.error('Error in referral/code:', error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
