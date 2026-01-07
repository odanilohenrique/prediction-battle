'use client';

import { X, CheckCircle, AlertTriangle, PlayCircle } from 'lucide-react';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

interface ModalProps {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    description?: string;
    type?: 'success' | 'error' | 'warning' | 'info';
    confirmLabel?: string;
    onConfirm?: () => void;
    showCancel?: boolean;
    children?: React.ReactNode;
}

export default function Modal({
    isOpen,
    onClose,
    title,
    description,
    type = 'info',
    confirmLabel = 'OK',
    onConfirm,
    showCancel = false,
    children
}: ModalProps) {
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
        if (isOpen) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = 'unset';
        }
        return () => {
            document.body.style.overflow = 'unset';
        };
    }, [isOpen]);

    if (!mounted || !isOpen) return null;

    const getIcon = () => {
        switch (type) {
            case 'success': return <CheckCircle className="w-12 h-12 text-green-500 mb-4" />;
            case 'error': return <AlertTriangle className="w-12 h-12 text-red-500 mb-4" />;
            case 'warning': return <AlertTriangle className="w-12 h-12 text-yellow-500 mb-4" />;
            default: return <PlayCircle className="w-12 h-12 text-primary mb-4" />;
        }
    };

    const modalContent = (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
            <div className="bg-surface border border-white/10 rounded-3xl max-w-md w-full p-6 shadow-2xl relative overflow-hidden animate-scale-up">
                {/* Glow Effect */}
                <div className={`absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-transparent via-${type === 'error' ? 'red' : 'primary'}-500 to-transparent opacity-50`} />

                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 text-white/40 hover:text-white transition-colors"
                >
                    <X className="w-5 h-5" />
                </button>

                <div className="flex flex-col items-center text-center">
                    {getIcon()}
                    <h3 className="text-2xl font-black text-white italic uppercase tracking-wide mb-2">
                        {title}
                    </h3>
                    {description && (
                        <p className="text-textSecondary mb-6">
                            {description}
                        </p>
                    )}

                    {children}

                    <div className="flex gap-3 w-full mt-2">
                        {showCancel && (
                            <button
                                onClick={onClose}
                                className="flex-1 py-3 rounded-xl border border-white/10 text-white/60 font-bold hover:bg-white/5 transition-colors"
                            >
                                Cancel
                            </button>
                        )}
                        <button
                            onClick={() => {
                                if (onConfirm) onConfirm();
                                onClose();
                            }}
                            className={`flex-1 py-3 rounded-xl font-bold text-black transition-transform hover:scale-[1.02] active:scale-[0.98] ${type === 'error' ? 'bg-red-500 hover:bg-red-400' :
                                    type === 'success' ? 'bg-green-500 hover:bg-green-400' :
                                        'bg-primary hover:bg-white'
                                }`}
                        >
                            {confirmLabel}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );

    return createPortal(modalContent, document.body);
}
