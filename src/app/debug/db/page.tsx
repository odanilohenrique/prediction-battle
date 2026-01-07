'use client';

import { useState, useEffect } from 'react';
import { ExternalLink, RefreshCw } from 'lucide-react';

export default function DebugDBPage() {
    const [data, setData] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [envInfo, setEnvInfo] = useState('');

    useEffect(() => {
        fetchDebugData();
    }, []);

    async function fetchDebugData() {
        setLoading(true);
        try {
            // Fetch from a new API route we'll create that returns raw KV data
            const res = await fetch(`/api/debug/db-dump?t=${Date.now()}`);
            const json = await res.json();
            setData(json);
            setEnvInfo(json.envHash || 'Unknown');
        } catch (e: any) {
            setError(e.message);
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="p-8 text-white font-mono text-sm max-w-6xl mx-auto space-y-6">
            <h1 className="text-2xl font-bold flex items-center gap-2 text-red-500">
                ⚠️ Production Database Debugger
            </h1>
            <p className="text-white/60">
                This page reveals the raw state of the Vercel KV store connected to this specific deployment.
            </p>

            <button
                onClick={fetchDebugData}
                className="bg-white/10 hover:bg-white/20 px-4 py-2 rounded flex items-center gap-2"
            >
                <RefreshCw className="w-4 h-4" /> Refresh Data
            </button>

            {loading && <p className="animate-pulse">Loading raw DB data...</p>}
            {error && <div className="p-4 bg-red-500/20 text-red-400 border border-red-500 rounded">{error}</div>}

            {data && (
                <div className="space-y-6">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="bg-black/40 p-4 rounded border border-white/10">
                            <h3 className="uppercase text-white/40 text-xs font-bold mb-2">Environment</h3>
                            <div>KV URL Hash: <span className="text-blue-400">{envInfo}</span></div>
                            <div>Total Bets Found: <span className="text-green-400">{data.totalBets}</span></div>
                        </div>
                    </div>

                    <div>
                        <h3 className="text-lg font-bold mb-2 text-green-400">✅ Active Bets (Status: 'active')</h3>
                        {data.activeBets.length === 0 ? <p className="text-white/30 italic">No active bets found.</p> : (
                            <div className="space-y-2">
                                {data.activeBets.map((b: any) => (
                                    <div key={b.id} className="bg-green-500/10 border border-green-500/30 p-2 rounded">
                                        <div className="font-bold">{b.id}</div>
                                        <div>Type: {b.type} | Target: {b.target} | User: @{b.username}</div>
                                        <div className="text-xs text-white/50">Expires: {new Date(b.expiresAt).toLocaleString()}</div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    <div>
                        <h3 className="text-lg font-bold mb-2 text-yellow-400">⏸️ Other Bets (Completed/Resolved)</h3>
                        <div className="max-h-96 overflow-y-auto space-y-2 border border-white/5 p-2 rounded">
                            {data.otherBets.map((b: any) => (
                                <div key={b.id} className="bg-white/5 p-2 rounded opacity-60">
                                    <div>{b.id}</div>
                                    <div className="text-xs">Status: {b.status} | Result: {b.result || 'Pending'}</div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
