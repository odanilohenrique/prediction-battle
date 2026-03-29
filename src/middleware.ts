import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { isAdmin } from '@/lib/config';

// Simple in-memory rate limiter (per-deployment, resets on cold start)
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();

function getRateLimitKey(req: NextRequest): string {
    return req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown';
}

function isRateLimited(key: string, maxRequests: number, windowMs: number): boolean {
    const now = Date.now();
    const entry = rateLimitMap.get(key);

    if (!entry || now > entry.resetTime) {
        rateLimitMap.set(key, { count: 1, resetTime: now + windowMs });
        return false;
    }

    entry.count++;
    return entry.count > maxRequests;
}

export function middleware(req: NextRequest) {
    const { pathname } = req.nextUrl;
    const response = NextResponse.next();

    // ==========================================
    // 1. SECURITY HEADERS (all responses)
    // ==========================================
    response.headers.set('X-Frame-Options', 'DENY');
    response.headers.set('X-Content-Type-Options', 'nosniff');
    response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
    response.headers.set('X-XSS-Protection', '1; mode=block');
    response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    response.headers.set(
        'Strict-Transport-Security',
        'max-age=31536000; includeSubDomains; preload'
    );

    // ==========================================
    // 2. BLOCK DEBUG ENDPOINTS IN PRODUCTION
    // ==========================================
    if (pathname.startsWith('/api/debug')) {
        return NextResponse.json(
            { success: false, error: 'Not found' },
            { status: 404 }
        );
    }

    // ==========================================
    // 3. PROTECT ADMIN API ROUTES
    // ==========================================
    if (pathname.startsWith('/api/admin')) {
        const adminAddress = req.headers.get('x-admin-address');

        if (!adminAddress || !isAdmin(adminAddress)) {
            return NextResponse.json(
                { success: false, error: 'Unauthorized' },
                { status: 401 }
            );
        }
    }

    // ==========================================
    // 4. RATE LIMITING ON SENSITIVE ENDPOINTS
    // ==========================================
    const ip = getRateLimitKey(req);

    // Strict rate limit on write endpoints
    if (req.method === 'POST' && (
        pathname.startsWith('/api/predictions/') ||
        pathname.startsWith('/api/upload') ||
        pathname.startsWith('/api/user') ||
        pathname.startsWith('/api/referral')
    )) {
        if (isRateLimited(ip, 30, 60_000)) { // 30 requests per minute
            return NextResponse.json(
                { success: false, error: 'Too many requests. Please try again later.' },
                { status: 429 }
            );
        }
    }

    // Very strict rate limit on upload
    if (pathname === '/api/upload' && req.method === 'POST') {
        if (isRateLimited(`upload:${ip}`, 5, 60_000)) { // 5 uploads per minute
            return NextResponse.json(
                { success: false, error: 'Upload rate limit exceeded.' },
                { status: 429 }
            );
        }
    }

    // ==========================================
    // 5. PROTECT CRON ENDPOINTS
    // ==========================================
    if (pathname.startsWith('/api/cron')) {
        const authHeader = req.headers.get('authorization');
        const cronSecret = process.env.CRON_SECRET;

        if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
            return NextResponse.json(
                { success: false, error: 'Unauthorized' },
                { status: 401 }
            );
        }
    }

    return response;
}

// Only run middleware on API routes and admin pages
export const config = {
    matcher: [
        '/api/:path*',
        '/admin/:path*',
    ],
};
