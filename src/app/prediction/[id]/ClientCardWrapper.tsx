'use client';

import AdminBetCard from '@/components/AdminBetCard';
import { useRouter } from 'next/navigation';

export default function ClientCardWrapper({ bet }: { bet: any }) {
    const router = useRouter();

    return (
        <AdminBetCard
            bet={bet}
            onBet={() => {
                // If user tries to bet here, we could redirect to home or open connect modal.
                // Since this page IS part of the app, checking wallet connection in AdminBetCard should work normally.
                // But for safety/UX consistency:
                router.refresh();
            }}
        />
    );
}
