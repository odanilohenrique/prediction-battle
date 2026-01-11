import { ImageResponse } from 'next/og';

// Use Edge runtime for OG images - this is the recommended approach
export const runtime = 'edge';

export const alt = 'Prediction Battle';
export const size = {
    width: 1200,
    height: 630,
};

export const contentType = 'image/png';

// Helper to fetch bet data directly via REST API (Edge-compatible)
async function fetchBet(id: string) {
    const KV_URL = process.env.KV_REST_API_URL;
    const KV_TOKEN = process.env.KV_REST_API_TOKEN;

    if (!KV_URL || !KV_TOKEN) {
        console.error('[OG] Missing KV credentials');
        return null;
    }

    try {
        const response = await fetch(`${KV_URL}/hget/prediction_bets/${id}`, {
            headers: {
                Authorization: `Bearer ${KV_TOKEN}`,
            },
            cache: 'no-store',
        });

        if (!response.ok) {
            console.error('[OG] KV response not OK:', response.status);
            return null;
        }

        const data = await response.json();

        if (data.result) {
            return typeof data.result === 'string' ? JSON.parse(data.result) : data.result;
        }
        return null;
    } catch (error) {
        console.error('[OG] Fetch error:', error);
        return null;
    }
}

export default async function Image({ params }: { params: { id: string } }) {
    const bet = await fetchBet(params.id);

    // ===== FALLBACK: Always return a valid image =====
    if (!bet) {
        return new ImageResponse(
            (
                <div
                    style={{
                        height: '100%',
                        width: '100%',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        backgroundColor: '#0a0a0a',
                        backgroundImage: 'radial-gradient(circle at 50% 50%, #1a1a1a 0%, #0a0a0a 100%)',
                    }}
                >
                    <div
                        style={{
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            padding: '40px 80px',
                            backgroundColor: '#111',
                            borderRadius: '24px',
                            border: '2px solid #333',
                        }}
                    >
                        <div style={{ fontSize: 72, marginBottom: 20 }}>🥊</div>
                        <div style={{ fontSize: 48, fontWeight: 900, color: '#FF5F1F', letterSpacing: '-2px' }}>
                            PREDICTION BATTLE
                        </div>
                        <div style={{ fontSize: 24, color: '#888', marginTop: 16 }}>
                            Join the Arena. Make Your Call.
                        </div>
                    </div>
                </div>
            ),
            { ...size }
        );
    }

    // Determine bet type
    const isVersus = !!(bet.optionA?.label && bet.optionB?.label);
    const potDisplay = `$${(bet.totalPot || 0).toFixed(2)}`;

    // ===== BATTLE TICKET =====
    if (isVersus) {
        return new ImageResponse(
            (
                <div
                    style={{
                        height: '100%',
                        width: '100%',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        backgroundColor: '#0a0a0a',
                    }}
                >
                    {/* Card Container */}
                    <div
                        style={{
                            display: 'flex',
                            flexDirection: 'column',
                            width: '1000px',
                            backgroundColor: '#111',
                            borderRadius: '32px',
                            border: '3px solid #333',
                            overflow: 'hidden',
                        }}
                    >
                        {/* Header */}
                        <div
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                height: '100px',
                                background: 'linear-gradient(135deg, #dc2626 0%, #ea580c 100%)',
                            }}
                        >
                            <span style={{ fontSize: 48, fontWeight: 900, color: 'white', letterSpacing: '6px' }}>
                                ⚔️ FIGHT TICKET ⚔️
                            </span>
                        </div>

                        {/* VS Section */}
                        <div
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                padding: '60px',
                                gap: '60px',
                            }}
                        >
                            {/* Player A */}
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                <div
                                    style={{
                                        width: 180,
                                        height: 180,
                                        backgroundColor: '#222',
                                        borderRadius: '24px',
                                        border: '4px solid #22c55e',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        fontSize: 80,
                                    }}
                                >
                                    🟢
                                </div>
                                <span style={{ fontSize: 32, fontWeight: 900, color: '#22c55e', marginTop: 20 }}>
                                    {bet.optionA?.label || 'PLAYER A'}
                                </span>
                            </div>

                            {/* VS */}
                            <span style={{ fontSize: 80, fontWeight: 900, color: '#333', fontStyle: 'italic' }}>VS</span>

                            {/* Player B */}
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                <div
                                    style={{
                                        width: 180,
                                        height: 180,
                                        backgroundColor: '#222',
                                        borderRadius: '24px',
                                        border: '4px solid #ef4444',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        fontSize: 80,
                                    }}
                                >
                                    🔴
                                </div>
                                <span style={{ fontSize: 32, fontWeight: 900, color: '#ef4444', marginTop: 20 }}>
                                    {bet.optionB?.label || 'PLAYER B'}
                                </span>
                            </div>
                        </div>

                        {/* Footer */}
                        <div
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                padding: '30px',
                                backgroundColor: '#0a0a0a',
                                borderTop: '2px solid #222',
                                gap: '60px',
                            }}
                        >
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                <span style={{ fontSize: 18, color: '#666', letterSpacing: '2px' }}>TOTAL POT</span>
                                <span style={{ fontSize: 48, fontWeight: 900, color: '#22c55e' }}>{potDisplay}</span>
                            </div>
                            <div style={{ width: 2, height: 60, backgroundColor: '#333' }} />
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                <span style={{ fontSize: 18, color: '#666', letterSpacing: '2px' }}>PREDICTORS</span>
                                <span style={{ fontSize: 48, fontWeight: 900, color: 'white' }}>
                                    {bet.participantCount || 0}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
            ),
            { ...size }
        );
    }

    // ===== STANDARD RECEIPT =====
    return new ImageResponse(
        (
            <div
                style={{
                    height: '100%',
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: '#0a0a0a',
                }}
            >
                {/* Receipt Card */}
                <div
                    style={{
                        display: 'flex',
                        flexDirection: 'column',
                        width: '700px',
                        backgroundColor: '#fafafa',
                        padding: '50px',
                        borderRadius: '8px',
                    }}
                >
                    {/* Header */}
                    <div
                        style={{
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            borderBottom: '3px dashed #ccc',
                            paddingBottom: '30px',
                            marginBottom: '30px',
                        }}
                    >
                        <span style={{ fontSize: 56, fontWeight: 900, color: '#111', letterSpacing: '-2px' }}>
                            PREDICTION
                        </span>
                        <span style={{ fontSize: 24, color: '#888', letterSpacing: '8px', marginTop: 8 }}>
                            OFFICIAL RECEIPT
                        </span>
                    </div>

                    {/* Details */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontSize: 24, color: '#888' }}>PLAYER</span>
                            <span style={{ fontSize: 32, fontWeight: 700, color: '#111' }}>@{bet.username}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontSize: 24, color: '#888' }}>TARGET</span>
                            <span style={{ fontSize: 28, fontWeight: 700, color: '#111' }}>{bet.target}+ {bet.type}</span>
                        </div>
                        <div style={{ width: '100%', height: 2, backgroundColor: '#ddd' }} />
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                                <span style={{ fontSize: 20, color: '#888' }}>TOTAL POT</span>
                                <span style={{ fontSize: 56, fontWeight: 900, color: '#111' }}>{potDisplay}</span>
                            </div>
                            <div
                                style={{
                                    padding: '16px 32px',
                                    backgroundColor: '#FF5F1F',
                                    borderRadius: '12px',
                                    color: 'white',
                                    fontSize: 24,
                                    fontWeight: 900,
                                }}
                            >
                                BET NOW
                            </div>
                        </div>
                    </div>

                    {/* Footer */}
                    <div
                        style={{
                            display: 'flex',
                            justifyContent: 'center',
                            borderTop: '3px dashed #ccc',
                            paddingTop: '20px',
                            marginTop: '30px',
                        }}
                    >
                        <span style={{ fontSize: 16, color: '#aaa' }}>predictionbattle.xyz</span>
                    </div>
                </div>
            </div>
        ),
        { ...size }
    );
}
