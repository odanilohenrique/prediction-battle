import { NextResponse } from 'next/server';

// Stub route - Auto-verification has been removed in V6
// This file exists to prevent Next.js build errors from stale cache

export async function GET() {
    return NextResponse.json({
        success: false,
        message: 'Auto-verification is not available in V6. Use decentralized verification flow.'
    });
}
