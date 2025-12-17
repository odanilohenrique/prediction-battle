
const FETCH_URL = 'http://127.0.0.1:3000/api/admin/bets/create';

async function main() {
    console.log(`🚀 Creating Test Bet via API: ${FETCH_URL}`);

    // Payload for the test bet
    const payload = {
        username: 'betashop.eth',
        displayName: 'betashop.eth',
        pfpUrl: 'https://wrpcd.net/cdn-cgi/imagedelivery/BXluQx4ige9GuW0Ia56BHw/486fd621-633b-4eb7-a13b-cb5cd118cb00/anim=false,fit=contain,f=auto,w=288',
        betType: 'likes_total',
        targetValue: 10,
        timeframe: '30m', // 30 minutes
        castHash: '0x7678633e', // The user provided short hash
        minBet: 0.1,
        maxBet: 50,
        rules: 'Automated test 30m'
    };

    try {
        const response = await fetch(FETCH_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const data = await response.json();

        if (data.success) {
            console.log('\n✅ Bet Created Successfully!');
            console.log('ID:', data.betId);
            console.log('Status: Active');
            console.log('Expires in: 30 minutes');
        } else {
            console.error('\n❌ Error creating bet:', data.error);
        }

    } catch (error) {
        console.error('Fetch error:', error);
    }
}

main();
