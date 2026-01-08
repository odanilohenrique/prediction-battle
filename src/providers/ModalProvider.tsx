'use client';

import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import CustomModal, { ModalType } from '@/components/ui/CustomModal';

interface ModalOptions {
    type?: ModalType;
    title: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    onConfirm?: () => void;
    onCancel?: () => void;
}

interface ModalContextType {
    showModal: (options: ModalOptions) => void;
    closeModal: () => void;
    // Shortcuts
    showAlert: (title: string, message: string, type?: ModalType) => void;
    showConfirm: (title: string, message: string, onConfirm: () => void) => void;
}

const ModalContext = createContext<ModalContextType | undefined>(undefined);

export function ModalProvider({ children }: { children: ReactNode }) {
    const [isOpen, setIsOpen] = useState(false);
    const [config, setConfig] = useState<ModalOptions>({
        title: '',
        message: '',
        type: 'info'
    });

    const closeModal = useCallback(() => {
        setIsOpen(false);
        // Clean up callback references after animation to prevent leaks or stale closures if reused immediately? 
        // No, keep them for the fade out.
    }, []);

    const showModal = useCallback((options: ModalOptions) => {
        setConfig({
            type: 'info', // Default
            confirmText: 'OK',
            cancelText: 'Cancel',
            ...options
        });
        setIsOpen(true);
    }, []);

    const showAlert = useCallback((title: string, message: string, type: ModalType = 'info') => {
        showModal({
            title,
            message,
            type,
            onConfirm: closeModal,
            onCancel: closeModal, // Clicking backdrop closes alerts
            confirmText: 'OK'
        });
    }, [showModal, closeModal]);

    const showConfirm = useCallback((title: string, message: string, onConfirm: () => void) => {
        showModal({
            title,
            message,
            type: 'confirm',
            onConfirm: () => {
                onConfirm();
                closeModal();
            },
            onCancel: closeModal,
            confirmText: 'Confirm',
            cancelText: 'Cancel'
        });
    }, [showModal, closeModal]);

    // Handle button clicks from the modal component
    const handleConfirm = () => {
        if (config.onConfirm) {
            config.onConfirm();
        } else {
            closeModal();
        }
    };

    const handleCancel = () => {
        if (config.onCancel) config.onCancel();
        closeModal();
    };

    return (
        <ModalContext.Provider value={{ showModal, closeModal, showAlert, showConfirm }}>
            {children}
            <CustomModal
                isOpen={isOpen}
                type={config.type || 'info'}
                title={config.title}
                message={config.message}
                confirmText={config.confirmText}
                cancelText={config.cancelText}
                onConfirm={handleConfirm}
                onCancel={handleCancel}
            />
        </ModalContext.Provider>
    );
}

export function useModal() {
    const context = useContext(ModalContext);
    if (context === undefined) {
        throw new Error('useModal must be used within a ModalProvider');
    }
    return context;
}
