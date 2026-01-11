
import { ImageResponse } from 'next/og';
import { store } from '@/lib/store';

// Force Node.js runtime for best compatibility with Prisma/Postgres/Redis pools if widely used
// but here we are using HTTP REST or simple KV. Node is safer.
export const runtime = 'nodejs';

export const alt = 'Prediction Battle Ticket';
export const size = {
    width: 1200,
    height: 630,
};

export const contentType = 'image/png';

export default async function Image({ params }: { params: { id: string } }) {
    let bet: any = null;

    try {
        // Attempt fetch
        bet = await store.getBet(params.id);
        console.log(`[OG] Fetched bet ${params.id}:`, bet ? 'Found' : 'Null');
    } catch (e) {
        console.error('[OG] Image Store Fetch Error:', e);
    }

    // FALLBACK IF DATA MISSING (Prevents Broken Image Icon)
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
                        backgroundColor: '#111',
                        color: 'white',
                        fontFamily: 'sans-serif',
                    }}
                >
                    <div style={{ fontSize: 60, fontWeight: 900, marginBottom: 20 }}>PREDICTION BATTLE</div>
                    <div style={{ fontSize: 30, color: '#888' }}>View Battle Details</div>
                </div>
            ),
            { ...size }
        );
    }

    const isVersus = bet.isVersus;
    const choice = bet.participants?.yes?.find((p: any) => p.userId === bet.creatorAddress) ? 'YES' : 'NO';

    // Time helper
    const formatTimeLeft = (expiresAt: number) => {
        const now = Date.now();
        const diff = expiresAt - now;
        if (diff <= 0) return 'ENDED';
        const hours = Math.floor(diff / (1000 * 60 * 60));
        if (hours > 24) return Math.floor(hours / 24) + 'd';
        return hours + 'h';
    };

    // --- BATTLE TICKET DESIGN ---
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
                        backgroundColor: '#09090b', // Zinc 950
                        fontFamily: 'sans-serif',
                    }}
                >
                    {/* Background Noise/Effect */}
                    <div style={{
                        position: 'absolute',
                        top: 0, left: 0, right: 0, bottom: 0,
                        backgroundImage: 'radial-gradient(circle at 25px 25px, rgba(255, 255, 255, 0.1) 2%, transparent 0%)',
                        backgroundSize: '50px 50px',
                    }} />

                    {/* Ticket Container */}
                    <div style={{
                        display: 'flex',
                        flexDirection: 'column',
                        width: '900px',
                        backgroundColor: '#000',
                        border: '2px solid #333',
                        borderRadius: '24px',
                        overflow: 'hidden',
                        boxShadow: '0 20px 60px rgba(0,0,0,0.7)',
                    }}>
                        {/* Header */}
                        <div style={{
                            display: 'flex',
                            width: '100%',
                            height: '80px',
                            background: 'linear-gradient(90deg, #dc2626 0%, #ea580c 100%)', // Red to Orange
                            alignItems: 'center',
                            justifyContent: 'center',
                        }}>
                            <span style={{
                                color: 'white',
                                fontSize: 40,
                                fontWeight: 900,
                                textTransform: 'uppercase',
                                letterSpacing: '4px',
                            }}>FIGHT TICKET</span>
                        </div>

                        {/* Content */}
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '40px' }}>
                            {/* Matchup */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '40px', marginBottom: '30px' }}>
                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                    <div style={{ width: '120px', height: '120px', borderRadius: '20px', backgroundColor: '#333', border: '4px solid #fff', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                        <span style={{ fontSize: 60 }}>🅰️</span>
                                    </div>
                                    <span style={{ color: 'white', marginTop: '10px', fontSize: 24, fontWeight: 'bold' }}>{bet.optionA?.label || 'SIDE A'}</span>
                                </div>

                                <span style={{ fontSize: 60, fontStyle: 'italic', fontWeight: 900, color: '#444' }}>VS</span>

                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                    <div style={{ width: '120px', height: '120px', borderRadius: '20px', backgroundColor: '#333', border: '4px solid #fff', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                        <span style={{ fontSize: 60 }}>🅱️</span>
                                    </div>
                                    <span style={{ color: 'white', marginTop: '10px', fontSize: 24, fontWeight: 'bold' }}>{bet.optionB?.label || 'SIDE B'}</span>
                                </div>
                            </div>

                            {/* Pot */}
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginTop: '20px' }}>
                                <span style={{ color: '#888', fontSize: 20, letterSpacing: '2px', textTransform: 'uppercase' }}>Total Pot</span>
                                <span style={{ color: '#22c55e', fontSize: 60, fontWeight: 900 }}>${bet.totalPot?.toFixed(2) || '0.00'}</span>
                            </div>
                        </div>

                        {/* Footer */}
                        <div style={{
                            display: 'flex',
                            width: '100%',
                            padding: '20px',
                            backgroundColor: '#111',
                            borderTop: '1px solid #333',
                            justifyContent: 'center'
                        }}>
                            <span style={{ color: '#666', fontFamily: 'monospace', fontSize: 20 }}>BATTLE ID: {bet.id.split('_')[1] || 'UNKNOWN'}</span>
                        </div>
                    </div>
                </div>
            ),
            { ...size }
        );
    }

    // --- STANDARD RECEIPT DESIGN ---
    return new ImageResponse(
        (
            <div
                style={{
                    height: '100%',
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: 'rgba(0,0,0,0.8)', // Dark overlay background
                    fontFamily: 'monospace', // Receipt font
                }}
            >
                {/* Receipt Paper */}
                <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    width: '600px',
                    backgroundColor: 'white',
                    padding: '40px',
                    position: 'relative',
                    boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
                }}>
                    {/* Top Decoration */}
                    <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '20px', borderBottom: '2px dashed #ccc', paddingBottom: '20px' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
                            <span style={{ fontSize: 48, fontWeight: 900, textTransform: 'uppercase', marginBottom: '8px' }}>PREDICTION</span>
                            <span style={{ fontSize: 24, letterSpacing: '4px', color: '#666' }}>OFFICIAL RECEIPT</span>
                        </div>
                    </div>

                    {/* Content */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                        {/* Player */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                            <span style={{ color: '#888', fontSize: 24, textTransform: 'uppercase' }}>PLAYER</span>
                            <span style={{ fontSize: 32, fontWeight: 'bold' }}>@{bet.username}</span>
                        </div>

                        {/* Target */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ color: '#888', fontSize: 24, textTransform: 'uppercase' }}>TARGET</span>
                            <span style={{ fontSize: 28, fontWeight: 'bold', maxWidth: '300px', textAlign: 'right', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                {bet.target || bet.targetValue} {bet.type || 'EVENT'}
                            </span>
                        </div>

                        {/* Status/Deadline */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                            <span style={{ color: '#888', fontSize: 24, textTransform: 'uppercase' }}>DEADLINE</span>
                            <span style={{ fontSize: 28, fontWeight: 'bold' }}>
                                {formatTimeLeft(bet.expiresAt)}
                            </span>
                        </div>

                        <div style={{ width: '100%', height: '2px', backgroundColor: '#ddd', margin: '20px 0' }} />

                        {/* Financials */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: '10px' }}>
                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                                <span style={{ color: '#888', fontSize: 20, textTransform: 'uppercase' }}>TOTAL POT</span>
                                <span style={{ fontSize: 48, fontWeight: 900 }}>${bet.totalPot?.toFixed(2) || '0.00'}</span>
                            </div>

                            {/* CTA Fake Button */}
                            <div style={{
                                padding: '10px 20px',
                                backgroundColor: '#000',
                                color: 'white',
                                fontSize: 24,
                                fontWeight: 'bold',
                                borderRadius: '8px'
                            }}>
                                BET NOW
                            </div>
                        </div>
                    </div>

                    {/* Footer */}
                    <div style={{ marginTop: '40px', borderTop: '2px dashed #ccc', paddingTop: '20px', textAlign: 'center' }}>
                        <span style={{ color: '#aaa', fontSize: 16 }}>ID: {bet.id.toUpperCase()}</span>
                    </div>

                </div>
            </div>
        ),
        {
            ...size,
        }
    );
}
