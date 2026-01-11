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

export default async function Image({ params }: { params: { id: string } }) {
    const bet = await fetchBet(params.id);

    if (!bet) {
        return new ImageResponse(
            (
                <div style={{
                    height: '100%', width: '100%', display: 'flex', flexDirection: 'column',
                    alignItems: 'center', justifyContent: 'center', backgroundColor: '#0a0a0a',
                }}>
                    <span style={{ fontSize: 48, fontWeight: 900, color: '#FF5F1F' }}>PREDICTION BATTLE</span>
                </div>
            ),
            { ...size }
        );
    }

    const isBattle = !!(bet.optionA?.label && bet.optionB?.label);
    const timestamp = new Date().toLocaleString('en-US').toUpperCase();
    const battleId = (bet.id?.split('_')[1] || '').toUpperCase().slice(0, 9);
    const targetLabel = bet.castText || `get ${bet.target || 0}+ ${bet.type || 'likes'}`;
    const potDisplay = `$${(bet.totalPot || 0).toFixed(2)}`;

    // =====================================================
    // BATTLE TICKET - Exact replica of ViralReceipt battle
    // =====================================================
    if (isBattle) {
        return new ImageResponse(
            (
                <div style={{
                    height: '100%', width: '100%', display: 'flex',
                    alignItems: 'center', justifyContent: 'center', backgroundColor: '#000',
                }}>
                    <div style={{
                        display: 'flex', flexDirection: 'column', width: '420px',
                        backgroundColor: '#0f0f0f', borderRadius: '24px', border: '1px solid #222',
                        overflow: 'hidden',
                    }}>
                        {/* RED HEADER */}
                        <div style={{
                            display: 'flex', flexDirection: 'column', alignItems: 'center',
                            padding: '16px', backgroundColor: '#dc2626',
                        }}>
                            <span style={{ fontSize: 24, fontWeight: 900, color: '#fff', fontStyle: 'italic' }}>
                                FIGHT TICKET
                            </span>
                            <span style={{ fontSize: 10, color: '#fff', opacity: 0.8, letterSpacing: '3px' }}>
                                OFFICIAL ENTRY
                            </span>
                        </div>

                        {/* PREDICTION PHRASE */}
                        <div style={{ display: 'flex', justifyContent: 'center', padding: '16px 20px 8px' }}>
                            <span style={{ fontSize: 16, fontWeight: 700, color: '#fff', fontStyle: 'italic', textAlign: 'center' }}>
                                "{targetLabel.slice(0, 50)}"
                            </span>
                        </div>

                        {/* VS SECTION */}
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 24px', gap: '16px' }}>
                            {/* Fighter A */}
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                                <div style={{
                                    width: 80, height: 80, backgroundColor: '#1a1a1a', borderRadius: '16px',
                                    border: '2px solid #333', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    overflow: 'hidden',
                                }}>
                                    {bet.optionA?.imageUrl ? (
                                        <img src={bet.optionA.imageUrl} width={80} height={80} style={{ objectFit: 'cover' }} />
                                    ) : (
                                        <span style={{ fontSize: 32, color: '#22c55e' }}>A</span>
                                    )}
                                </div>
                                <span style={{ fontSize: 10, fontWeight: 700, color: '#fff', opacity: 0.8, maxWidth: '70px', textAlign: 'center' }}>
                                    {(bet.optionA?.label || 'A').slice(0, 12)}
                                </span>
                            </div>

                            {/* VS */}
                            <span style={{ fontSize: 32, fontWeight: 900, color: '#333', fontStyle: 'italic' }}>VS</span>

                            {/* Fighter B */}
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                                <div style={{
                                    width: 80, height: 80, backgroundColor: '#1a1a1a', borderRadius: '16px',
                                    border: '2px solid #333', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    overflow: 'hidden',
                                }}>
                                    {bet.optionB?.imageUrl ? (
                                        <img src={bet.optionB.imageUrl} width={80} height={80} style={{ objectFit: 'cover' }} />
                                    ) : (
                                        <span style={{ fontSize: 32, color: '#ef4444' }}>B</span>
                                    )}
                                </div>
                                <span style={{ fontSize: 10, fontWeight: 700, color: '#fff', opacity: 0.8, maxWidth: '70px', textAlign: 'center' }}>
                                    {(bet.optionB?.label || 'B').slice(0, 12)}
                                </span>
                            </div>
                        </div>

                        {/* DETAILS SECTION */}
                        <div style={{ display: 'flex', flexDirection: 'column', padding: '16px 20px', backgroundColor: '#0a0a0a', borderTop: '1px solid #222', gap: '12px' }}>
                            {/* Total Pot Row */}
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span style={{ fontSize: 10, color: '#666', letterSpacing: '2px' }}>TOTAL POT</span>
                                <span style={{ fontSize: 20, fontWeight: 900, color: '#22c55e' }}>{potDisplay}</span>
                            </div>
                            {/* Predictors Row */}
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span style={{ fontSize: 10, color: '#666', letterSpacing: '2px' }}>PREDICTORS</span>
                                <span style={{ fontSize: 16, fontWeight: 700, color: '#fff' }}>{bet.participantCount || 0}</span>
                            </div>
                        </div>

                        {/* FOOTER */}
                        <div style={{ display: 'flex', justifyContent: 'center', padding: '12px', backgroundColor: '#000' }}>
                            <span style={{ fontSize: 10, color: '#333', letterSpacing: '2px' }}>ID: {battleId}</span>
                        </div>
                    </div>
                </div>
            ),
            { ...size }
        );
    }

    // =====================================================
    // PREDICTION RECEIPT - Exact replica of ViralReceipt
    // =====================================================
    return new ImageResponse(
        (
            <div style={{
                height: '100%', width: '100%', display: 'flex',
                alignItems: 'center', justifyContent: 'center', backgroundColor: '#000',
            }}>
                <div style={{
                    display: 'flex', flexDirection: 'column', width: '380px',
                    backgroundColor: '#fff', overflow: 'hidden',
                }}>
                    {/* HEADER */}
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '24px 20px 16px' }}>
                        <span style={{ fontSize: 28, fontWeight: 900, color: '#000', letterSpacing: '-1px' }}>
                            PREDICTION CONFIRMED
                        </span>
                        <span style={{ fontSize: 10, color: '#888', letterSpacing: '3px', marginTop: 4 }}>
                            OFFICIAL RECEIPT
                        </span>
                        <span style={{ fontSize: 10, color: '#aaa', marginTop: 4 }}>
                            {timestamp}
                        </span>
                    </div>

                    {/* DASHED LINE */}
                    <div style={{ width: '100%', height: 2, borderBottom: '2px dashed #ddd' }} />

                    {/* DETAILS */}
                    <div style={{ display: 'flex', flexDirection: 'column', padding: '16px 24px', gap: '12px' }}>
                        {/* Player */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontSize: 12, fontWeight: 700, color: '#888' }}>PLAYER</span>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                {bet.pfpUrl && <img src={bet.pfpUrl} width={24} height={24} style={{ borderRadius: '50%' }} />}
                                <span style={{ fontSize: 14, fontWeight: 700, color: '#000' }}>@{bet.username}</span>
                            </div>
                        </div>

                        {/* Position */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontSize: 12, fontWeight: 700, color: '#888' }}>POSITION</span>
                            <span style={{ fontSize: 18, fontWeight: 900, color: '#22c55e' }}>YES / NO</span>
                        </div>

                        {/* Target */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontSize: 12, fontWeight: 700, color: '#888' }}>TARGET</span>
                            <span style={{ fontSize: 12, fontWeight: 700, color: '#000', textAlign: 'right', maxWidth: '180px' }}>
                                {targetLabel.slice(0, 35)}
                            </span>
                        </div>

                        {/* DASHED LINE */}
                        <div style={{ width: '100%', height: 2, borderBottom: '2px dashed #ddd', margin: '4px 0' }} />

                        {/* Total Pot */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontSize: 12, fontWeight: 700, color: '#888' }}>TOTAL POT</span>
                            <span style={{ fontSize: 20, fontWeight: 700, color: '#000' }}>{potDisplay}</span>
                        </div>

                        {/* Predictors (like Potential Win) */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontSize: 12, fontWeight: 700, color: '#888' }}>PREDICTORS</span>
                            <span style={{ fontSize: 28, fontWeight: 900, color: '#FF5F1F' }}>{bet.participantCount || 0}</span>
                        </div>
                    </div>

                    {/* BLACK FOOTER */}
                    <div style={{
                        display: 'flex', flexDirection: 'column', alignItems: 'center',
                        padding: '16px', backgroundColor: '#000', marginTop: '8px',
                    }}>
                        <span style={{ fontSize: 10, color: '#666' }}>BATTLE ID</span>
                        <span style={{ fontSize: 12, fontWeight: 700, color: '#fff', letterSpacing: '2px' }}>{battleId}</span>
                    </div>
                </div>
            </div>
        ),
        { ...size }
    );
}
