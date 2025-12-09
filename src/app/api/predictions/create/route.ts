import { NextRequest, NextResponse } from 'next/server';
import { createPrediction, findPredictionByCast, addBet } from '@/lib/predictions';
import { MetricType, PredictionChoice } from '@/lib/types';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const {
            castHash,
            castAuthor,
            castText,
            metric,
            targetValue,
            choice,
            betAmount,
            initialValue,
        } = body;

        // TODO: Get user ID from MiniKit authentication
        const userId = 'demo_user'; // Placeholder

        // Validate input
        if (!castHash || !metric || !targetValue || !choice || !betAmount) {
            return NextResponse.json(
                { success: false, error: 'Missing required fields' },
                { status: 400 }
            );
        }

        // Check if prediction already exists for this cast/metric/target
        let prediction = findPredictionByCast(
            castHash,
            metric as MetricType,
            targetValue
        );

        // Create new prediction if it doesn't exist
        if (!prediction) {
            prediction = createPrediction(
                castHash,
                castAuthor,
                castText,
                metric as MetricType,
                targetValue,
                initialValue || 0
            );
        }

        // Add bet to the prediction
        const success = addBet(
            prediction.id,
            userId,
            choice as PredictionChoice,
            betAmount
        );

        if (!success) {
            return NextResponse.json(
                { success: false, error: 'Failed to add bet to prediction' },
                { status: 500 }
            );
        }

        return NextResponse.json({
            success: true,
            predictionId: prediction.id,
            prediction,
        });
    } catch (error) {
        console.error('Error in /api/predictions/create:', error);
        return NextResponse.json(
            { success: false, error: 'Failed to create prediction' },
            { status: 500 }
        );
    }
}
