import RoadmapSection from '@/components/RoadmapSection';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

export default function RoadmapPage() {
    return (
        <main className="min-h-screen bg-black text-white p-6 md:p-12">
            <div className="max-w-4xl mx-auto">
                <Link href="/" className="inline-flex items-center gap-2 text-white/40 hover:text-white transition-colors mb-4 md:mb-8">
                    <ArrowLeft className="w-4 h-4" />
                    Back to Arena
                </Link>

                <RoadmapSection />
            </div>
        </main>
    );
}
