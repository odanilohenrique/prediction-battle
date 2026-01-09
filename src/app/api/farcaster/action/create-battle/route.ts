import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
    const baseUrl = process.env.NEXT_PUBLIC_URL || 'https://predictionbattle.xyz';

    const metadata = {
        name: "Predict This", // "Bet" prohibited
        icon: "flame",
        description: "Create a battle based on this cast.",
        aboutUrl: `${baseUrl}/about`,
        action: {
            type: "post",
        }
    };

    return NextResponse.json(metadata);
}

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        // Farcaster Action payload usually contains { trustedData: { messageBytes: ... } }
        // We can decode using Neynar or Hubs, but for MVP we might trust 'untrustedData' if available for speed
        // or just redirect assuming the valid data is in the cast.

        // In a real implementation we decode the message to get cast hash/text.
        // For now, assuming we extract castId from the payload structure provided by Warpcast.
        const { untrustedData } = body;

        const castId = untrustedData?.castId?.hash;
        const castText = untrustedData?.castId?.text; // Usually not here, need to fetch
        const authorFid = untrustedData?.castId?.fid;

        // Construct URL for the "Create Battle" form
        const baseUrl = process.env.NEXT_PUBLIC_URL || 'https://predictionbattle.xyz';

        // We'll pass the Cast Hash to the frontend, which will fetch details
        const redirectUrl = `${baseUrl}/create?castHash=${castId}&action=create-battle`;

        // Return response to open the URL
        return NextResponse.json({
            type: 'url',
            url: redirectUrl
        });

    } catch (error) {
        console.error('Error in Farcaster Action:', error);
        return NextResponse.json({ message: 'Error processing action' }, { status: 500 });
    }
}
