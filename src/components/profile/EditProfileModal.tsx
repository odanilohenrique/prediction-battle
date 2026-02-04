
import { useState } from 'react';
import { Upload, X, Save } from 'lucide-react';
import { useModal } from '@/providers/ModalProvider';

interface EditProfileModalProps {
    isOpen: boolean;
    onClose: () => void;
    currentName: string;
    currentPfp: string;
    address: string;
    onSaveSuccess: () => void;
}

export function EditProfileModal({ isOpen, onClose, currentName, currentPfp, address, onSaveSuccess }: EditProfileModalProps) {
    const { showAlert } = useModal();
    const [name, setName] = useState(currentName);
    const [pfpUrl, setPfpUrl] = useState(currentPfp);
    const [tempPfpUrl, setTempPfpUrl] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const [mode, setMode] = useState<'url' | 'upload'>('url');

    if (!isOpen) return null;

    const handleSave = async () => {
        setIsSaving(true);
        try {
            const res = await fetch('/api/user', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    address,
                    displayName: name,
                    pfpUrl: pfpUrl
                })
            });
            const data = await res.json();
            if (data.success) {
                showAlert('Success', 'Profile updated!', 'success');
                onSaveSuccess();
                onClose();
            } else {
                throw new Error(data.error);
            }
        } catch (e) {
            showAlert('Error', 'Failed to save profile.', 'error');
        } finally {
            setIsSaving(false);
        }
    };

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            if (file.size > 1024 * 1024) return showAlert('Error', 'File too large (Max 1MB)', 'error');
            const reader = new FileReader();
            reader.onloadend = () => setPfpUrl(reader.result as string);
            reader.readAsDataURL(file);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />
            <div className="relative z-10 bg-[#0f0f0f] border border-white/10 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl animate-fade-in-up">

                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-white/5 bg-white/5">
                    <h3 className="text-lg font-bold text-white uppercase italic">Edit Profile</h3>
                    <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-lg transition-colors">
                        <X className="w-5 h-5 text-white/60" />
                    </button>
                </div>

                <div className="p-6 space-y-6">
                    {/* Avatar Preview */}
                    <div className="flex justify-center">
                        <img
                            src={pfpUrl || 'https://via.placeholder.com/150'}
                            alt="Preview"
                            className="w-24 h-24 rounded-full border-2 border-white/10 bg-black object-cover"
                        />
                    </div>

                    {/* Name Input */}
                    <div>
                        <label className="text-xs text-white/40 font-bold uppercase mb-2 block">Display Name</label>
                        <input
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            className="w-full bg-black border border-white/10 rounded-xl px-4 py-3 text-white focus:border-primary outline-none text-sm font-bold"
                            placeholder="Your Name"
                        />
                    </div>

                    {/* Image Input Options */}
                    <div>
                        <label className="text-xs text-white/40 font-bold uppercase mb-2 block">Avatar Source</label>
                        <div className="flex gap-2 mb-3">
                            <button
                                onClick={() => setMode('url')}
                                className={`flex-1 py-2 text-xs font-bold uppercase rounded-lg transition-colors border ${mode === 'url' ? 'bg-primary/20 border-primary text-primary' : 'bg-white/5 border-transparent text-white/40'}`}
                            >
                                Valid URL
                            </button>
                            <button
                                onClick={() => setMode('upload')}
                                className={`flex-1 py-2 text-xs font-bold uppercase rounded-lg transition-colors border ${mode === 'upload' ? 'bg-primary/20 border-primary text-primary' : 'bg-white/5 border-transparent text-white/40'}`}
                            >
                                Upload
                            </button>
                        </div>

                        {mode === 'url' ? (
                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    value={tempPfpUrl}
                                    onChange={(e) => setTempPfpUrl(e.target.value)}
                                    placeholder="https://imgur.com/..."
                                    className="flex-1 bg-black border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:border-primary outline-none"
                                />
                                <button
                                    onClick={() => { setPfpUrl(tempPfpUrl); setTempPfpUrl(''); }}
                                    className="bg-white/10 hover:bg-white/20 text-white px-3 rounded-lg text-xs font-bold uppercase"
                                >
                                    Set
                                </button>
                            </div>
                        ) : (
                            <label className="flex flex-col items-center justify-center w-full h-20 border-2 border-dashed border-white/10 rounded-xl hover:bg-white/5 cursor-pointer">
                                <Upload className="w-5 h-5 text-white/20 mb-1" />
                                <span className="text-[10px] text-white/40 font-bold uppercase">Click to browse</span>
                                <input type="file" onChange={handleFileUpload} className="hidden" accept="image/*" />
                            </label>
                        )}
                    </div>
                </div>

                <div className="p-4 border-t border-white/5 bg-black/20 flex gap-3">
                    <button onClick={onClose} className="flex-1 py-3 bg-white/5 hover:bg-white/10 text-white font-bold rounded-xl text-sm uppercase transition-colors">
                        Cancel
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={isSaving}
                        className="flex-1 py-3 bg-primary hover:brightness-110 text-black font-bold rounded-xl text-sm uppercase transition-colors flex items-center justify-center gap-2"
                    >
                        {isSaving && <div className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />}
                        Save Changes
                    </button>
                </div>
            </div>
        </div>
    );
}
