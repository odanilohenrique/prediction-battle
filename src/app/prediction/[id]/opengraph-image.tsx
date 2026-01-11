import { ImageResponse } from 'next/og';

export const runtime = 'edge';

export const alt = 'Prediction Battle';
export const size = {
    width: 1200,
    height: 630,
};

export const contentType = 'image/png';

// Helper to fetch bet data directly via REST API
async function fetchBet(id: string) {
    const KV_URL = process.env.KV_REST_API_URL;
    const KV_TOKEN = process.env.KV_REST_API_TOKEN;

    if (!KV_URL || !KV_TOKEN) return null;

    try {
        const response = await fetch(`${KV_URL}/hget/prediction_bets/${id}`, {
            headers: { Authorization: `Bearer ${KV_TOKEN}` },
            cache: 'no-store',
        });

        if (!response.ok) return null;

        const data = await response.json();
        if (data.result) {
            return typeof data.result === 'string' ? JSON.parse(data.result) : data.result;
        }
        return null;
    } catch {
        return null;
    }
}

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

    // FALLBACK
    if (!bet) {
        return new ImageResponse(
            (
                <div style={{
                    height: '100%',
                    width: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: '#0a0a0a',
                }}>
                    <div style={{ fontSize: 72, marginBottom: 20 }}>🥊</div>
                    <div style={{ fontSize: 48, fontWeight: 900, color: '#FF5F1F' }}>
                        PREDICTION BATTLE
                    </div>
                </div>
            ),
            { ...size }
        );
    }

    const isVersus = !!(bet.optionA?.label && bet.optionB?.label);
    const potDisplay = `$${(bet.totalPot || 0).toFixed(2)}`;
    const targetLabel = getBetTypeLabel(bet);
    const battleId = (bet.id?.split('_')[1] || 'UNKNOWN').toUpperCase();

    // VERSUS / BATTLE MODE
    if (isVersus) {
        return new ImageResponse(
            (
                <div style={{
                    height: '100%',
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: '#0a0a0a',
                }}>
                    <div style={{
                        display: 'flex',
                        flexDirection: 'column',
                        width: '800px',
                        backgroundColor: '#ffffff',
                        borderRadius: '24px',
                        overflow: 'hidden',
                    }}>
                        {/* Header */}
                        <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            padding: '30px',
                            backgroundColor: '#111111',
                        }}>
                            <span style={{ fontSize: 40, fontWeight: 900, color: '#ffffff' }}>
                                ⚔️ FIGHT TICKET ⚔️
                            </span>
                        </div>

                        {/* VS Section */}
                        <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            padding: '40px',
                            gap: '40px',
                        }}>
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                <div style={{
                                    width: 120,
                                    height: 120,
                                    backgroundColor: '#e8f5e9',
                                    borderRadius: '20px',
                                    border: '4px solid #22c55e',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    fontSize: 60,
                                }}>🟢</div>
                                <span style={{ fontSize: 24, fontWeight: 900, color: '#22c55e', marginTop: 12 }}>
                                    {bet.optionA?.label || 'A'}
                                </span>
                            </div>

                            <span style={{ fontSize: 60, fontWeight: 900, color: '#cccccc' }}>VS</span>

                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                <div style={{
                                    width: 120,
                                    height: 120,
                                    backgroundColor: '#ffebee',
                                    borderRadius: '20px',
                                    border: '4px solid #ef4444',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    fontSize: 60,
                                }}>🔴</div>
                                <span style={{ fontSize: 24, fontWeight: 900, color: '#ef4444', marginTop: 12 }}>
                                    {bet.optionB?.label || 'B'}
                                </span>
                            </div>
                        </div>

                        {/* Stats */}
                        <div style={{
                            display: 'flex',
                            justifyContent: 'center',
                            gap: '60px',
                            padding: '30px',
                            borderTop: '2px solid #eeeeee',
                        }}>
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                <span style={{ fontSize: 16, color: '#888888' }}>TOTAL POT</span>
                                <span style={{ fontSize: 36, fontWeight: 900, color: '#22c55e' }}>{potDisplay}</span>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                <span style={{ fontSize: 16, color: '#888888' }}>PREDICTORS</span>
                                <span style={{ fontSize: 36, fontWeight: 900, color: '#111111' }}>{bet.participantCount || 0}</span>
                            </div>
                        </div>
                    </div>
                </div>
            ),
            { ...size }
        );
    }

    // STANDARD PREDICTION
    return new ImageResponse(
        (
            <div style={{
                height: '100%',
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: '#0a0a0a',
            }}>
                <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    width: '700px',
                    backgroundColor: '#ffffff',
                    borderRadius: '24px',
                    overflow: 'hidden',
                }}>
                    {/* Header */}
                    <div style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        padding: '40px',
                        borderBottom: '3px dashed #dddddd',
                    }}>
                        <span style={{ fontSize: 44, fontWeight: 900, color: '#111111' }}>
                            PREDICTION CONFIRMED
                        </span>
                        <span style={{ fontSize: 18, color: '#888888', marginTop: 8, letterSpacing: 4 }}>
                            OFFICIAL RECEIPT
                        </span>
                    </div>

                    {/* Details */}
                    <div style={{
                        display: 'flex',
                        flexDirection: 'column',
                        padding: '30px 50px',
                        gap: '20px',
                    }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontSize: 18, color: '#888888' }}>PLAYER</span>
                            <span style={{ fontSize: 28, fontWeight: 700, color: '#111111' }}>@{bet.username}</span>
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontSize: 18, color: '#888888' }}>TARGET</span>
                            <span style={{ fontSize: 24, fontWeight: 700, color: '#111111' }}>{targetLabel}</span>
                        </div>

                        <div style={{ width: '100%', height: 2, backgroundColor: '#eeeeee' }} />

                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontSize: 18, color: '#888888' }}>TOTAL POT</span>
                            <span style={{ fontSize: 40, fontWeight: 900, color: '#111111' }}>{potDisplay}</span>
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontSize: 18, color: '#888888' }}>PREDICTORS</span>
                            <span style={{ fontSize: 40, fontWeight: 900, color: '#FF5F1F' }}>{bet.participantCount || 0}</span>
                        </div>
                    </div>

                    {/* Footer */}
                    <div style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        padding: '24px',
                        backgroundColor: '#111111',
                    }}>
                        <span style={{ fontSize: 14, color: '#666666' }}>BATTLE ID</span>
                        <span style={{ fontSize: 22, fontWeight: 700, color: '#ffffff', letterSpacing: 3 }}>{battleId}</span>
                    </div>
                </div>
            </div>
        ),
        { ...size }
    );
}
