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

function getTargetLabel(bet: any): string {
    if (bet.castText && bet.castText.length > 5) return bet.castText;
    const target = bet.target || bet.targetValue || '0';
    const labels: Record<string, string> = {
        post_count: `post ${target}+ times`,
        likes_total: `get ${target}+ likes`,
        followers_gain: `gain ${target}+ followers`,
        comment_count: `get ${target}+ comments`,
    };
    return labels[bet.type] || bet.castText || 'Make prediction';
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
                    <div style={{ fontSize: 72, marginBottom: 20 }}>PREDICTION BATTLE</div>
                </div>
            ),
            { ...size }
        );
    }

    const isBattle = !!(bet.optionA?.label && bet.optionB?.label);
    const battleId = (bet.id?.split('_')[1] || 'UNKNOWN').toUpperCase().slice(0, 9);
    const targetLabel = getTargetLabel(bet);
    const potDisplay = `$${(bet.totalPot || 0).toFixed(2)}`;
    const timestamp = new Date().toLocaleString('en-US', {
        month: '2-digit', day: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit', second: '2-digit'
    });

    // ========================================
    // BATTLE TICKET - Dark with VS
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
                        width: '500px',
                        backgroundColor: '#0f0f0f',
                        borderRadius: '24px',
                        border: '1px solid #222',
                        overflow: 'hidden',
                    }}>
                        {/* Header - Red gradient */}
                        <div style={{
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            padding: '20px',
                            backgroundColor: '#dc2626',
                        }}>
                            <span style={{ fontSize: 28, fontWeight: 900, color: '#fff', fontStyle: 'italic' }}>FIGHT TICKET</span>
                            <span style={{ fontSize: 10, color: '#fff', opacity: 0.8, letterSpacing: '4px' }}>OFFICIAL ENTRY</span>
                        </div>

                        {/* Phrase */}
                        <div style={{ display: 'flex', justifyContent: 'center', padding: '16px 20px 8px' }}>
                            <span style={{ fontSize: 16, fontWeight: 700, color: '#fff', fontStyle: 'italic', textAlign: 'center' }}>
                                "{targetLabel}"
                            </span>
                        </div>

                        {/* VS Section */}
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px', gap: '20px' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                <div style={{
                                    width: 70, height: 70, backgroundColor: '#1a1a1a', borderRadius: '14px',
                                    border: '2px solid #333', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    overflow: 'hidden',
                                }}>
                                    {bet.optionA?.imageUrl ? (
                                        <img src={bet.optionA.imageUrl} width={70} height={70} style={{ objectFit: 'cover' }} />
                                    ) : (
                                        <span style={{ fontSize: 32, color: '#22c55e' }}>A</span>
                                    )}
                                </div>
                                <span style={{ fontSize: 12, fontWeight: 700, color: '#fff', marginTop: 6, opacity: 0.8 }}>
                                    {bet.optionA?.label?.slice(0, 12) || 'A'}
                                </span>
                            </div>
                            <span style={{ fontSize: 32, fontWeight: 900, color: '#333', fontStyle: 'italic' }}>VS</span>
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                <div style={{
                                    width: 70, height: 70, backgroundColor: '#1a1a1a', borderRadius: '14px',
                                    border: '2px solid #333', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    overflow: 'hidden',
                                }}>
                                    {bet.optionB?.imageUrl ? (
                                        <img src={bet.optionB.imageUrl} width={70} height={70} style={{ objectFit: 'cover' }} />
                                    ) : (
                                        <span style={{ fontSize: 32, color: '#ef4444' }}>B</span>
                                    )}
                                </div>
                                <span style={{ fontSize: 12, fontWeight: 700, color: '#fff', marginTop: 6, opacity: 0.8 }}>
                                    {bet.optionB?.label?.slice(0, 12) || 'B'}
                                </span>
                            </div>
                        </div>

                        {/* Stats */}
                        <div style={{ display: 'flex', flexDirection: 'column', padding: '16px 24px', gap: '10px', backgroundColor: '#0a0a0a', borderTop: '1px solid #222' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span style={{ fontSize: 12, color: '#666' }}>TOTAL POT</span>
                                <span style={{ fontSize: 22, fontWeight: 900, color: '#22c55e' }}>{potDisplay}</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span style={{ fontSize: 12, color: '#666' }}>PREDICTORS</span>
                                <span style={{ fontSize: 18, fontWeight: 700, color: '#fff' }}>{bet.participantCount || 0}</span>
                            </div>
                        </div>

                        {/* Footer */}
                        <div style={{ display: 'flex', justifyContent: 'center', padding: '12px', backgroundColor: '#000' }}>
                            <span style={{ fontSize: 10, color: '#444' }}>ID: {battleId}</span>
                        </div>
                    </div>
                </div>
            ),
            { ...size }
        );
    }

    // ========================================
    // PREDICTION RECEIPT - White paper style
    // Matches ViralReceipt exactly
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
                    width: '420px',
                    backgroundColor: '#ffffff',
                    overflow: 'hidden',
                }}>
                    {/* Header */}
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '28px 24px 20px' }}>
                        <span style={{ fontSize: 32, fontWeight: 900, color: '#000', letterSpacing: '-1px' }}>PREDICTION CONFIRMED</span>
                        <span style={{ fontSize: 11, color: '#888', letterSpacing: '4px', marginTop: 4 }}>OFFICIAL RECEIPT</span>
                        <span style={{ fontSize: 10, color: '#aaa', marginTop: 4 }}>{timestamp}</span>
                    </div>

                    {/* Dashed line */}
                    <div style={{ width: '100%', height: 2, borderBottom: '2px dashed #ddd', margin: '0 0 16px' }} />

                    {/* Details */}
                    <div style={{ display: 'flex', flexDirection: 'column', padding: '0 28px', gap: '14px' }}>
                        {/* Player */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontSize: 13, fontWeight: 700, color: '#888' }}>PLAYER</span>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                {bet.pfpUrl && <img src={bet.pfpUrl} width={24} height={24} style={{ borderRadius: '50%' }} />}
                                <span style={{ fontSize: 16, fontWeight: 700, color: '#000' }}>@{bet.username}</span>
                            </div>
                        </div>

                        {/* Position - shows YES/NO with color */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontSize: 13, fontWeight: 700, color: '#888' }}>POSITION</span>
                            <span style={{ fontSize: 20, fontWeight: 900, color: '#ef4444' }}>BET NOW</span>
                        </div>

                        {/* Target */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontSize: 13, fontWeight: 700, color: '#888' }}>TARGET</span>
                            <span style={{ fontSize: 14, fontWeight: 700, color: '#000', textAlign: 'right', maxWidth: '200px' }}>
                                {targetLabel.slice(0, 30)}
                            </span>
                        </div>

                        {/* Dashed line */}
                        <div style={{ width: '100%', height: 2, borderBottom: '2px dashed #ddd' }} />

                        {/* Stake */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontSize: 13, fontWeight: 700, color: '#888' }}>TOTAL POT</span>
                            <span style={{ fontSize: 22, fontWeight: 700, color: '#000' }}>{potDisplay}</span>
                        </div>

                        {/* Potential Win / Predictors */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontSize: 13, fontWeight: 700, color: '#888' }}>PREDICTORS</span>
                            <span style={{ fontSize: 32, fontWeight: 900, color: '#FF5F1F' }}>{bet.participantCount || 0}</span>
                        </div>
                    </div>

                    {/* Black footer */}
                    <div style={{
                        display: 'flex', flexDirection: 'column', alignItems: 'center',
                        padding: '16px', marginTop: '20px', backgroundColor: '#000',
                    }}>
                        <span style={{ fontSize: 10, color: '#666' }}>BATTLE ID</span>
                        <span style={{ fontSize: 14, fontWeight: 700, color: '#fff', letterSpacing: '3px' }}>{battleId}</span>
                    </div>
                </div>
            </div>
        ),
        { ...size }
    );
}
