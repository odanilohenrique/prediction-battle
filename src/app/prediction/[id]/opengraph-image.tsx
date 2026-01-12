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
                    alignItems: 'center', justifyContent: 'center', backgroundColor: '#0f0f0f',
                }}>
                    <span style={{ fontSize: 72, fontWeight: 900, color: '#FF5F1F' }}>PREDICTION BATTLE</span>
                    <span style={{ fontSize: 32, color: '#666', marginTop: 20 }}>Join the Arena</span>
                </div>
            ),
            { ...size }
        );
    }

    const isBattle = !!(bet.optionA?.label && bet.optionB?.label);
    const battleId = (bet.id?.split('_')[1] || '').toUpperCase().slice(0, 12);
    const targetLabel = bet.castText || `get ${bet.target || 0}+ ${bet.type || 'likes'}`;
    const potDisplay = `$${(bet.totalPot || 0).toFixed(2)}`;

    // =====================================================
    // BATTLE TICKET - FULL WIDTH DESIGN
    // =====================================================
    if (isBattle) {
        return new ImageResponse(
            (
                <div style={{
                    height: '100%', width: '100%', display: 'flex', flexDirection: 'column',
                    backgroundColor: '#0f0f0f',
                }}>
                    {/* RED HEADER - Full width */}
                    <div style={{
                        display: 'flex', flexDirection: 'column', alignItems: 'center',
                        justifyContent: 'center', padding: '32px', backgroundColor: '#dc2626',
                        width: '100%',
                    }}>
                        <span style={{ fontSize: 48, fontWeight: 900, color: '#fff', fontStyle: 'italic', letterSpacing: '-1px' }}>
                            FIGHT TICKET
                        </span>
                        <span style={{ fontSize: 18, color: '#fff', opacity: 0.9, letterSpacing: '8px', marginTop: 8 }}>
                            OFFICIAL ENTRY
                        </span>
                    </div>

                    {/* PREDICTION PHRASE */}
                    <div style={{ display: 'flex', justifyContent: 'center', padding: '24px 60px', width: '100%' }}>
                        <span style={{ fontSize: 28, fontWeight: 700, color: '#fff', fontStyle: 'italic', textAlign: 'center' }}>
                            "{targetLabel}"
                        </span>
                    </div>

                    {/* VS SECTION - Main content area */}
                    <div style={{
                        display: 'flex', flex: 1, alignItems: 'center', justifyContent: 'center',
                        padding: '20px 80px', gap: '60px', width: '100%',
                    }}>
                        {/* Fighter A */}
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
                            <div style={{
                                width: 180, height: 180, backgroundColor: '#1a1a1a', borderRadius: '24px',
                                border: '4px solid #22c55e', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                overflow: 'hidden',
                            }}>
                                {bet.optionA?.imageUrl ? (
                                    <img src={bet.optionA.imageUrl} width={180} height={180} style={{ objectFit: 'cover' }} />
                                ) : (
                                    <span style={{ fontSize: 72, color: '#22c55e' }}>A</span>
                                )}
                            </div>
                            <span style={{ fontSize: 24, fontWeight: 900, color: '#22c55e', textAlign: 'center', maxWidth: '200px' }}>
                                {(bet.optionA?.label || 'PLAYER A').toUpperCase()}
                            </span>
                        </div>

                        {/* VS */}
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                            <span style={{ fontSize: 80, fontWeight: 900, color: '#333', fontStyle: 'italic' }}>VS</span>
                        </div>

                        {/* Fighter B */}
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
                            <div style={{
                                width: 180, height: 180, backgroundColor: '#1a1a1a', borderRadius: '24px',
                                border: '4px solid #ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                overflow: 'hidden',
                            }}>
                                {bet.optionB?.imageUrl ? (
                                    <img src={bet.optionB.imageUrl} width={180} height={180} style={{ objectFit: 'cover' }} />
                                ) : (
                                    <span style={{ fontSize: 72, color: '#ef4444' }}>B</span>
                                )}
                            </div>
                            <span style={{ fontSize: 24, fontWeight: 900, color: '#ef4444', textAlign: 'center', maxWidth: '200px' }}>
                                {(bet.optionB?.label || 'PLAYER B').toUpperCase()}
                            </span>
                        </div>
                    </div>

                    {/* BOTTOM BAR - Stats */}
                    <div style={{
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        padding: '24px 80px', backgroundColor: '#0a0a0a', borderTop: '2px solid #222', width: '100%',
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <span style={{ fontSize: 18, color: '#666' }}>TOTAL POT</span>
                            <span style={{ fontSize: 40, fontWeight: 900, color: '#22c55e' }}>{potDisplay}</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <span style={{ fontSize: 18, color: '#666' }}>PREDICTORS</span>
                            <span style={{ fontSize: 40, fontWeight: 900, color: '#fff' }}>{bet.participantCount || 0}</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ fontSize: 14, color: '#444' }}>ID: {battleId}</span>
                        </div>
                    </div>
                </div>
            ),
            { ...size }
        );
    }

    // =====================================================
    // PREDICTION - FULL WIDTH FUN DESIGN
    // Avatar left, Title top, Details right
    // =====================================================
    return new ImageResponse(
        (
            <div style={{
                height: '100%', width: '100%', display: 'flex', flexDirection: 'column',
                backgroundColor: '#0f0f0f',
            }}>
                {/* ORANGE HEADER - Full width */}
                <div style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '24px 60px', backgroundColor: '#FF5F1F', width: '100%',
                }}>
                    <span style={{ fontSize: 40, fontWeight: 900, color: '#fff', letterSpacing: '-1px' }}>
                        PREDICTION BATTLE
                    </span>
                    <span style={{ fontSize: 18, color: '#fff', opacity: 0.9, letterSpacing: '4px' }}>
                        OFFICIAL RECEIPT
                    </span>
                </div>

                {/* MAIN CONTENT - Avatar left, Details right */}
                <div style={{
                    display: 'flex', flex: 1, padding: '40px 60px', gap: '60px', width: '100%',
                }}>
                    {/* LEFT SIDE - Large Avatar */}
                    <div style={{
                        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                        gap: '20px', width: '320px',
                    }}>
                        <div style={{
                            width: 220, height: 220, backgroundColor: '#1a1a1a', borderRadius: '32px',
                            border: '6px solid #FF5F1F', display: 'flex', alignItems: 'center', justifyContent: 'center',
                            overflow: 'hidden',
                        }}>
                            {bet.pfpUrl ? (
                                <img src={bet.pfpUrl} width={220} height={220} style={{ objectFit: 'cover' }} />
                            ) : (
                                <span style={{ fontSize: 80, color: '#FF5F1F' }}>@</span>
                            )}
                        </div>
                        <span style={{ fontSize: 36, fontWeight: 900, color: '#fff' }}>
                            @{bet.username}
                        </span>
                    </div>

                    {/* RIGHT SIDE - Details */}
                    <div style={{
                        display: 'flex', flexDirection: 'column', flex: 1, justifyContent: 'center', gap: '24px',
                    }}>
                        {/* Target/Question */}
                        <div style={{
                            display: 'flex', flexDirection: 'column', gap: '8px',
                            padding: '24px', backgroundColor: '#1a1a1a', borderRadius: '16px',
                            border: '2px solid #333',
                        }}>
                            <span style={{ fontSize: 16, color: '#666', letterSpacing: '2px' }}>PREDICTION TARGET</span>
                            <span style={{ fontSize: 28, fontWeight: 700, color: '#fff', lineHeight: 1.3 }}>
                                "{targetLabel}"
                            </span>
                        </div>

                        {/* Stats Row */}
                        <div style={{ display: 'flex', gap: '24px' }}>
                            {/* Total Pot */}
                            <div style={{
                                display: 'flex', flexDirection: 'column', alignItems: 'center',
                                flex: 1, padding: '24px', backgroundColor: '#22c55e', borderRadius: '16px',
                            }}>
                                <span style={{ fontSize: 16, color: '#fff', opacity: 0.9 }}>TOTAL POT</span>
                                <span style={{ fontSize: 48, fontWeight: 900, color: '#fff' }}>{potDisplay}</span>
                            </div>

                            {/* Predictors */}
                            <div style={{
                                display: 'flex', flexDirection: 'column', alignItems: 'center',
                                flex: 1, padding: '24px', backgroundColor: '#1a1a1a', borderRadius: '16px',
                                border: '2px solid #333',
                            }}>
                                <span style={{ fontSize: 16, color: '#888' }}>PREDICTORS</span>
                                <span style={{ fontSize: 48, fontWeight: 900, color: '#FF5F1F' }}>{bet.participantCount || 0}</span>
                            </div>
                        </div>

                        {/* Position Options */}
                        <div style={{ display: 'flex', gap: '24px' }}>
                            <div style={{
                                display: 'flex', flex: 1, alignItems: 'center', justifyContent: 'center',
                                padding: '16px', backgroundColor: '#22c55e', borderRadius: '12px',
                            }}>
                                <span style={{ fontSize: 28, fontWeight: 900, color: '#fff' }}>YES</span>
                            </div>
                            <div style={{
                                display: 'flex', flex: 1, alignItems: 'center', justifyContent: 'center',
                                padding: '16px', backgroundColor: '#ef4444', borderRadius: '12px',
                            }}>
                                <span style={{ fontSize: 28, fontWeight: 900, color: '#fff' }}>NO</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* BOTTOM BAR */}
                <div style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: '16px 60px', backgroundColor: '#000', width: '100%',
                }}>
                    <span style={{ fontSize: 20, fontWeight: 700, color: '#FF5F1F' }}>predictionbattle.xyz</span>
                    <span style={{ fontSize: 14, color: '#444' }}>ID: {battleId}</span>
                </div>
            </div>
        ),
        { ...size }
    );
}
