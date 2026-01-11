import { NextRequest, NextResponse } from 'next/server';
import { kv } from '@vercel/kv';

export const runtime = 'edge';

// Serve the stored ticket image
export async function GET(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const imageKey = `ticket_image:${params.id}`;
        const imageBase64 = await kv.get<string>(imageKey);

        if (!imageBase64) {
            // Return a placeholder/fallback image
            return new NextResponse(null, {
                status: 302,
                headers: {
                    'Location': 'https://predictionbattle.xyz/og-fallback.png',
                },
            });
        }

        // Decode base64 and return as PNG
        const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, '');
        const buffer = Buffer.from(base64Data, 'base64');

        return new NextResponse(buffer, {
            headers: {
                'Content-Type': 'image/png',
                'Cache-Control': 'public, max-age=31536000, immutable',
            },
        });
    } catch (error) {
        console.error('Error serving ticket image:', error);
        return new NextResponse(null, { status: 500 });
    }
}
