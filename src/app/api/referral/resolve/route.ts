import { NextRequest, NextResponse } from 'next/server';
import { kv } from '@vercel/kv';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const code = searchParams.get('code');

        if (!code) {
            return NextResponse.json({ success: false, error: 'Code required' }, { status: 400 });
        }

        // 1. If code is already an address, return it
        if (code.startsWith('0x') && code.length === 42) {
            return NextResponse.json({ success: true, address: code });
        }

        // 2. Lookup code in KV
        const address = await kv.get<string>(`referral:code:${code}`);

        if (!address) {
            return NextResponse.json({ success: false, error: 'Code not found' }, { status: 404 });
        }

        return NextResponse.json({ success: true, address });

    } catch (error: any) {
        console.error('Error resolving referral code:', error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
