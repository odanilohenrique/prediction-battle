// Type definitions for Prediction Battle

export type MetricType = 'likes' | 'recasts' | 'replies';

export type PredictionChoice = 'yes' | 'no';

export type PredictionStatus = 'active' | 'completed' | 'expired';

export interface Bet {
    userId: string;
    amount: number;
    timestamp: number;
}

export interface Prediction {
    id: string;
    castHash: string;
    castAuthor: string;
    castText: string;
    metric: MetricType;
    targetValue: number;
    createdAt: number;
    expiresAt: number;
    pot: {
        yes: Bet[];
        no: Bet[];
    };
    status: PredictionStatus;
    result?: PredictionChoice;
    finalValue?: number;
    initialValue: number;
}

export interface Cast {
    hash: string;
    author: {
        username: string;
        displayName: string;
        pfp: {
            url: string;
        };
        fid: number;
    };
    text: string;
    reactions: {
        likes_count: number;
        recasts_count: number;
        replies_count: number;
    };
    timestamp: string;
}

export interface UserBet {
    predictionId: string;
    prediction: Prediction;
    choice: PredictionChoice;
    amount: number;
    timestamp: number;
    status: 'pending' | 'won' | 'lost';
    payout?: number;
    paid?: boolean;
    txHash?: string;
}
