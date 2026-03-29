import { NextRequest, NextResponse } from 'next/server';
import { isAdmin } from '@/lib/config';

/**
 * Server-side admin authentication for API routes.
 * Verifies the request includes a valid admin wallet address
 * in the `x-admin-address` header.
 * 
 * Returns null if authorized, or a NextResponse 401/403 if not.
 */
export function verifyAdmin(req: NextRequest): NextResponse | null {
    const adminAddress = req.headers.get('x-admin-address');

    if (!adminAddress) {
        return NextResponse.json(
            { success: false, error: 'Unauthorized: Missing admin credentials' },
            { status: 401 }
        );
    }

    if (!isAdmin(adminAddress)) {
        return NextResponse.json(
            { success: false, error: 'Forbidden: Not an admin address' },
            { status: 403 }
        );
    }

    return null; // Authorized
}

/**
 * Extracts admin address from request body as fallback.
 * Used for POST routes that already include adminAddress in body.
 */
export function verifyAdminFromBody(adminAddress: string | undefined): NextResponse | null {
    if (!adminAddress) {
        return NextResponse.json(
            { success: false, error: 'Unauthorized: Missing admin credentials' },
            { status: 401 }
        );
    }

    if (!isAdmin(adminAddress)) {
        return NextResponse.json(
            { success: false, error: 'Forbidden: Not an admin address' },
            { status: 403 }
        );
    }

    return null; // Authorized
}
