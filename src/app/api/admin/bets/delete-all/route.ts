import { NextRequest, NextResponse } from 'next/server';
import { store } from '@/lib/store';
import { verifyAdminFromBody } from '@/lib/adminAuth';

export async function POST(req: NextRequest) {
    try {
        const { adminAddress } = await req.json();

        // SECURITY: Verify admin (this is a destructive operation)
        const authError = verifyAdminFromBody(adminAddress);
        if (authError) return authError;

        await store.deleteAllBets();

        return NextResponse.json({ success: true });

    } catch (error) {
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
