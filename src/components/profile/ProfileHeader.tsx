
import { Edit3, Copy, LogOut, Check } from 'lucide-react';
import { useState } from 'react';
import { useDisconnect } from 'wagmi';

interface ProfileHeaderProps {
    address: string;
    displayName: string;
    pfpUrl: string;
    onEdit: () => void;
    isLoading?: boolean;
}

export function ProfileHeader({ address, displayName, pfpUrl, onEdit, isLoading }: ProfileHeaderProps) {
    const { disconnect } = useDisconnect();
    const [copied, setCopied] = useState(false);

    const copyAddress = () => {
        navigator.clipboard.writeText(address);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <div className="flex flex-col items-center justify-center text-center space-y-4 mb-8">
            {/* Avatar with Ring */}
            <div className="relative group">
                <div className="w-24 h-24 md:w-32 md:h-32 rounded-full border-4 border-white/5 bg-black overflow-hidden shadow-2xl relative z-10">
                    {pfpUrl ? (
                        <img src={pfpUrl} alt="Profile" className="w-full h-full object-cover" />
                    ) : (
                        <div className="w-full h-full bg-gradient-to-br from-primary/20 to-purple-900/20 flex items-center justify-center text-3xl font-bold text-white/20">
                            {displayName ? displayName.charAt(0).toUpperCase() : address.substring(2, 4)}
                        </div>
                    )}
                </div>
                {/* Glow effect behind */}
                <div className="absolute inset-0 bg-primary/20 blur-3xl -z-10 rounded-full scale-150 opacity-0 group-hover:opacity-100 transition-opacity" />

                {/* Edit Badge */}
                <button
                    onClick={onEdit}
                    className="absolute bottom-0 right-0 bg-white text-black p-2 rounded-full shadow-lg hover:scale-110 transition-transform z-20"
                >
                    <Edit3 className="w-4 h-4" />
                </button>
            </div>

            {/* Name & Address */}
            <div className="space-y-1">
                <h1 className="text-2xl md:text-3xl font-black text-white tracking-tight">
                    {displayName || 'Anonymous Player'}
                </h1>
                <div
                    onClick={copyAddress}
                    className="flex items-center justify-center gap-2 text-white/40 hover:text-white cursor-pointer transition-colors text-sm font-mono tracking-wide"
                >
                    <span>{address.slice(0, 6)}...{address.slice(-4)}</span>
                    {copied ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3" />}
                </div>
            </div>

            {/* Disconnect Mobile */}
            <button
                onClick={() => disconnect()}
                className="md:hidden text-xs text-red-500/60 hover:text-red-500 uppercase font-bold tracking-widest pt-2"
            >
                Disconnect Wallet
            </button>
        </div>
    );
}
