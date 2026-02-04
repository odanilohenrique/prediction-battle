import { NextRequest, NextResponse } from 'next/server';
import { userStore } from '@/lib/users';

export const dynamic = 'force-dynamic';

// GET - Get user profile
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const address = searchParams.get('address');

        if (!address) {
            return NextResponse.json({ success: false, error: 'Address required' }, { status: 400 });
        }

        const user = await userStore.getUser(address);
        return NextResponse.json({ success: true, user });
    } catch (error) {
        return NextResponse.json({ success: false, error: 'Failed to loads user' }, { status: 500 });
    }
}

// POST - Update user profile
export async function POST(request: NextRequest) {
    console.log('[API] Saving user profile...');

    if (!process.env.KV_URL) {
        console.error('[API] Error: KV_URL is missing from environment variables.');
        return NextResponse.json({ success: false, error: 'Server Config Error: Database connection missing.' }, { status: 500 });
    }

    try {
        const body = await request.json();
        const { address, displayName, pfpUrl } = body;

        if (!address) {
            return NextResponse.json({ success: false, error: 'Address required' }, { status: 400 });
        }

        const user = await userStore.saveUser({
            address,
            displayName,
            pfpUrl
        });

        return NextResponse.json({ success: true, user });
    } catch (error) {
        return NextResponse.json({ success: false, error: 'Failed to save user' }, { status: 500 });
    }
}
