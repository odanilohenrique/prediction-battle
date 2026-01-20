
import { put } from '@vercel/blob';
import { NextResponse } from 'next/server';

export async function POST(request: Request): Promise<NextResponse> {
    const { searchParams } = new URL(request.url);
    const filename = searchParams.get('filename') || 'evidence-image';

    // ⚠️ The Vercel Blob token is required in your environment variables:
    // BLOB_READ_WRITE_TOKEN=...
    if (!process.env.BLOB_READ_WRITE_TOKEN) {
        return NextResponse.json(
            { error: 'Vercel Blob not configured. Env var BLOB_READ_WRITE_TOKEN is missing.' },
            { status: 500 }
        );
    }

    try {
        const formData = await request.formData();
        const file = formData.get('file') as File;

        if (!file) {
            return NextResponse.json({ error: 'No file provided' }, { status: 400 });
        }

        // Upload to Vercel Blob
        const blob = await put(file.name || filename, file, {
            access: 'public',
        });

        return NextResponse.json({ url: blob.url });
    } catch (error) {
        console.error('Upload error:', error);
        return NextResponse.json(
            { error: 'Upload failed', details: (error as Error).message },
            { status: 500 }
        );
    }
}
