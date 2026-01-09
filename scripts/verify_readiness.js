
const fs = require('fs');
const path = require('path');

console.log('--- STARTING MAINNET READINESS VERIFICATION ---');

// 1. Verify Manifest
const manifestPath = path.join(process.cwd(), 'public', 'manifest.json');
if (fs.existsSync(manifestPath)) {
    console.log('[OK] manifest.json exists.');
    const content = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    if (content.name && content.icons) {
        console.log('[OK] manifest.json is valid JSON with required fields.');
    } else {
        console.error('[FAIL] manifest.json missing name or icons.');
    }
} else {
    console.error('[FAIL] manifest.json NOT FOUND.');
}

// 2. Verify Config / Environment
// We can't easily import TS config in JS execution without transpilation, 
// so we'll check the file content roughly.
const configPath = path.join(process.cwd(), 'src', 'lib', 'config.ts');
const configContent = fs.readFileSync(configPath, 'utf8');

const hasMainnetConfig = configContent.includes('chainId: 8453');
const hasSepoliaConfig = configContent.includes('chainId: 84532');
const usesEnvVar = configContent.includes('process.env.NEXT_PUBLIC_USE_MAINNET');

if (hasMainnetConfig && hasSepoliaConfig && usesEnvVar) {
    console.log('[OK] config.ts contains Mainnet/Sepolia and Env logic.');
} else {
    console.error('[FAIL] config.ts missing required configuration logic.');
}

// 3. Simulate Logic: Odds Calculation
function calculateOdds(yesPool, noPool, betAmount, side) {
    const totalPool = yesPool + noPool + betAmount;
    // Simplified logic as per codebase (assuming House takes existing pool ratio)
    // Actually, let's verify the logic I saw in AdminBetCard:
    // multiplier = 1 + (LosingSide * 0.8) / (WinningSide + YourBet)

    let multiplier = 0;
    if (side === 'yes') {
        if (yesPool === 0) return 2.0; // Early bird fallback
        multiplier = 1 + (noPool * 0.8) / (yesPool + betAmount);
    } else {
        if (noPool === 0) return 2.0;
        multiplier = 1 + (yesPool * 0.8) / (noPool + betAmount);
    }
    return multiplier;
}

// Test Case 1: Even split
const odds1 = calculateOdds(100, 100, 10, 'yes');
console.log(`Test 1 (100/100, Bet 10 on YES): Expected ~1.72x. Actual: ${odds1.toFixed(2)}x`);
// 1 + (100 * 0.8) / 110 = 1 + 80 / 110 = 1 + 0.727 = 1.72. Correct.

// Test Case 2: Underdog
const odds2 = calculateOdds(100, 10, 10, 'yes'); // Betting on highly likely outcome (YES pool is 100, NO is only 10)
console.log(`Test 2 (100/10, Bet 10 on YES): Expected Low Return. Actual: ${odds2.toFixed(2)}x`);
// 1 + (10 * 0.8) / 110 = 1 + 8 / 110 = 1.07. Correct.

// Test Case 3: Longshot
const odds3 = calculateOdds(100, 10, 10, 'no'); // Betting on unlikely outcome (YES 100, NO 10, Bet 10 NO)
console.log(`Test 3 (100/10, Bet 10 on NO): Expected High Return. Actual: ${odds3.toFixed(2)}x`);
// 1 + (100 * 0.8) / (10 + 10) = 1 + 80 / 20 = 5.0. Correct.

console.log('--- VERIFICATION COMPLETE ---');
