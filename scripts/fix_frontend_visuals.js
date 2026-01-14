
const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../src/components/AdminBetCard.tsx');
let content = fs.readFileSync(filePath, 'utf8');

const replacements = [
    {
        // Tug of War YES
        search: `                                const losingPool = noPool; // For YES side, NO pool is losing
                                const currentEligible = yesPool - seedPerSide;

                                if (currentEligible <= 0) return '1.75'; // First bettor rate
                                const multiplier = 1 + (losingPool * 0.75) / currentEligible;
                                return multiplier.toFixed(2);`,
        replace: `                                // Dead Liquidity Visual
                                const totalPool = yesPool + noPool + initialSeed;
                                const mySideEffective = yesPool + seedPerSide;
                                if (mySideEffective <= 0) return '1.75';
                                const multiplier = (totalPool * 0.75) / mySideEffective;
                                return multiplier.toFixed(2);`
    },
    {
        // Tug of War NO
        search: `                                const losingPool = yesPool; // For NO side, YES pool is losing
                                const currentEligible = noPool - seedPerSide;

                                if (currentEligible <= 0) return '1.75'; // First bettor rate
                                const multiplier = 1 + (losingPool * 0.75) / currentEligible;
                                return multiplier.toFixed(2);`,
        replace: `                                // Dead Liquidity Visual
                                const totalPool = yesPool + noPool + initialSeed;
                                const mySideEffective = noPool + seedPerSide;
                                if (mySideEffective <= 0) return '1.75';
                                const multiplier = (totalPool * 0.75) / mySideEffective;
                                return multiplier.toFixed(2);`
    },
    {
        // Summary Payout
        search: `                                            // FIXED MULTIPLIER based on CURRENT pool state
                                            // User's bet does NOT affect their own multiplier
                                            const losingPool = choice === 'yes' ? noPool : yesPool;
                                            const currentEligible = choice === 'yes'
                                                ? yesPool - seedPerSide  // Current eligible on your side (excluding seed)
                                                : noPool - seedPerSide;

                                            // If no eligible bettors yet, use initial rate 1.75x
                                            // Otherwise calculate based on current pool
                                            const multiplier = currentEligible <= 0
                                                ? 1.75  // First bettor always gets 1.75x
                                                : 1 + (losingPool * 0.75) / currentEligible;

                                            return (numericAmount * multiplier).toFixed(2);`,
        replace: `                                            // Dead Liquidity Visual
                                            const totalPool = yesPool + noPool + initialSeed;
                                            const mySideCurrent = choice === 'yes' ? yesPool : noPool;
                                            const mySideEffective = mySideCurrent + seedPerSide;
                                            if (mySideEffective <= 0) return (numericAmount * 1.75).toFixed(2);
                                            const rate = (totalPool * 0.75) / mySideEffective;
                                            return (numericAmount * rate).toFixed(2);`
    },
    {
        // Summary Rate
        search: `                                                const losingPool = choice === 'yes' ? noPool : yesPool;
                                                const currentEligible = choice === 'yes'
                                                    ? yesPool - seedPerSide
                                                    : noPool - seedPerSide;

                                                const multiplier = currentEligible <= 0
                                                    ? 1.75
                                                    : 1 + (losingPool * 0.75) / currentEligible;
                                                return multiplier.toFixed(2);`,
        replace: `                                                const totalPool = yesPool + noPool + initialSeed;
                                                const mySideCurrent = choice === 'yes' ? yesPool : noPool;
                                                const mySideEffective = mySideCurrent + seedPerSide;
                                                if (mySideEffective <= 0) return '1.75';
                                                const rate = (totalPool * 0.75) / mySideEffective;
                                                return rate.toFixed(2);`
    }
];

let replacedCount = 0;
replacements.forEach((item, index) => {
    if (content.indexOf(item.search) !== -1) {
        content = content.replace(item.search, item.replace);
        console.log(`Replaced chunk ${index + 1}`);
        replacedCount++;
    } else {
        console.warn(`Chunk ${index + 1} NOT found.`);
        // Try trimming whitespace?
        // Simple fallback: Try replace with normalized whitespace? Too complex for this script.
    }
});

if (replacedCount > 0) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`Successfully replaced ${replacedCount} chunks.`);
} else {
    console.error('No replacements made.');
    process.exit(1);
}
