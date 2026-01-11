
import { ImageResponse } from 'next/og';
import { db } from '@vercel/kv'; // We need direct KV access or fetch api if store is not edge compatible
// store.ts uses 'no-store' which might be issue in edge. Let's see. 
// Standard fetch might be safer for Edge functions if store logic is heavy. 
// But ImageResponse runs on Edge. We'll try fetching data from API or direct KV rest.
// For simplicity and speed, we will fetch from the public API of the app itself or use a hardcoded KV fetch if possible.
// Actually, let's use the same store logic but we might need to be careful about environment.

export const runtime = 'edge';

export const alt = 'Prediction Battle Ticket';
export const size = {
    width: 1200,
    height: 630,
};

export const contentType = 'image/png';

export default async function Image({ params }: { params: { id: string } }) {
    // Fetch data
    // Since we are in Edge, we can't easily use the `store` if it relies on Node-specifics.
    // The `store.ts` imports `@vercel/kv` which supports Edge.
    // However, to avoid import issues, we'll fetch from our own API endpoint which is safe.
    // OR: Use fetch directly to KV REST API if envs are available.
    // BEST OPTION: Fetch the /api/predictions/list?id=... or similar? No, just use fetch() to the app URL? 
    // Circular dependency risk.

    // Let's try importing store. If it fails, we fix.
    // Actually, `@vercel/kv` SDK is edge ready.

    // Manual KV Fetch to be safe and lightweight
    const KV_REST_API_URL = process.env.KV_REST_API_URL;
    const KV_REST_API_TOKEN = process.env.KV_REST_API_TOKEN;

    let bet: any = null;

    if (KV_REST_API_URL && KV_REST_API_TOKEN) {
        try {
            const res = await fetch(`${KV_REST_API_URL}/hget/prediction_bets/${params.id}`, {
                headers: { Authorization: `Bearer ${KV_REST_API_TOKEN}` }
            });
            const json = await res.json();
            // result is { result: string_json }
            if (json.result) {
                bet = typeof json.result === 'string' ? JSON.parse(json.result) : json.result;
            }
        } catch (e) {
            console.error('OG Image Fetch Error', e);
        }
    }

    if (!bet) {
        return new ImageResponse(
            (
                <div
                    style={{
                        fontSize: 60,
                        background: 'black',
                        color: 'white',
                        width: '100%',
                        height: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                    }}
                >
                    Prediction Battle
                </div>
            ),
            { ...size }
        );
    }

    const isVersus = bet.isVersus;

    return new ImageResponse(
        (
            <div
                style={{
                    background: '#09090b', // Zinc-950
                    width: '100%',
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontFamily: 'sans-serif',
                    position: 'relative',
                    overflow: 'hidden',
                }}
            >
                {/* Background Grid Effect */}
                <div style={{
                    position: 'absolute', inset: 0,
                    backgroundImage: 'radial-gradient(circle at 25px 25px, rgba(255, 255, 255, 0.1) 2%, transparent 0%)',
                    backgroundSize: '50px 50px',
                }} />

                {/* Main Card Container */}
                <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    background: '#000000',
                    border: '2px solid #333',
                    borderRadius: 24,
                    padding: 40,
                    width: '80%',
                    boxShadow: '0 20px 50px rgba(0,0,0,0.5)',
                    position: 'relative',
                }}>
                    {/* Header */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
                        <div style={{ fontSize: 24, color: '#4ade80', fontWeight: 900, textTransform: 'uppercase', letterSpacing: 2 }}>
                            Prediction Battle
                        </div>
                    </div>

                    {/* Content */}
                    <div style={{ fontSize: 48, fontWeight: 'bold', color: 'white', textAlign: 'center', marginBottom: 30, lineHeight: 1.2 }}>
                        {isVersus
                            ? `${bet.optionA?.label || 'A'} VS ${bet.optionB?.label || 'B'}`
                            : (bet.castText || `Will @${bet.username} hit the target?`).substring(0, 80) + (bet.castText?.length > 80 ? '...' : '')
                        }
                    </div>

                    {/* Stats Row */}
                    <div style={{ display: 'flex', gap: 60, marginTop: 10 }}>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                            <span style={{ fontSize: 18, color: '#888' }}>Total Pot</span>
                            <span style={{ fontSize: 36, color: '#4ade80', fontWeight: 'bold' }}>${bet.totalPot || 0}</span>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                            <span style={{ fontSize: 18, color: '#888' }}>Target</span>
                            <span style={{ fontSize: 36, color: 'white', fontWeight: 'bold' }}>{bet.target || bet.targetValue}{bet.type === 'followers_gain' ? '+' : ''}</span>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                            <span style={{ fontSize: 18, color: '#888' }}>Ends In</span>
                            <span style={{ fontSize: 36, color: '#facc15', fontWeight: 'bold' }}>{formatTimeLeft(bet.expiresAt)}</span>
                        </div>
                    </div>

                    {/* Footer decoration */}
                    <div style={{
                        marginTop: 40,
                        background: '#22c55e',
                        color: 'black',
                        padding: '10px 30px',
                        borderRadius: 100,
                        fontSize: 20,
                        fontWeight: 'bold'
                    }}>
                        B E T &nbsp; N O W
                    </div>
                </div>
            </div>
        ),
        {
            ...size,
        }
    );
}

function formatTimeLeft(expiresAt: number) {
    const now = Date.now();
    const diff = expiresAt - now;
    if (diff <= 0) return 'ENDED';
    const hours = Math.floor(diff / (1000 * 60 * 60));
    if (hours > 24) return Math.floor(hours / 24) + 'd';
    return hours + 'h';
}
