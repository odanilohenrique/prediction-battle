// In-memory predictions storage and management

import { Prediction, PredictionChoice, MetricType, Bet } from './types';

// In-memory store (will reset on server restart)
const predictions = new Map<string, Prediction>();

/**
 * Generate a unique prediction ID
 */
function generatePredictionId(): string {
    return `pred_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Create a new prediction
 */
export function createPrediction(
    castHash: string,
    castAuthor: string,
    castText: string,
    metric: MetricType,
    targetValue: number,
    initialValue: number
): Prediction {
    const id = generatePredictionId();
    const now = Date.now();

    const prediction: Prediction = {
        id,
        castHash,
        castAuthor,
        castText,
        metric,
        targetValue,
        createdAt: now,
        expiresAt: now + (24 * 60 * 60 * 1000), // 24 hours from now
        pot: {
            yes: [],
            no: [],
        },
        status: 'active',
        initialValue,
    };

    predictions.set(id, prediction);
    return prediction;
}

/**
 * Get a prediction by ID
 */
export function getPrediction(id: string): Prediction | null {
    return predictions.get(id) || null;
}

/**
 * Find a prediction by cast hash and metric
 */
export function findPredictionByCast(
    castHash: string,
    metric: MetricType,
    targetValue: number
): Prediction | null {
    for (const prediction of predictions.values()) {
        if (
            prediction.castHash === castHash &&
            prediction.metric === metric &&
            prediction.targetValue === targetValue &&
            prediction.status === 'active'
        ) {
            return prediction;
        }
    }
    return null;
}

/**
 * Add a bet to a prediction
 */
export function addBet(
    predictionId: string,
    userId: string,
    choice: PredictionChoice,
    amount: number
): boolean {
    const prediction = predictions.get(predictionId);

    if (!prediction || prediction.status !== 'active') {
        return false;
    }

    const bet: Bet = {
        userId,
        amount,
        timestamp: Date.now(),
    };

    if (choice === 'yes') {
        prediction.pot.yes.push(bet);
    } else {
        prediction.pot.no.push(bet);
    }

    predictions.set(predictionId, prediction);
    return true;
}

/**
 * Get all active predictions
 */
export function getActivePredictions(): Prediction[] {
    const now = Date.now();
    return Array.from(predictions.values()).filter(
        (p) => p.status === 'active' && p.expiresAt > now
    );
}

/**
 * Get all expired predictions that need checking
 */
export function getExpiredPredictions(): Prediction[] {
    const now = Date.now();
    return Array.from(predictions.values()).filter(
        (p) => p.status === 'active' && p.expiresAt <= now
    );
}

/**
 * Get predictions for a specific user
 */
export function getUserPredictions(userId: string): Prediction[] {
    return Array.from(predictions.values()).filter((prediction) => {
        const hasYesBet = prediction.pot.yes.some((bet) => bet.userId === userId);
        const hasNoBet = prediction.pot.no.some((bet) => bet.userId === userId);
        return hasYesBet || hasNoBet;
    });
}

/**
 * Update prediction result
 */
export function updatePredictionResult(
    predictionId: string,
    result: PredictionChoice,
    finalValue: number
): boolean {
    const prediction = predictions.get(predictionId);

    if (!prediction) {
        return false;
    }

    prediction.status = 'completed';
    prediction.result = result;
    prediction.finalValue = finalValue;

    predictions.set(predictionId, prediction);
    return true;
}

/**
 * Calculate total pot value
 */
export function getTotalPot(prediction: Prediction): number {
    const yesTotal = prediction.pot.yes.reduce((sum, bet) => sum + bet.amount, 0);
    const noTotal = prediction.pot.no.reduce((sum, bet) => sum + bet.amount, 0);
    return yesTotal + noTotal;
}

/**
 * Calculate payouts for a completed prediction
 */
export function calculatePayouts(prediction: Prediction): {
    winners: { userId: string; payout: number }[];
    platformFee: number;
} {
    if (prediction.status !== 'completed' || !prediction.result) {
        return { winners: [], platformFee: 0 };
    }

    const totalPot = getTotalPot(prediction);
    const platformFee = totalPot * 0.2; // 20% platform fee
    const winnersPot = totalPot * 0.8; // 80% to winners

    const winningBets = prediction.result === 'yes'
        ? prediction.pot.yes
        : prediction.pot.no;

    const totalWinningStake = winningBets.reduce((sum, bet) => sum + bet.amount, 0);

    if (totalWinningStake === 0) {
        // No winners, all goes to platform
        return { winners: [], platformFee: totalPot };
    }

    const winners = winningBets.map((bet) => ({
        userId: bet.userId,
        payout: (bet.amount / totalWinningStake) * winnersPot,
    }));

    return { winners, platformFee };
}

/**
 * Get all predictions (for admin/debugging)
 */
export function getAllPredictions(): Prediction[] {
    return Array.from(predictions.values());
}
