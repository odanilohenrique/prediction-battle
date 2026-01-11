import { ImageResponse } from 'next/og';

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

// Helper to format bet type into readable text
function getBetTypeLabel(bet: any): string {
    const labels: Record<string, string> = {
        post_count: `post ${bet.target}+ times`,
        likes_total: `get ${bet.target}+ likes`,
        followers_gain: `gain ${bet.target}+ followers`,
        comment_count: `get ${bet.target}+ comments`,
        custom_text: bet.castText || 'custom bet',
    };
    return labels[bet.type] || `hit ${bet.target}+ ${bet.type}`;
}

export default async function Image({ params }: { params: { id: string } }) {
    const bet = await fetchBet(params.id);

    // ===== FALLBACK =====
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
                    }}
                >
                    <div
                        style={{
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            padding: '40px 80px',
                            backgroundColor: '#111',
                            borderRadius: '24px',
                            border: '2px solid #333',
                        }}
                    >
                        <div style={{ fontSize: 72, marginBottom: 20 }}>🥊</div>
                        <div style={{ fontSize: 48, fontWeight: 900, color: '#FF5F1F' }}>
                            PREDICTION BATTLE
                        </div>
                        <div style={{ fontSize: 24, color: '#888', marginTop: 16 }}>
                            Join the Arena
                        </div>
                    </div>
                </div>
            ),
            { ...size }
        );
    }

    const isVersus = !!(bet.optionA?.label && bet.optionB?.label);
    const potDisplay = `$${(bet.totalPot || 0).toFixed(2)}`;
    const targetLabel = getBetTypeLabel(bet);
    const timestamp = new Date().toLocaleString('en-US', {
        month: '2-digit',
        day: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
    });
    const battleId = bet.id?.split('_')[1]?.toUpperCase() || 'UNKNOWN';

    // ===== BATTLE TICKET (VS Mode) =====
    if (isVersus) {
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
                            width: '600px',
                            backgroundColor: '#fff',
                            position: 'relative',
                        }}
                    >
                        {/* Jagged Top Edge */}
                        <div
                            style={{
                                position: 'absolute',
                                top: '-15px',
                                left: 0,
                                right: 0,
                                height: '30px',
                                background: 'linear-gradient(135deg, #0a0a0a 25%, transparent 25%) -20px 0, linear-gradient(225deg, #0a0a0a 25%, transparent 25%) -20px 0, linear-gradient(315deg, #0a0a0a 25%, transparent 25%), linear-gradient(45deg, #0a0a0a 25%, transparent 25%)',
                                backgroundSize: '40px 40px',
                                backgroundPosition: 'top',
                            }}
                        />

                        {/* Header */}
                        <div
                            style={{
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                padding: '50px 40px 30px',
                                borderBottom: '3px dashed #ddd',
                            }}
                        >
                            <span style={{ fontSize: 42, fontWeight: 900, color: '#111', letterSpacing: '-1px', fontFamily: 'monospace' }}>
                                FIGHT TICKET
                            </span>
                            <span style={{ fontSize: 16, color: '#888', letterSpacing: '4px', marginTop: 8, fontFamily: 'monospace' }}>
                                OFFICIAL ENTRY
                            </span>
                        </div>

                        {/* VS Section */}
                        <div
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                padding: '30px',
                                gap: '30px',
                            }}
                        >
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                <div
                                    style={{
                                        width: 100,
                                        height: 100,
                                        backgroundColor: '#f0f0f0',
                                        borderRadius: '16px',
                                        border: '3px solid #22c55e',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        fontSize: 48,
                                    }}
                                >
                                    🟢
                                </div>
                                <span style={{ fontSize: 20, fontWeight: 700, color: '#22c55e', marginTop: 10, fontFamily: 'monospace' }}>
                                    {bet.optionA?.label || 'A'}
                                </span>
                            </div>

                            <span style={{ fontSize: 40, fontWeight: 900, color: '#ddd', fontStyle: 'italic' }}>VS</span>

                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                <div
                                    style={{
                                        width: 100,
                                        height: 100,
                                        backgroundColor: '#f0f0f0',
                                        borderRadius: '16px',
                                        border: '3px solid #ef4444',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        fontSize: 48,
                                    }}
                                >
                                    🔴
                                </div>
                                <span style={{ fontSize: 20, fontWeight: 700, color: '#ef4444', marginTop: 10, fontFamily: 'monospace' }}>
                                    {bet.optionB?.label || 'B'}
                                </span>
                            </div>
                        </div>

                        {/* Details */}
                        <div style={{ display: 'flex', flexDirection: 'column', padding: '0 40px 30px', gap: '16px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span style={{ fontSize: 16, color: '#888', fontFamily: 'monospace' }}>TOTAL POT</span>
                                <span style={{ fontSize: 32, fontWeight: 900, color: '#FF5F1F', fontFamily: 'monospace' }}>{potDisplay}</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span style={{ fontSize: 16, color: '#888', fontFamily: 'monospace' }}>PREDICTORS</span>
                                <span style={{ fontSize: 24, fontWeight: 700, color: '#111', fontFamily: 'monospace' }}>{bet.participantCount || 0}</span>
                            </div>
                        </div>

                        {/* Footer */}
                        <div
                            style={{
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                padding: '20px',
                                backgroundColor: '#111',
                            }}
                        >
                            <span style={{ fontSize: 12, color: '#666', fontFamily: 'monospace' }}>BATTLE ID</span>
                            <span style={{ fontSize: 18, fontWeight: 700, color: '#fff', fontFamily: 'monospace', letterSpacing: '2px' }}>{battleId}</span>
                        </div>

                        {/* Jagged Bottom Edge */}
                        <div
                            style={{
                                position: 'absolute',
                                bottom: '-15px',
                                left: 0,
                                right: 0,
                                height: '30px',
                                background: 'linear-gradient(135deg, transparent 75%, #0a0a0a 75%), linear-gradient(225deg, transparent 75%, #0a0a0a 75%), linear-gradient(315deg, transparent 75%, #0a0a0a 75%), linear-gradient(45deg, transparent 75%, #0a0a0a 75%)',
                                backgroundSize: '40px 40px',
                            }}
                        />
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
                        width: '550px',
                        backgroundColor: '#fff',
                        position: 'relative',
                    }}
                >
                    {/* Jagged Top Edge */}
                    <div
                        style={{
                            position: 'absolute',
                            top: '-15px',
                            left: 0,
                            right: 0,
                            height: '30px',
                            background: 'linear-gradient(135deg, #0a0a0a 25%, transparent 25%) -20px 0, linear-gradient(225deg, #0a0a0a 25%, transparent 25%) -20px 0, linear-gradient(315deg, #0a0a0a 25%, transparent 25%), linear-gradient(45deg, #0a0a0a 25%, transparent 25%)',
                            backgroundSize: '40px 40px',
                            backgroundPosition: 'top',
                        }}
                    />

                    {/* Header */}
                    <div
                        style={{
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            padding: '50px 40px 30px',
                            borderBottom: '3px dashed #ddd',
                        }}
                    >
                        <span style={{ fontSize: 38, fontWeight: 900, color: '#111', letterSpacing: '-1px', fontFamily: 'monospace' }}>
                            PREDICTION CONFIRMED
                        </span>
                        <span style={{ fontSize: 14, color: '#888', letterSpacing: '4px', marginTop: 8, fontFamily: 'monospace' }}>
                            OFFICIAL RECEIPT
                        </span>
                        <span style={{ fontSize: 12, color: '#aaa', marginTop: 4, fontFamily: 'monospace' }}>
                            {timestamp}
                        </span>
                    </div>

                    {/* Details */}
                    <div style={{ display: 'flex', flexDirection: 'column', padding: '30px 40px', gap: '20px' }}>
                        {/* Player */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontSize: 16, color: '#888', fontFamily: 'monospace' }}>PLAYER</span>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                {bet.pfpUrl && (
                                    <img
                                        src={bet.pfpUrl}
                                        width={32}
                                        height={32}
                                        style={{ borderRadius: '8px' }}
                                    />
                                )}
                                <span style={{ fontSize: 22, fontWeight: 700, color: '#111', fontFamily: 'monospace' }}>
                                    @{bet.username}
                                </span>
                            </div>
                        </div>

                        {/* Target */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontSize: 16, color: '#888', fontFamily: 'monospace' }}>TARGET</span>
                            <span style={{ fontSize: 20, fontWeight: 700, color: '#111', fontFamily: 'monospace', textAlign: 'right', maxWidth: '280px' }}>
                                {targetLabel}
                            </span>
                        </div>

                        <div style={{ width: '100%', height: 2, backgroundColor: '#eee' }} />

                        {/* Total Pot */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontSize: 16, color: '#888', fontFamily: 'monospace' }}>TOTAL POT</span>
                            <span style={{ fontSize: 28, fontWeight: 900, color: '#111', fontFamily: 'monospace' }}>{potDisplay}</span>
                        </div>

                        {/* Predictors */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontSize: 16, color: '#888', fontFamily: 'monospace' }}>PREDICTORS</span>
                            <span style={{ fontSize: 28, fontWeight: 900, color: '#FF5F1F', fontFamily: 'monospace' }}>{bet.participantCount || 0}</span>
                        </div>
                    </div>

                    {/* Footer */}
                    <div
                        style={{
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            padding: '20px',
                            backgroundColor: '#111',
                        }}
                    >
                        <span style={{ fontSize: 12, color: '#666', fontFamily: 'monospace' }}>BATTLE ID</span>
                        <span style={{ fontSize: 18, fontWeight: 700, color: '#fff', fontFamily: 'monospace', letterSpacing: '2px' }}>{battleId}</span>
                    </div>

                    {/* Jagged Bottom Edge */}
                    <div
                        style={{
                            position: 'absolute',
                            bottom: '-15px',
                            left: 0,
                            right: 0,
                            height: '30px',
                            background: 'linear-gradient(135deg, transparent 75%, #0a0a0a 75%), linear-gradient(225deg, transparent 75%, #0a0a0a 75%), linear-gradient(315deg, transparent 75%, #0a0a0a 75%), linear-gradient(45deg, transparent 75%, #0a0a0a 75%)',
                            backgroundSize: '40px 40px',
                        }}
                    />
                </div>
            </div>
        ),
        { ...size }
    );
}
