'use client';

import { useEffect, useState } from 'react';
import { X, CheckCircle2, AlertTriangle, Info, AlertOctagon } from 'lucide-react';

export type ModalType = 'success' | 'error' | 'warning' | 'info' | 'confirm';

interface CustomModalProps {
    isOpen: boolean;
    type: ModalType;
    title: string;
    message: string;
    onConfirm?: () => void;
    onCancel?: () => void;
    confirmText?: string;
    cancelText?: string;
}

export default function CustomModal({
    isOpen,
    type,
    title,
    message,
    onConfirm,
    onCancel,
    confirmText = 'Confirm',
    cancelText = 'Cancel'
}: CustomModalProps) {
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        if (isOpen) {
            setIsVisible(true);
        } else {
            const timer = setTimeout(() => setIsVisible(false), 300);
            return () => clearTimeout(timer);
        }
    }, [isOpen]);

    if (!isVisible) return null;

    const isCurrentOpen = isOpen; // For animation logic

    // Styles based on type
    const styles = {
        success: {
            icon: <CheckCircle2 className="w-12 h-12 text-green-400" />,
            border: 'border-green-500/30',
            glow: 'shadow-green-500/20',
            button: 'bg-green-500 hover:bg-green-600'
        },
        error: {
            icon: <AlertOctagon className="w-12 h-12 text-red-500" />,
            border: 'border-red-500/30',
            glow: 'shadow-red-500/20',
            button: 'bg-red-500 hover:bg-red-600'
        },
        warning: {
            icon: <AlertTriangle className="w-12 h-12 text-yellow-400" />,
            border: 'border-yellow-500/30',
            glow: 'shadow-yellow-500/20',
            button: 'bg-yellow-500 hover:bg-yellow-600'
        },
        info: {
            icon: <Info className="w-12 h-12 text-blue-400" />,
            border: 'border-blue-500/30',
            glow: 'shadow-blue-500/20',
            button: 'bg-blue-500 hover:bg-blue-600'
        },
        confirm: {
            icon: <Info className="w-12 h-12 text-primary" />,
            border: 'border-primary/30',
            glow: 'shadow-primary/20',
            button: 'bg-primary hover:bg-primary/80'
        }
    };

    const style = styles[type];

    return (
        <div className={`fixed inset-0 z-[100] flex items-center justify-center p-4 transition-all duration-300 ${isCurrentOpen ? 'opacity-100 backdrop-blur-md' : 'opacity-0 backdrop-blur-none pointer-events-none'}`}>
            {/* Backdrop */}
            <div 
                className="absolute inset-0 bg-black/60" 
                onClick={type === 'confirm' ? undefined : onCancel}
            />

            {/* Modal Content */}
            <div 
                className={`
                    relative w-full max-w-md bg-[#0a0a0a] rounded-2xl border ${style.border} 
                    shadow-2xl ${style.glow} p-6 transform transition-all duration-300 
                    ${isCurrentOpen ? 'scale-100 translate-y-0' : 'scale-95 translate-y-4'}
                `}
            >
                {/* Close Button (if not confirm, or always?) */}
                {!['info', 'success', 'error'].includes(type) && (
                    <button 
                        onClick={onCancel}
                        className="absolute top-4 right-4 text-white/20 hover:text-white transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                )}

                <div className="flex flex-col items-center text-center space-y-4">
                    {/* Icon Circle */}
                    <div className={`p-4 rounded-full bg-white/5 border border-white/5 shadow-inner`}>
                        {style.icon}
                    </div>

                    <div className="space-y-2">
                        <h3 className="text-xl font-black text-white uppercase tracking-wider">
                            {title}
                        </h3>
                        <p className="text-white/60 text-sm leading-relaxed">
                            {message}
                        </p>
                    </div>

                    <div className="flex gap-3 w-full pt-2">
                        {type === 'confirm' && (
                            <button
                                onClick={onCancel}
                                className="flex-1 py-3 rounded-xl font-bold text-white/60 hover:text-white hover:bg-white/5 transition-all text-sm uppercase tracking-wide border border-transparent hover:border-white/10"
                            >
                                {cancelText}
                            </button>
                        )}
                        
                        <button
                            onClick={onConfirm}
                            className={`flex-1 py-3 rounded-xl font-bold text-white transition-all transform active:scale-95 text-sm uppercase tracking-wide shadow-lg ${style.button}`}
                        >
                            {confirmText}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
