import { NextRequest, NextResponse } from 'next/server';
import { kv } from '@vercel/kv';

// API to save ticket image (base64) for a prediction
export async function POST(request: NextRequest) {
    try {
        const { predictionId, imageBase64 } = await request.json();

        if (!predictionId || !imageBase64) {
            return NextResponse.json({ error: 'Missing predictionId or imageBase64' }, { status: 400 });
        }

        // Store the image in KV with a specific key
        const imageKey = `ticket_image:${predictionId}`;
        await kv.set(imageKey, imageBase64, { ex: 60 * 60 * 24 * 30 }); // Expires in 30 days

        return NextResponse.json({ success: true, key: imageKey });
    } catch (error) {
        console.error('Error saving ticket image:', error);
        return NextResponse.json({ error: 'Failed to save image' }, { status: 500 });
    }
}

// API to get ticket image for a prediction
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const predictionId = searchParams.get('id');

        if (!predictionId) {
            return NextResponse.json({ error: 'Missing id' }, { status: 400 });
        }

        const imageKey = `ticket_image:${predictionId}`;
        const imageBase64 = await kv.get<string>(imageKey);

        if (!imageBase64) {
            return NextResponse.json({ error: 'Image not found' }, { status: 404 });
        }

        // Return the image as base64
        return NextResponse.json({ image: imageBase64 });
    } catch (error) {
        console.error('Error getting ticket image:', error);
        return NextResponse.json({ error: 'Failed to get image' }, { status: 500 });
    }
}
