import { NextRequest, NextResponse } from 'next/server';

// Simple in-memory storage for user predictions
const userPredictions = new Map();

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const {
            username,
            predictionType,
            targetValue,
            timeframe,
            choice,
            betAmount,
        } = body;

        // TODO: Get user ID from authentication
        const userId = 'demo_user';

        // Validate input
        if (!username || !predictionType || !targetValue || !choice || !betAmount) {
            return NextResponse.json(
                { success: false, error: 'Campos obrigatórios faltando' },
                { status: 400 }
            );
        }

        // Create prediction
        const predictionId = `user_pred_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
        const now = Date.now();
        const expiresAt = timeframe === '24h'
            ? now + (24 * 60 * 60 * 1000)
            : now + (7 * 24 * 60 * 60 * 1000);

        const prediction = {
            id: predictionId,
            username,
            predictionType,
            targetValue,
            timeframe,
            createdAt: now,
            expiresAt,
            bets: [{
                userId,
                choice,
                amount: betAmount,
                timestamp: now,
            }],
            status: 'active',
        };

        userPredictions.set(predictionId, prediction);

        return NextResponse.json({
            success: true,
            predictionId,
            prediction,
        });
    } catch (error) {
        console.error('Error in /api/predictions/user/create:', error);
        return NextResponse.json(
            { success: false, error: 'Falha ao criar previsão' },
            { status: 500 }
        );
    }
}
