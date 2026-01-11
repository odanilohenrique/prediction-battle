import { ImageResponse } from 'next/og';

export const runtime = 'edge';

export const alt = 'Prediction Battle';
export const size = {
    width: 1200,
    height: 630,
};

export const contentType = 'image/png';

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
    if (bet.castText && bet.castText.length > 5) return bet.castText;

    const target = bet.target || bet.targetValue || '';
    const labels: Record<string, string> = {
        post_count: `post ${target}+ times`,
        likes_total: `get ${target}+ likes`,
        followers_gain: `gain ${target}+ followers`,
        comment_count: `get ${target}+ comments`,
    };
    return labels[bet.type] || bet.castText || 'Make your prediction!';
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
                    <div style={{ fontSize: 48, fontWeight: 900, color: '#FF5F1F' }}>PREDICTION BATTLE</div>
                </div>
            ),
            { ...size }
        );
    }

    // Check if it's a Battle (has optionA and optionB)
    const isBattle = !!(bet.optionA?.label && bet.optionB?.label);
    const battleId = (bet.id?.split('_')[1] || 'UNKNOWN').toUpperCase().slice(0, 9);
    const targetLabel = getBetTypeLabel(bet);
    const potDisplay = `$${(bet.totalPot || 0).toFixed(2)}`;

    // ========================================
    // BATTLE TICKET - Dark theme with VS
    // (DO NOT MODIFY - User approved)
    // ========================================
    if (isBattle) {
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
                        backgroundColor: '#0f0f0f',
                        borderRadius: '32px',
                        border: '2px solid #222222',
                        overflow: 'hidden',
                    }}>
                        {/* Header */}
                        <div style={{
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            padding: '28px',
                            backgroundColor: '#dc2626',
                        }}>
                            <span style={{ fontSize: 36, fontWeight: 900, color: '#ffffff', fontStyle: 'italic', letterSpacing: '-1px' }}>
                                FIGHT TICKET
                            </span>
                            <span style={{ fontSize: 14, color: '#ffffff', opacity: 0.8, letterSpacing: '6px', marginTop: 4 }}>
                                OFFICIAL ENTRY
                            </span>
                        </div>

                        {/* Prediction Phrase */}
                        <div style={{
                            display: 'flex',
                            justifyContent: 'center',
                            padding: '24px 30px 16px',
                        }}>
                            <span style={{ fontSize: 22, fontWeight: 700, color: '#ffffff', fontStyle: 'italic', textAlign: 'center' }}>
                                "{targetLabel}"
                            </span>
                        </div>

                        {/* VS Section */}
                        <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            padding: '20px 40px 30px',
                            gap: '30px',
                        }}>
                            {/* Fighter A */}
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                <div style={{
                                    width: 100,
                                    height: 100,
                                    backgroundColor: '#1a1a1a',
                                    borderRadius: '20px',
                                    border: '3px solid #333333',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    fontSize: 50,
                                    overflow: 'hidden',
                                }}>
                                    {bet.optionA?.imageUrl ? (
                                        <img src={bet.optionA.imageUrl} width={100} height={100} style={{ objectFit: 'cover' }} />
                                    ) : (
                                        <span>🟢</span>
                                    )}
                                </div>
                                <span style={{ fontSize: 18, fontWeight: 700, color: '#22c55e', marginTop: 10 }}>
                                    {bet.optionA?.label || 'A'}
                                </span>
                            </div>

                            {/* VS */}
                            <span style={{ fontSize: 50, fontWeight: 900, color: '#333333', fontStyle: 'italic' }}>VS</span>

                            {/* Fighter B */}
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                <div style={{
                                    width: 100,
                                    height: 100,
                                    backgroundColor: '#1a1a1a',
                                    borderRadius: '20px',
                                    border: '3px solid #333333',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    fontSize: 50,
                                    overflow: 'hidden',
                                }}>
                                    {bet.optionB?.imageUrl ? (
                                        <img src={bet.optionB.imageUrl} width={100} height={100} style={{ objectFit: 'cover' }} />
                                    ) : (
                                        <span>🔴</span>
                                    )}
                                </div>
                                <span style={{ fontSize: 18, fontWeight: 700, color: '#ef4444', marginTop: 10 }}>
                                    {bet.optionB?.label || 'B'}
                                </span>
                            </div>
                        </div>

                        {/* Stats Row */}
                        <div style={{
                            display: 'flex',
                            justifyContent: 'center',
                            gap: '50px',
                            padding: '24px',
                            backgroundColor: '#0a0a0a',
                            borderTop: '1px solid #222222',
                        }}>
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                <span style={{ fontSize: 14, color: '#666666', letterSpacing: '2px' }}>TOTAL POT</span>
                                <span style={{ fontSize: 32, fontWeight: 900, color: '#22c55e' }}>{potDisplay}</span>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                <span style={{ fontSize: 14, color: '#666666', letterSpacing: '2px' }}>PREDICTORS</span>
                                <span style={{ fontSize: 32, fontWeight: 900, color: '#ffffff' }}>{bet.participantCount || 0}</span>
                            </div>
                        </div>

                        {/* Footer */}
                        <div style={{
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            padding: '16px',
                            backgroundColor: '#000000',
                        }}>
                            <span style={{ fontSize: 12, color: '#444444' }}>BATTLE ID: {battleId}</span>
                        </div>
                    </div>
                </div>
            ),
            { ...size }
        );
    }

    // ========================================
    // PREDICTION RECEIPT - Enhanced Design
    // ========================================
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
                    width: '900px',
                    backgroundColor: '#ffffff',
                    borderRadius: '24px',
                    overflow: 'hidden',
                    boxShadow: '0 25px 50px rgba(0,0,0,0.5)',
                }}>
                    {/* Header with Orange accent */}
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: '40px',
                        backgroundColor: '#FF5F1F',
                    }}>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                            <span style={{ fontSize: 52, fontWeight: 900, color: '#ffffff', letterSpacing: '-2px' }}>
                                🎯 PREDICTION
                            </span>
                            <span style={{ fontSize: 20, color: '#ffffff', opacity: 0.9, letterSpacing: '8px', marginTop: 8 }}>
                                OFFICIAL RECEIPT
                            </span>
                        </div>
                    </div>

                    {/* Main Content */}
                    <div style={{
                        display: 'flex',
                        flexDirection: 'column',
                        padding: '40px 60px',
                        gap: '24px',
                    }}>
                        {/* Player Row - Large and prominent */}
                        <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '20px',
                            padding: '24px',
                            backgroundColor: '#f8f8f8',
                            borderRadius: '16px',
                        }}>
                            {bet.pfpUrl && (
                                <img src={bet.pfpUrl} width={80} height={80} style={{ borderRadius: '16px' }} />
                            )}
                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                                <span style={{ fontSize: 20, color: '#888888' }}>PLAYER</span>
                                <span style={{ fontSize: 40, fontWeight: 900, color: '#111111' }}>@{bet.username}</span>
                            </div>
                        </div>

                        {/* Target - The prediction question */}
                        <div style={{
                            display: 'flex',
                            flexDirection: 'column',
                            padding: '24px',
                            backgroundColor: '#111111',
                            borderRadius: '16px',
                        }}>
                            <span style={{ fontSize: 16, color: '#888888', marginBottom: 8 }}>PREDICTION TARGET</span>
                            <span style={{ fontSize: 28, fontWeight: 700, color: '#ffffff', lineHeight: 1.3 }}>
                                "{targetLabel}"
                            </span>
                        </div>

                        {/* Stats Row */}
                        <div style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            gap: '24px',
                        }}>
                            {/* Total Pot */}
                            <div style={{
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                flex: 1,
                                padding: '24px',
                                backgroundColor: '#22c55e',
                                borderRadius: '16px',
                            }}>
                                <span style={{ fontSize: 18, color: '#ffffff', opacity: 0.9 }}>TOTAL POT</span>
                                <span style={{ fontSize: 48, fontWeight: 900, color: '#ffffff' }}>{potDisplay}</span>
                            </div>

                            {/* Predictors */}
                            <div style={{
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                flex: 1,
                                padding: '24px',
                                backgroundColor: '#111111',
                                borderRadius: '16px',
                            }}>
                                <span style={{ fontSize: 18, color: '#888888' }}>PREDICTORS</span>
                                <span style={{ fontSize: 48, fontWeight: 900, color: '#FF5F1F' }}>{bet.participantCount || 0}</span>
                            </div>
                        </div>
                    </div>

                    {/* Footer */}
                    <div style={{
                        display: 'flex',
                        justifyContent: 'center',
                        padding: '20px',
                        backgroundColor: '#f0f0f0',
                        borderTop: '2px dashed #dddddd',
                    }}>
                        <span style={{ fontSize: 16, color: '#999999', letterSpacing: '4px' }}>
                            ID: {battleId} • predictionbattle.xyz
                        </span>
                    </div>
                </div>
            </div>
        ),
        { ...size }
    );
}
