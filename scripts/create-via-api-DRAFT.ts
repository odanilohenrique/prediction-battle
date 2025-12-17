
async function main() {
    console.log('🚀 Creating Test Bet via API...');

    // Assumes server is running at localhost:3000
    // Using the admin/bets/create endpoint logic, or just simulating a user bet? 
    // Actually, we don't have a public endpoint to "Create Custom Admin Bet" without auth/admin check easily reachable via script if auth is enabled.
    // However, I can check `api/admin/bets/create` code.
    // If it requires strict auth, I might need to simulate it or use the `store` logic with dotenv loaded.

    // Let's try loading dotenv for the KV script first, it's safer.
    // But if that fails, I'll use this fetch approach.

    const bet = {
        username: 'betashop.eth',
        displayName: 'betashop.eth',
        pfpUrl: 'https://wrpcd.net/cdn-cgi/imagedelivery/BXluQx4ige9GuW0Ia56BHw/486fd621-633b-4eb7-a13b-cb5cd118cb00/anim=false,fit=contain,f=auto,w=288',
        type: 'likes_total',
        target: 10,
        timeframe: 'custom',
        customTimeframe: 30 * 60 * 1000, // 30 mins
        castHash: '0x7678633e',
        rules: 'Automated test',
        minBet: 0.1,
        maxBet: 50
    };

    // Note: The /api/admin/bets/create currently might not support 'customTimeframe' param directly if not coded. 
    // I should check route logic. 
    // If difficult, I will go back to the KV script and just load .env
}
